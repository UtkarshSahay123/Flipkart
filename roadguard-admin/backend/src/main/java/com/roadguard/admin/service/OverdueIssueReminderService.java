package com.roadguard.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class OverdueIssueReminderService {
    private static final Logger log = LoggerFactory.getLogger(OverdueIssueReminderService.class);
    private final JdbcTemplate jdbc;
    private final EmailService emailService;
    private final ObjectMapper json;

    public OverdueIssueReminderService(JdbcTemplate jdbc, EmailService emailService, ObjectMapper json) {
        this.jdbc = jdbc;
        this.emailService = emailService;
        this.json = json;
    }

    @PostConstruct
    public void createNotificationTable() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS admin_issue_reminders (admin_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, issue_id TEXT NOT NULL, first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_email_attempt_at TIMESTAMPTZ, read_at TIMESTAMPTZ, PRIMARY KEY(admin_id, issue_id))");
        jdbc.execute("ALTER TABLE admin_issue_reminders ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ");
        jdbc.execute("CREATE TABLE IF NOT EXISTS notifications (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, title TEXT, message TEXT NOT NULL, notification_type TEXT, target_link TEXT, is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_key TEXT UNIQUE)");
        jdbc.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT");
        jdbc.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT");
        jdbc.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_link TEXT");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)");
    }

    @Scheduled(fixedDelayString = "${roadguard.reminders.poll-ms:60000}", initialDelayString = "${roadguard.reminders.initial-delay-ms:15000}")
    public void scanOverdueIssues() {
        try {
            List<ReminderRecipient> admins = jdbc.query("SELECT id, email, full_name, role FROM admin_users WHERE role IS NULL OR UPPER(role)='ADMIN'", (rs, n) -> new ReminderRecipient(rs.getLong("id"), rs.getString("email"), rs.getString("full_name"), rs.getString("role")));
            if (admins.isEmpty()) return;
            jdbc.update("DELETE FROM admin_issue_reminders r USING issues i WHERE i.id=r.issue_id AND (COALESCE(i.metadata_json::jsonb->>'status','Unassigned') <> 'Unassigned' OR EXISTS (SELECT 1 FROM work_tasks t WHERE t.issue_id=i.id))");
            List<Map<String, Object>> overdue = jdbc.query("SELECT i.id, i.metadata_json FROM issues i WHERE COALESCE(i.metadata_json::jsonb->>'status','Unassigned') = 'Unassigned' AND NULLIF(i.metadata_json::jsonb->>'reported_at','') IS NOT NULL AND COALESCE(NULLIF(i.metadata_json::jsonb->>'last_updated','')::timestamptz, NULLIF(i.metadata_json::jsonb->>'reported_at','')::timestamptz) < NOW() - INTERVAL '2 days' AND NOT EXISTS (SELECT 1 FROM work_tasks t WHERE t.issue_id=i.id)", (rs, n) -> Map.of("id", rs.getString("id"), "metadata", rs.getString("metadata_json")));
            for (Map<String, Object> row : overdue) for (ReminderRecipient admin : admins) {
                String issueId = String.valueOf(row.get("id"));
                jdbc.update("INSERT INTO admin_issue_reminders(admin_id, issue_id) VALUES (?, ?) ON CONFLICT (admin_id, issue_id) DO NOTHING", admin.id(), issueId);
                jdbc.update("INSERT INTO notifications(user_id, title, message, notification_type, target_link, source_key) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (source_key) DO NOTHING",
                        admin.id(), "Issue needs attention", "Issue " + issueId + " has had no action for more than 2 days.", "warning", "/admin/issues?issue=" + issueId, "overdue:" + admin.id() + ":" + issueId);
                Timestamp sent = jdbc.query("SELECT email_sent_at FROM admin_issue_reminders WHERE admin_id=? AND issue_id=?", rs -> rs.next() ? rs.getTimestamp(1) : null, admin.id(), issueId);
                if (sent != null) continue;
                Timestamp previous = jdbc.query("SELECT last_email_attempt_at FROM admin_issue_reminders WHERE admin_id=? AND issue_id=?", rs -> rs.next() ? rs.getTimestamp(1) : null, admin.id(), issueId);
                if (previous != null && previous.toInstant().isAfter(Instant.now().minusSeconds(21600))) continue;
                try {
                    JsonNode issue = json.readTree(String.valueOf(row.get("metadata")));
                    String reported = issue.path("reported_at").asText("unknown time");
                    emailService.sendOverdueIssueReminder(admin.email(), admin.fullName(), issueId,
                            issue.path("type").asText("Reported issue"), issue.path("location").asText("GPS location"), reported);
                    jdbc.update("UPDATE admin_issue_reminders SET last_email_attempt_at=NOW(), email_sent_at=NOW() WHERE admin_id=? AND issue_id=?", admin.id(), issueId);
                } catch (Exception ex) {
                    jdbc.update("UPDATE admin_issue_reminders SET last_email_attempt_at=NOW() WHERE admin_id=? AND issue_id=?", admin.id(), issueId);
                    log.warn("Could not send overdue issue reminder for issue {} to admin {}: {}", issueId, admin.id(), ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.warn("Overdue issue scan failed: {}", ex.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${roadguard.reminders.poll-ms:60000}", initialDelayString = "${roadguard.reminders.initial-delay-ms:15000}")
    public void scanUnassignedDepartmentTasks() {
        try {
            List<Map<String, Object>> overdue = jdbc.queryForList("SELECT t.id,t.title,t.issue_id,t.organization_id,t.department_id,t.direct_admin_assignment,t.employee_id,t.priority,t.due_date FROM work_tasks t WHERE t.department_id IS NOT NULL AND ((t.status='Assigned to Department' AND t.employee_id IS NULL) OR (t.direct_admin_assignment=TRUE AND t.status <> 'Resolved')) AND t.created_at < NOW() - INTERVAL '2 days' AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.source_key LIKE 'dept-task-reminder:' || t.id || ':%')");
            for (Map<String,Object> task : overdue) {
                Long id = ((Number) task.get("id")).longValue(); Long organizationId = ((Number) task.get("organization_id")).longValue(); Long departmentId = ((Number) task.get("department_id")).longValue();
                boolean direct = Boolean.TRUE.equals(task.get("direct_admin_assignment"));
                String title = String.valueOf(task.get("title"));
                String reminder = direct ? "Directly assigned task '" + title + "' remains unresolved after two days." : "Task '" + title + "' has remained unassigned to a member for two days.";
                Long employeeId = task.get("employee_id") == null ? null : ((Number) task.get("employee_id")).longValue();
                List<ReminderRecipient> recipients = jdbc.query("SELECT id, email, full_name, role FROM admin_users WHERE organization_id=? AND ((?=TRUE AND (id=? OR role='ADMIN')) OR (?=FALSE AND (role='ADMIN' OR (department_id=? AND department_role='HEAD'))))",
                        (rs, n) -> new ReminderRecipient(rs.getLong("id"), rs.getString("email"), rs.getString("full_name"), rs.getString("role")), organizationId, direct, employeeId, direct, departmentId);
                for (ReminderRecipient recipient : recipients) {
                    boolean admin = "ADMIN".equals(recipient.role());
                    notifyUser(recipient.id(), "Department task reminder", reminder, "warning", admin ? "/admin/departments" : "/employee", "dept-task-reminder:" + id + ":" + recipient.id());
                    emailService.sendTaskAssignmentEmail(recipient.email(), recipient.fullName(), "Reminder: " + title, reminder, task.get("issue_id") == null ? null : String.valueOf(task.get("issue_id")), String.valueOf(task.get("priority")), task.get("due_date") == null ? null : String.valueOf(task.get("due_date")), "RoadGuard task reminder");
                }
            }
        } catch (Exception ex) { log.warn("Department task reminder scan failed: {}", ex.getMessage()); }
    }

    private record ReminderRecipient(Long id, String email, String fullName, String role) {}

    public List<Map<String, Object>> listForUser(Long userId) {
        return jdbc.query("SELECT n.source_key, n.id, COALESCE(n.title,'RoadGuard update') AS title, n.message, COALESCE(n.notification_type,'info') AS notification_type, n.target_link, n.created_at, n.is_read FROM notifications n WHERE n.user_id=? AND (n.source_key NOT LIKE 'overdue:%' OR EXISTS (SELECT 1 FROM admin_issue_reminders r WHERE r.admin_id=n.user_id AND ('overdue:' || r.admin_id || ':' || r.issue_id)=n.source_key)) ORDER BY n.created_at DESC LIMIT 200", (rs, n) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getString("source_key") == null ? String.valueOf(rs.getLong("id")) : rs.getString("source_key"));
            item.put("title", rs.getString("title"));
            item.put("message", rs.getString("message"));
            item.put("type", rs.getString("notification_type"));
            item.put("timestamp", rs.getTimestamp("created_at").toInstant().toString());
            item.put("read", rs.getBoolean("is_read"));
            item.put("link", rs.getString("target_link"));
            return item;
        }, userId);
    }

    public void notifyUser(Long userId, String title, String message, String type, String link, String sourceKey) {
        if (userId == null) return;
        try {
            jdbc.update("INSERT INTO notifications(user_id,title,message,notification_type,target_link,source_key) VALUES (?,?,?,?,?,?) ON CONFLICT (source_key) DO NOTHING",
                    userId, title, message, type, link, sourceKey + ":" + userId);
        } catch (Exception ex) {
            log.warn("Could not save notification for user {}: {}", userId, ex.getMessage());
        }
    }

    public void notifyOrganizationAdmins(Long organizationId, String title, String message, String type, String link, String sourceKey) {
        if (organizationId == null) return;
        try {
            List<Long> admins = jdbc.query("SELECT id FROM admin_users WHERE organization_id=? AND (role='ADMIN' OR role IS NULL) AND account_active IS DISTINCT FROM FALSE",
                    (rs, n) -> rs.getLong(1), organizationId);
            for (Long adminId : admins) notifyUser(adminId, title, message, type, link, sourceKey);
        } catch (Exception ex) {
            log.warn("Could not notify organization admins {}: {}", organizationId, ex.getMessage());
        }
    }

    public void markRead(Long userId, String notificationId) {
        jdbc.update("UPDATE notifications SET is_read=TRUE WHERE user_id=? AND (source_key=? OR id::text=?)", userId, notificationId, notificationId);
        if (notificationId != null && notificationId.startsWith("overdue:")) {
            String prefix = "overdue:" + userId + ":";
            if (notificationId.startsWith(prefix)) {
                String issueId = notificationId.substring(prefix.length());
                jdbc.update("UPDATE admin_issue_reminders SET read_at=COALESCE(read_at,NOW()) WHERE admin_id=? AND issue_id=?", userId, issueId);
            }
        }
    }

    public void markAllRead(Long userId) {
        jdbc.update("UPDATE admin_issue_reminders SET read_at=COALESCE(read_at,NOW()) WHERE admin_id=?", userId);
        jdbc.update("UPDATE notifications SET is_read=TRUE WHERE user_id=?", userId);
    }
}
