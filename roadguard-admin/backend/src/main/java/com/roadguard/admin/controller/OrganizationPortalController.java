package com.roadguard.admin.controller;

import com.roadguard.admin.Admin;
import com.roadguard.admin.DesignationPermission;
import com.roadguard.admin.Organization;
import com.roadguard.admin.Department;
import com.roadguard.admin.WorkTask;
import com.roadguard.admin.TaskStatusHistory;
import com.roadguard.admin.repository.AdminRepository;
import com.roadguard.admin.repository.DesignationPermissionRepository;
import com.roadguard.admin.repository.WorkTaskRepository;
import com.roadguard.admin.repository.TaskStatusHistoryRepository;
import com.roadguard.admin.repository.OrganizationRepository;
import com.roadguard.admin.repository.DepartmentRepository;
import com.roadguard.admin.service.OverdueIssueReminderService;
import com.roadguard.admin.service.EmailService;
import com.roadguard.admin.service.PasswordOtpService;
import com.roadguard.admin.service.RbacService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@RestController
@RequestMapping({"/api/portal", "/api"})
public class OrganizationPortalController {
    private static final Logger log = LoggerFactory.getLogger(OrganizationPortalController.class);
    private final AdminRepository accounts;
    private final DesignationPermissionRepository permissions;
    private final WorkTaskRepository tasks;
    private final TaskStatusHistoryRepository history;
    private final OrganizationRepository organizations;
    private final DepartmentRepository departments;
    private final PasswordEncoder passwordEncoder;
    private final OverdueIssueReminderService overdueReminders;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
    private final PasswordOtpService passwordOtps;
    private final RbacService rbac;

    public OrganizationPortalController(AdminRepository accounts,
            DesignationPermissionRepository permissions, WorkTaskRepository tasks, TaskStatusHistoryRepository history,
            OrganizationRepository organizations, PasswordEncoder passwordEncoder, OverdueIssueReminderService overdueReminders,
            DepartmentRepository departments, JdbcTemplate jdbc, ObjectMapper objectMapper, EmailService emailService, PasswordOtpService passwordOtps, RbacService rbac) {
        this.accounts = accounts;
        this.permissions = permissions;
        this.tasks = tasks;
        this.history = history;
        this.organizations = organizations;
        this.departments = departments;
        this.passwordEncoder = passwordEncoder;
        this.overdueReminders = overdueReminders;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.emailService = emailService;
        this.passwordOtps = passwordOtps;
        this.rbac = rbac;
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS departments (id BIGSERIAL PRIMARY KEY, org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(120) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(org_id,name))");
        this.jdbc.update("INSERT INTO departments(org_id,name) SELECT o.id,d.name FROM organizations o CROSS JOIN (VALUES ('Traffic Police Department'),('Public Works Department (PWD)'),('Municipal Corporation / Municipality'),('Police Department')) AS d(name) ON CONFLICT(org_id,name) DO NOTHING");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS department_role VARCHAR(12)");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS authority_title VARCHAR(100)");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS authority_type VARCHAR(100)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_admin_users_department ON admin_users(organization_id, department_id, department_role)");
        this.jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_department_one_active_head ON admin_users(department_id) WHERE department_id IS NOT NULL AND department_role='HEAD' AND approved=TRUE AND account_active=TRUE");
        this.jdbc.execute("ALTER TABLE work_tasks ALTER COLUMN employee_id DROP NOT NULL");
        this.jdbc.execute("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS assigned_by_head BIGINT REFERENCES admin_users(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS direct_admin_assignment BOOLEAN NOT NULL DEFAULT FALSE");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_work_tasks_department ON work_tasks(organization_id, department_id, status)");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS task_history (id BIGSERIAL PRIMARY KEY, task_id BIGINT NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE, actor_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, action VARCHAR(60) NOT NULL, from_status VARCHAR(32), to_status VARCHAR(32), details TEXT, \"timestamp\" TIMESTAMPTZ NOT NULL DEFAULT NOW())");
        this.jdbc.execute("ALTER TABLE task_history ADD COLUMN IF NOT EXISTS \"timestamp\" TIMESTAMPTZ NOT NULL DEFAULT NOW()");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_task_history_task_timestamp ON task_history(task_id, \"timestamp\")");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS audit_events (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor TEXT NOT NULL, event_type TEXT NOT NULL, target_entity TEXT NOT NULL, description TEXT NOT NULL, result TEXT NOT NULL DEFAULT 'SUCCESS', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events(organization_id, created_at DESC)");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS admin_roles (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(80) NOT NULL, description VARCHAR(300), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id, name))");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS admin_role_permissions (role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE, permission_key VARCHAR(60) NOT NULL, PRIMARY KEY(role_id, permission_key))");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS org_levels (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, level_name VARCHAR(100) NOT NULL, rank_order INTEGER NOT NULL CHECK(rank_order > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id, level_name), UNIQUE(organization_id, rank_order))");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS level_id BIGINT REFERENCES org_levels(id) ON DELETE SET NULL");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_admin_users_org_level ON admin_users(organization_id, level_id)");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS privileges (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, privilege_key VARCHAR(100) NOT NULL, description VARCHAR(500), is_active BOOLEAN NOT NULL DEFAULT TRUE, created_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id, privilege_key))");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS user_privileges (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, privilege_id BIGINT NOT NULL REFERENCES privileges(id) ON DELETE RESTRICT, granted_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, parent_grant_id BIGINT REFERENCES user_privileges(id) ON DELETE SET NULL, can_grant BOOLEAN NOT NULL DEFAULT FALSE, granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')), revoked_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, revoked_at TIMESTAMPTZ, revoke_reason VARCHAR(500), CHECK(expires_at IS NULL OR expires_at > granted_at))");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_user_privileges_subject_status ON user_privileges(organization_id, user_id, privilege_id, status, expires_at)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_user_privileges_parent_status ON user_privileges(parent_grant_id, status)");
        this.jdbc.execute("CREATE TABLE IF NOT EXISTS privilege_audit_log (id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, subject_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, privilege_id BIGINT REFERENCES privileges(id) ON DELETE SET NULL, grant_id BIGINT REFERENCES user_privileges(id) ON DELETE SET NULL, action VARCHAR(16) NOT NULL CHECK(action IN ('GRANT','REVOKE','EXPIRE','DEFINE','DISABLE')), can_grant BOOLEAN, expires_at TIMESTAMPTZ, details JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_privilege_audit_org_time ON privilege_audit_log(organization_id, occurred_at DESC)");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_privilege_audit_subject_time ON privilege_audit_log(subject_id, occurred_at DESC)");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS rbac_role_id BIGINT REFERENCES admin_roles(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS rbac_enabled BOOLEAN DEFAULT FALSE");
        this.jdbc.update("UPDATE admin_users SET rbac_enabled=FALSE WHERE rbac_enabled IS NULL");
        this.jdbc.execute("ALTER TABLE admin_users ALTER COLUMN rbac_enabled SET DEFAULT FALSE");
        this.jdbc.execute("ALTER TABLE admin_users ALTER COLUMN rbac_enabled SET NOT NULL");
        this.jdbc.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS created_by_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL");
        this.jdbc.execute("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS parent_task_id BIGINT REFERENCES work_tasks(id) ON DELETE SET NULL");
        this.jdbc.execute("CREATE INDEX IF NOT EXISTS idx_work_tasks_parent ON work_tasks(parent_task_id)");
    }

    private Admin current() {
        return rbac.currentUser();
    }

    private ResponseEntity<?> requireAdmin(Admin user) {
        if (!"ADMIN".equals(user.getRole()) && user.getRole() != null)
            return ResponseEntity.status(403).body(Map.of("message", "Organization admin access required"));
        return null;
    }

    private Long orgId(Admin user) {
        return user.getOrganization() == null ? null : user.getOrganization().getId();
    }

    private boolean hasPermission(Admin user, String permissionKey) {
        return rbac.hasPermission(user, permissionKey);
    }

    private boolean isBelow(Long actorId, Long targetId, Long organizationId) {
        return rbac.isBelow(actorId, targetId, organizationId);
    }

    @GetMapping({"/notifications", "/admin/notifications"})
    public ResponseEntity<?> notifications() {
        Admin user = current();
        return ResponseEntity.ok(overdueReminders.listForUser(user.getId()));
    }

    @PatchMapping("/notifications/{notificationId}/read")
    public ResponseEntity<?> markNotificationRead(@PathVariable String notificationId) {
        Admin user = current();
        overdueReminders.markRead(user.getId(), notificationId);
        return ResponseEntity.ok(Map.of("status", "read"));
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<?> markAllNotificationsRead() {
        Admin user = current();
        overdueReminders.markAllRead(user.getId());
        return ResponseEntity.ok(Map.of("status", "read"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> profile() {
        Admin user = current();
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getFullName());
        profile.put("email", user.getEmail());
        profile.put("username", user.getUsername());
        profile.put("role", user.getRole() == null ? "ADMIN" : user.getRole());
        profile.put("designation", user.getDesignation());
        profile.put("authorityTitle", user.getAuthorityTitle());
        profile.put("authorityType", user.getAuthorityType());
        profile.put("departmentId", user.getDepartment() == null ? null : user.getDepartment().getId());
        profile.put("departmentName", user.getDepartment() == null ? null : user.getDepartment().getName());
        profile.put("departmentRole", user.getDepartmentRole());
        profile.put("roleId", user.getRbacRoleId());
        profile.put("rbacEnabled", user.isRbacEnabled());
        profile.put("permissions", "EMPLOYEE".equals(user.getRole())
                ? RBAC_PERMISSIONS.stream().filter(permission -> hasPermission(user, permission)).sorted().toList()
                : RBAC_PERMISSIONS.stream().sorted().toList());
        profile.put("managerId", user.getManagerId());
        profile.put("profileImage", user.getProfileImage());
        profile.put("approvalStatus", user.getApprovalStatus());
        Organization org = user.getOrganization();
        profile.put("organizationId", org == null ? null : org.getId());
        profile.put("organizationName", org == null ? null : org.getName());
        profile.put("organizationJoinCode", org == null || !"ADMIN".equals(user.getRole()) ? null : org.getJoinCode());
        profile.put("employeeEmailPattern", org == null ? null : org.getEmployeeEmailPattern());
        profile.put("dashboardSettings", org == null ? null : org.getDashboardSettings());
        profile.put("organizationChangeStatus", user.getOrganizationChangeStatus());
        profile.put("pendingOrganizationName", user.getPendingOrganization() == null ? null : user.getPendingOrganization().getName());
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/admin/dashboard")
    public ResponseEntity<?> adminDashboard() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("organizationId", organizationId);
        dashboard.put("organizationName", user.getOrganization().getName());
        dashboard.put("employeeCount", jdbc.queryForObject("SELECT COUNT(*) FROM admin_users WHERE organization_id=? AND role='EMPLOYEE'", Long.class, organizationId));
        dashboard.put("openTaskCount", jdbc.queryForObject("SELECT COUNT(*) FROM work_tasks WHERE organization_id=? AND status <> 'Resolved'", Long.class, organizationId));
        dashboard.put("resolvedTaskCount", jdbc.queryForObject("SELECT COUNT(*) FROM work_tasks WHERE organization_id=? AND status = 'Resolved'", Long.class, organizationId));
        try {
            dashboard.put("issueCount", jdbc.queryForObject("SELECT COUNT(*) FROM issues", Long.class));
            dashboard.put("activeIssueCount", jdbc.queryForObject("SELECT COUNT(*) FROM issues WHERE LOWER(COALESCE(metadata_json::jsonb->>'status','unassigned')) NOT IN ('resolved','closed')", Long.class));
        } catch (Exception ex) {
            dashboard.put("issueCount", 0L);
            dashboard.put("activeIssueCount", 0L);
        }
        dashboard.put("unreadNotificationCount", jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=FALSE", Long.class, user.getId()));
        return ResponseEntity.ok(dashboard);
    }

    @GetMapping("/chitti/logs")
    public ResponseEntity<?> chittiLogs() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(jdbc.queryForList("SELECT id, actor, event_type AS \"eventType\", target_entity AS \"targetEntity\", description, result, created_at AS timestamp FROM audit_events WHERE organization_id=? ORDER BY created_at DESC LIMIT 200", orgId(user)));
    }

    @PutMapping("/me/username")
    public ResponseEntity<?> updateUsername(@RequestBody UsernameRequest request) {
        Admin user = current();
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        if (!username.matches("^[A-Za-z0-9._@+-]{3,50}$"))
            return ResponseEntity.badRequest().body(Map.of("message", "Username must be 3–50 characters using letters, numbers, dot, underscore, @, +, or hyphen"));
        Admin owner = accounts.findByUsername(username).orElse(null);
        if (owner != null && !owner.getId().equals(user.getId()))
            return ResponseEntity.status(409).body(Map.of("message", "That username is already in use"));
        user.setUsername(username);
        accounts.save(user);
        saveAuditEvent(user, "ACCOUNT_USERNAME_CHANGED", String.valueOf(user.getId()), "Changed account username.");
        return ResponseEntity.ok(Map.of("username", username));
    }

    @PutMapping("/me/password")
    public ResponseEntity<?> updatePassword(@RequestBody PasswordChangeRequest request) {
        Admin user = current();
        if (request.getNewPassword() == null || request.getNewPassword().length() < 8 || request.getNewPassword().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("message", "New password must be between 8 and 100 characters"));
        if (!passwordOtps.consume(user.getEmail(), "CHANGE", request.getOtp()))
            return ResponseEntity.badRequest().body(Map.of("message", "Verification code is invalid or expired"));
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accounts.save(user);
        saveAuditEvent(user, "ACCOUNT_PASSWORD_CHANGED", String.valueOf(user.getId()), "Changed account password.");
        return ResponseEntity.ok(Map.of("message", "Password updated"));
    }

    @PostMapping("/me/password/otp")
    public ResponseEntity<?> sendPasswordChangeOtp() {
        Admin user = current();
        String code = passwordOtps.issue(user.getEmail(), "CHANGE");
        try {
            emailService.sendOtpEmail(user.getEmail(), code);
            return ResponseEntity.ok(Map.of("message", "Verification code sent to your account email"));
        } catch (org.springframework.web.client.RestClientException | IllegalStateException ex) {
            passwordOtps.clear(user.getEmail(), "CHANGE");
            return ResponseEntity.internalServerError().body(Map.of("message", "Unable to send verification code"));
        }
    }

    @PostMapping("/me/organization-change")
    public ResponseEntity<?> requestOrganizationChange(@RequestBody JoinCodeRequest request) {
        Admin employee = current();
        if (!"EMPLOYEE".equals(employee.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Employee access required"));
        if (request.getJoinCode() == null || request.getJoinCode().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Enter the new organization joining code"));
        if (employee.getPendingOrganization() != null)
            return ResponseEntity.status(409).body(Map.of("message", "You already have an organization change request awaiting review"));
        Organization target = organizations.findByJoinCodeIgnoreCase(request.getJoinCode().trim()).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body(Map.of("message", "Organization joining code was not found"));
        if (employee.getOrganization() != null && target.getId().equals(employee.getOrganization().getId()))
            return ResponseEntity.badRequest().body(Map.of("message", "This is already your current organization"));
        String pattern = effectiveOrganizationEmailPattern(target, null);
        if (isBlank(pattern)) return ResponseEntity.badRequest().body(Map.of("message", "The new organization has not configured an employee email rule"));
        try {
            if (!Pattern.compile(pattern, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(employee.getEmail()).matches())
                return ResponseEntity.badRequest().body(Map.of("message", "Your email does not match the new organization's email rule"));
        } catch (PatternSyntaxException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "The new organization's email rule is invalid"));
        }
        employee.setPendingOrganization(target);
        employee.setOrganizationChangeStatus("PENDING");
        accounts.save(employee);
        saveAuditEvent(employee, "ORGANIZATION_CHANGE_REQUESTED", String.valueOf(employee.getId()), "Requested to join organization " + target.getName());
        return ResponseEntity.ok(Map.of("status", "PENDING", "organizationName", target.getName(),
                "message", "Organization change request sent to " + target.getName() + " for admin approval"));
    }

    @PutMapping("/me/profile-image")
    public ResponseEntity<?> updateProfileImage(@RequestBody ProfileImageRequest request) {
        Admin user = current();
        String image = request.getProfileImage();
        if (image != null && !image.isBlank()) {
            if (image.length() > 14_000_000 || !image.matches("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$"))
                return ResponseEntity.badRequest().body(Map.of("message", "Use a PNG, JPEG, or WebP profile image up to 10 MB"));
        } else image = null;
        user.setProfileImage(image);
        accounts.save(user);
        saveAuditEvent(user, "PROFILE_PHOTO_CHANGED", String.valueOf(user.getId()), "Updated profile photo.");
        return ResponseEntity.ok(Map.of("profileImage", image == null ? "" : image));
    }

    @PutMapping("/organization/email-pattern")
    public ResponseEntity<?> updateEmployeeEmailPattern(@RequestBody EmailPatternRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Organization organization = user.getOrganization();
        String pattern = request.getPattern() == null ? "" : request.getPattern().trim();
        if (organization == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        if (pattern.isBlank() || pattern.length() > 300)
            return ResponseEntity.badRequest().body(Map.of("message", "Enter an email rule between 1 and 300 characters"));
        try { Pattern.compile(pattern); }
        catch (PatternSyntaxException ex) { return ResponseEntity.badRequest().body(Map.of("message", "Email rule is not a valid regular expression")); }
        organization.setEmployeeEmailPattern(pattern);
        organizations.save(organization);
        return ResponseEntity.ok(Map.of("emailPattern", pattern));
    }

    @PutMapping("/organization/dashboard-settings")
    public ResponseEntity<?> updateDashboardSettings(@RequestBody Map<String, Object> settings) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Organization organization = user.getOrganization();
        if (organization == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        try {
            organization.setDashboardSettings(objectMapper.writeValueAsString(settings));
            organizations.save(organization);
            return ResponseEntity.ok(settings);
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Could not save organization settings"));
        }
    }

    @GetMapping("/audit-events")
    public ResponseEntity<?> auditEvents() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(jdbc.queryForList("SELECT id, actor, event_type AS \"eventType\", target_entity AS \"targetEntity\", description, result, created_at AS timestamp FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200", organizationId));
    }

    @PostMapping("/audit-events")
    public ResponseEntity<?> createAuditEvent(@RequestBody AuditEventRequest request) {
        Admin user = current();
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        jdbc.update("INSERT INTO audit_events(organization_id, actor, event_type, target_entity, description, result) VALUES (?, ?, ?, ?, ?, ?)",
                organizationId, safe(request.getActor(), user.getFullName()), safe(request.getEventType(), "UPDATE"),
                safe(request.getTargetEntity(), ""), safe(request.getDescription(), ""), safe(request.getResult(), "SUCCESS"));
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    private static String safe(String value, String fallback) { return value == null ? fallback : value; }
    private static boolean isBlank(String value) { return value == null || value.isBlank(); }

    @GetMapping({"/employees", "/admin/employees"})
    public ResponseEntity<?> employees() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Long orgId = orgId(user);
        if (orgId == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        List<Admin> scoped = accounts.findAllByOrganizationIdOrderByFullName(orgId).stream()
                .filter(employee -> "EMPLOYEE".equals(employee.getRole()))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        accounts.findAllByOrganizationIsNullAndRoleOrderByFullName("EMPLOYEE").stream()
                .filter(employee -> !"APPROVED".equalsIgnoreCase(employee.getApprovalStatus()))
                .forEach(scoped::add);
        return ResponseEntity.ok(scoped.stream().map(OrganizationPortalController::employeeDto).toList());
    }

    @GetMapping("/employees/organization-change-requests")
    public ResponseEntity<?> organizationChangeRequests() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (orgId(user) == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        return ResponseEntity.ok(accounts.findAllByPendingOrganizationIdAndOrganizationChangeStatusOrderByFullName(orgId(user), "PENDING")
                .stream().map(OrganizationPortalController::employeeDto).toList());
    }

    @PatchMapping("/employees/{id}/organization-change")
    @Transactional
    public ResponseEntity<?> reviewOrganizationChange(@PathVariable Long id, @RequestBody ApprovalRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (orgId(user) == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        Admin employee = accounts.findByIdAndPendingOrganizationId(id, orgId(user)).orElse(null);
        if (employee == null || !"PENDING".equals(employee.getOrganizationChangeStatus())) return ResponseEntity.notFound().build();
        String status = request.getStatus() == null ? "" : request.getStatus().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(status))
            return ResponseEntity.badRequest().body(Map.of("message", "Status must be APPROVED or REJECTED"));
        if ("APPROVED".equals(status)) {
            employee.setOrganization(user.getOrganization());
            employee.setOrganizationChangeStatus("APPROVED");
        } else {
            employee.setOrganizationChangeStatus("REJECTED");
        }
        employee.setPendingOrganization(null);
        accounts.save(employee);
        return ResponseEntity.ok(employeeDto(employee));
    }

    @RequestMapping(path = {"/employees/{id}/approval", "/admin/approve-employee/{id}"}, method = {RequestMethod.PATCH, RequestMethod.POST})
    @Transactional
    public ResponseEntity<?> approval(@PathVariable Long id, @RequestBody ApprovalRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Admin employee = accounts.findUnassignedEmployeeForUpdate(id).orElse(null);
        if (employee == null) employee = accounts.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (employee == null || !"EMPLOYEE".equals(employee.getRole()))
            return ResponseEntity.notFound().build();
        String status = request.getStatus() == null ? "" : request.getStatus().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED", "PENDING").contains(status))
            return ResponseEntity.badRequest().body(Map.of("message", "Status must be APPROVED, REJECTED, or PENDING"));
        String requestedRole = safe(request.getAccountRole(), "EMPLOYEE").toUpperCase(Locale.ROOT);
        if (!Set.of("EMPLOYEE", "ADMIN").contains(requestedRole)) return ResponseEntity.badRequest().body(Map.of("message", "Account role must be EMPLOYEE or ADMIN"));
        String requestedTitle = "";
        String requestedAuthorityType = "";
        if ("ADMIN".equals(requestedRole)) {
            requestedTitle = safe(request.getAuthorityTitle(), "").replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
            requestedAuthorityType = safe(request.getAuthorityType(), "").replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
            if (!"APPROVED".equals(status) || requestedTitle.isBlank() || requestedTitle.length() > 100 || requestedAuthorityType.isBlank() || requestedAuthorityType.length() > 100)
                return ResponseEntity.badRequest().body(Map.of("message", "Authority type and designation are required (maximum 100 characters)"));
        }
        if ("APPROVED".equals(status) && "EMPLOYEE".equals(requestedRole)) {
            Organization organization = employee.getOrganization() == null ? user.getOrganization() : employee.getOrganization();
            if (organization == null || !Objects.equals(organization.getId(), orgId(user)))
                return ResponseEntity.badRequest().body(Map.of("message", "Employee and approving admin must belong to the same organization"));
            String pattern = effectiveOrganizationEmailPattern(organization, user);
            if (isBlank(pattern)) return ResponseEntity.badRequest().body(Map.of("message", "Configure the organization's employee email rule before approving registrations"));
            try {
                if (!Pattern.compile(pattern, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(employee.getEmail()).matches())
                    return ResponseEntity.badRequest().body(Map.of("message", "Employee email does not match this organization's email rule"));
            } catch (PatternSyntaxException ex) {
                return ResponseEntity.badRequest().body(Map.of("message", "Organization email rule is invalid"));
            }
            employee.setOrganization(organization);
        }
        if ("ADMIN".equals(requestedRole)) {
            employee.setRole("ADMIN"); employee.setDepartment(null); employee.setDepartmentRole(null);
            employee.setAuthorityType(requestedAuthorityType); employee.setAuthorityTitle(requestedTitle); employee.setDesignation(requestedTitle);
        }
        if ("APPROVED".equals(status) && "EMPLOYEE".equals(requestedRole) && "HEAD".equals(employee.getDepartmentRole()) && employee.getDepartment() != null) {
            Long targetDepartmentId = employee.getDepartment().getId();
            Long targetEmployeeId = employee.getId();
            List<Admin> otherHeads = accounts.findAllByOrganizationIdOrderByFullName(orgId(user)).stream().filter(other -> other.isApproved()
                    && !Boolean.FALSE.equals(other.getAccountActive()) && "HEAD".equals(other.getDepartmentRole())
                    && other.getDepartment() != null && Objects.equals(other.getDepartment().getId(), targetDepartmentId)
                    && !Objects.equals(other.getId(), targetEmployeeId)).toList();
            if (!otherHeads.isEmpty() && !request.isReplaceExistingHead())
                return ResponseEntity.status(409).body(Map.of("message", "This department already has an active Head. Set replaceExistingHead to true or reject this request."));
            for (Admin other : otherHeads) other.setDepartmentRole("MEMBER");
            if (!otherHeads.isEmpty()) {
                accounts.saveAll(otherHeads);
                accounts.flush();
            }
        }
        employee.setApprovalStatus(status);
        employee.setApproved("APPROVED".equals(status));
        accounts.saveAndFlush(employee);
        saveAuditEvent(user, "EMPLOYEE_APPROVED", String.valueOf(employee.getId()), requestedRole.equals("ADMIN")
                ? "Approved " + employee.getFullName() + " as an additional Admin with designation " + employee.getAuthorityTitle()
                : "Updated approval status for " + employee.getFullName() + " to " + status);
        return ResponseEntity.ok(employeeDto(employee));
    }

    @GetMapping("/tasks/my-tasks")
    public ResponseEntity<?> myTasks() {
        Admin user = current();
        if (!"EMPLOYEE".equals(user.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Employee access required"));
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(taskDtos(tasks.findAllByEmployeeIdAndOrganizationIdOrderByCreatedAtDesc(user.getId(), orgId(user))));
    }

    @GetMapping("/me/subordinates")
    public ResponseEntity<?> mySubordinates() {
        Admin user = current();
        if (!"EMPLOYEE".equals(user.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Employee access required"));
        if (!hasPermission(user, "TASK_ASSIGN")) return ResponseEntity.status(403).body(Map.of("message", "Your role does not allow task delegation"));
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(accounts.findAllByOrganizationIdOrderByFullName(organizationId).stream()
                .filter(employee -> "EMPLOYEE".equals(employee.getRole()) && employee.isApproved()
                        && !Boolean.FALSE.equals(employee.getAccountActive())
                        && isBelow(user.getId(), employee.getId(), organizationId))
                .map(OrganizationPortalController::employeeDto).toList());
    }

    @GetMapping("/departments")
    public ResponseEntity<?> listDepartments() {
        Admin user = current();
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        if ("ADMIN".equals(user.getRole()))
            return ResponseEntity.ok(departments.findAllByOrganizationIdOrderByName(orgId(user)).stream().map(OrganizationPortalController::departmentDto).toList());
        if (user.getDepartment() == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(List.of(departmentDto(user.getDepartment())));
    }

    @PostMapping("/admin/departments")
    public ResponseEntity<?> createOrRenameDepartment(@RequestBody DepartmentRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        String name = safe(request.getName(), "").replaceAll("[\\p{Cntrl}]", " ").trim().replaceAll("\\s+", " ");
        if (name.isBlank() || name.length() > 120) return ResponseEntity.badRequest().body(Map.of("message", "Department name must be 1 to 120 characters"));
        Department department = request.getId() == null ? new Department() : departments.findByIdAndOrganizationId(request.getId(), orgId(user)).orElse(null);
        if (department == null && request.getId() != null) return ResponseEntity.notFound().build();
        if (departments.findByOrganizationIdAndNameIgnoreCase(orgId(user), name).filter(existing -> !Objects.equals(existing.getId(), department.getId())).isPresent())
            return ResponseEntity.status(409).body(Map.of("message", "A department with that name already exists"));
        department.setOrganization(user.getOrganization());
        department.setName(name);
        Department saved = departments.save(department);
        saveAuditEvent(user, "DEPARTMENT_UPDATED", String.valueOf(saved.getId()), "Created or renamed department: " + name);
        return ResponseEntity.ok(departmentDto(saved));
    }

    @GetMapping("/admin/departments/overview")
    public ResponseEntity<?> departmentOverview() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Long organizationId = orgId(user);
        return ResponseEntity.ok(departments.findAllByOrganizationIdOrderByName(organizationId).stream().map(department -> {
            Map<String, Object> row = new LinkedHashMap<>(departmentDto(department));
            List<Admin> heads = accounts.findAllByOrganizationIdOrderByFullName(organizationId).stream()
                    .filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), department.getId()))
                    .filter(a -> "HEAD".equals(a.getDepartmentRole()) && a.isApproved() && !Boolean.FALSE.equals(a.getAccountActive())).toList();
            row.put("head", heads.isEmpty() ? null : memberDto(heads.get(0)));
            row.put("memberCount", accounts.findAllByOrganizationIdOrderByFullName(organizationId).stream()
                    .filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), department.getId()))
                    .filter(a -> "EMPLOYEE".equals(a.getRole()) && "MEMBER".equals(a.getDepartmentRole()) && a.isApproved() && !Boolean.FALSE.equals(a.getAccountActive())).count());
            row.put("pendingTasks", jdbc.queryForObject("SELECT COUNT(*) FROM work_tasks WHERE organization_id=? AND department_id=? AND status NOT IN ('In Progress','Resolved')", Long.class, organizationId, department.getId()));
            row.put("inProgressTasks", jdbc.queryForObject("SELECT COUNT(*) FROM work_tasks WHERE organization_id=? AND department_id=? AND status='In Progress'", Long.class, organizationId, department.getId()));
            row.put("resolvedTasks", jdbc.queryForObject("SELECT COUNT(*) FROM work_tasks WHERE organization_id=? AND department_id=? AND status='Resolved'", Long.class, organizationId, department.getId()));
            return row;
        }).toList());
    }

    @GetMapping("/departments/{id}/members")
    public ResponseEntity<?> departmentMembers(@PathVariable Long id) {
        Admin user = current();
        Department department = departments.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!"ADMIN".equals(user.getRole()) && (user.getDepartment() == null || !Objects.equals(user.getDepartment().getId(), id)))
            return ResponseEntity.status(403).body(Map.of("message", "You cannot view another department"));
        return ResponseEntity.ok(accounts.findAllByOrganizationIdOrderByFullName(orgId(user)).stream()
                .filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), id))
                .filter(a -> !"EMPLOYEE".equals(a.getRole()) || (a.isApproved() && !Boolean.FALSE.equals(a.getAccountActive())))
                .map(OrganizationPortalController::memberDto).toList());
    }

    @GetMapping("/departments/{id}/tasks")
    public ResponseEntity<?> departmentTasks(@PathVariable Long id) {
        Admin user = current();
        Department department = departments.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (department == null) return ResponseEntity.notFound().build();
        if (!"ADMIN".equals(user.getRole()) && (user.getDepartment() == null || !Objects.equals(user.getDepartment().getId(), id)))
            return ResponseEntity.status(403).body(Map.of("message", "You cannot view another department"));
        return ResponseEntity.ok(taskDtos(tasks.findAllByOrganizationIdAndDepartmentIdOrderByCreatedAtDesc(orgId(user), id)));
    }

    @PostMapping("/tasks/assign-department")
    public ResponseEntity<?> assignTaskToDepartment(@RequestBody DepartmentTaskRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Department department = departments.findByIdAndOrganizationId(request.getDepartmentId(), orgId(user)).orElse(null);
        if (department == null) return ResponseEntity.badRequest().body(Map.of("message", "Department was not found in your organization"));
        boolean hasActiveStaff = accounts.findAllByOrganizationIdOrderByFullName(orgId(user)).stream()
                .anyMatch(account -> "EMPLOYEE".equals(account.getRole()) && account.isApproved()
                        && !Boolean.FALSE.equals(account.getAccountActive()) && account.getDepartment() != null
                        && Objects.equals(account.getDepartment().getId(), department.getId())
                        && Set.of("HEAD", "MEMBER").contains(account.getDepartmentRole()));
        if (!hasActiveStaff) return ResponseEntity.status(409).body(Map.of("message",
                "No active members or department head are assigned to " + department.getName() + ". Add a department member or head before assigning a task."));
        if (isBlank(request.getTitle())) return ResponseEntity.badRequest().body(Map.of("message", "Task title is required"));
        WorkTask task = new WorkTask(); task.setOrganization(user.getOrganization()); task.setDepartment(department);
        task.setTitle(request.getTitle().trim()); task.setDescription(request.getDescription()); task.setIssueId(request.getIssueId());
        task.setPriority(safe(request.getPriority(), "Medium")); task.setStatus("Assigned to Department"); task.setCreatedBy(user);
        if (request.getDueDate() != null && !request.getDueDate().isBlank()) task.setDueDate(java.time.LocalDate.parse(request.getDueDate()));
        WorkTask saved = tasks.save(task);
        syncLinkedIssueAssignment(saved, null, user);
        writeTaskHistory(saved, user, "ASSIGNED_TO_DEPARTMENT", null, saved.getStatus(), "Assigned to " + department.getName() + " by " + authorityLabel(user));
        saveAuditEvent(user, "TASK_ASSIGNED_TO_DEPARTMENT", String.valueOf(saved.getId()), authorityLabel(user) + " assigned task '" + saved.getTitle() + "' to " + department.getName());
        notifyDepartmentHead(department, saved, user, false);
        return ResponseEntity.ok(taskDto(saved));
    }

    @PostMapping("/tasks/{id}/assign-member")
    public ResponseEntity<?> headAssignMember(@PathVariable Long id, @RequestBody DepartmentTaskRequest request) {
        Admin user = current();
        if (!"EMPLOYEE".equals(user.getRole()) || !"HEAD".equals(user.getDepartmentRole())) return ResponseEntity.status(403).body(Map.of("message", "Department Head access required"));
        return assignDepartmentTaskMember(id, request.getEmployeeId(), user, false);
    }

    @PostMapping("/admin/tasks/assign-member")
    public ResponseEntity<?> adminDirectAssign(@RequestBody DepartmentTaskRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        return assignDepartmentTaskMember(request.getTaskId(), request.getEmployeeId(), user, true);
    }

    @PostMapping("/admin/tasks/assign-direct")
    public ResponseEntity<?> adminCreateDirectTask(@RequestBody DepartmentTaskRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Admin member = request.getEmployeeId() == null ? null : accounts.findByIdAndOrganizationId(request.getEmployeeId(), orgId(user)).orElse(null);
        if (member == null || !"EMPLOYEE".equals(member.getRole()) || !member.isApproved() || Boolean.FALSE.equals(member.getAccountActive()) || member.getDepartment() == null)
            return ResponseEntity.badRequest().body(Map.of("message", "Choose an active, approved department member"));
        if (isBlank(request.getTitle())) return ResponseEntity.badRequest().body(Map.of("message", "Task title is required"));
        WorkTask task = new WorkTask(); task.setOrganization(user.getOrganization()); task.setDepartment(member.getDepartment()); task.setEmployee(member);
        task.setCreatedBy(user); task.setDirectAdminAssignment(true); task.setTitle(request.getTitle().trim()); task.setDescription(request.getDescription());
        task.setIssueId(request.getIssueId()); task.setPriority(safe(request.getPriority(), "Medium")); task.setStatus("Assigned");
        if (request.getDueDate() != null && !request.getDueDate().isBlank()) task.setDueDate(java.time.LocalDate.parse(request.getDueDate()));
        WorkTask saved = tasks.save(task);
        syncLinkedIssueAssignment(saved, member, user);
        String timeline = "Assigned directly by " + user.getFullName() + (isBlank(user.getAuthorityTitle()) ? "" : ", " + user.getAuthorityTitle()) + " to " + member.getFullName();
        writeTaskHistory(saved, user, "DIRECT_ADMIN_ASSIGNMENT", null, saved.getStatus(), timeline);
        saveAuditEvent(user, "TASK_DIRECTLY_ASSIGNED", String.valueOf(saved.getId()), timeline);
        overdueReminders.notifyUser(member.getId(), "New task assigned", "Task assigned directly by " + authorityLabel(user) + ": " + saved.getTitle(), "info", "/employee", "direct-task-" + saved.getId());
        notifyDepartmentHead(saved.getDepartment(), saved, user, true);
        emailService.sendTaskAssignmentEmail(member.getEmail(), member.getFullName(), saved.getTitle(), saved.getDescription(), saved.getIssueId(), saved.getPriority(), saved.getDueDate() == null ? null : saved.getDueDate().toString(), authorityLabel(user));
        return ResponseEntity.ok(taskDto(saved));
    }

    private ResponseEntity<?> assignDepartmentTaskMember(Long taskId, Long employeeId, Admin actor, boolean direct) {
        WorkTask task = tasks.findByIdAndOrganizationId(taskId, orgId(actor)).orElse(null);
        Admin member = employeeId == null ? null : accounts.findByIdAndOrganizationId(employeeId, orgId(actor)).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();
        if (member == null || !"EMPLOYEE".equals(member.getRole()) || !member.isApproved() || Boolean.FALSE.equals(member.getAccountActive())
                || member.getDepartment() == null || (task.getDepartment() != null && !Objects.equals(member.getDepartment().getId(), task.getDepartment().getId())))
            return ResponseEntity.badRequest().body(Map.of("message", "Choose an active, approved member of this department"));
        if (task.getDepartment() == null && direct) task.setDepartment(member.getDepartment());
        if (task.getDepartment() == null) return ResponseEntity.badRequest().body(Map.of("message", "Task must be assigned to a department first"));
        if (!"ADMIN".equals(actor.getRole()) && (actor.getDepartment() == null || !Objects.equals(actor.getDepartment().getId(), task.getDepartment().getId())))
            return ResponseEntity.status(403).body(Map.of("message", "You cannot assign a task outside your department"));
        if (!direct && task.isDirectAdminAssignment()) return ResponseEntity.status(403).body(Map.of("message", "Only an Admin can reassign a directly assigned task"));
        String previous = task.getStatus(); task.setEmployee(member); task.setAssignedByHead(direct ? null : actor);
        task.setDirectAdminAssignment(direct); task.setStatus("Assigned");
        WorkTask saved = tasks.save(task);
        syncLinkedIssueAssignment(saved, member, actor);
        String timeline = direct ? "Assigned directly by " + actor.getFullName() + (isBlank(actor.getAuthorityTitle()) ? "" : ", " + actor.getAuthorityTitle()) + " to " + member.getFullName()
                : "Assigned by Department Head " + actor.getFullName() + " to " + member.getFullName();
        writeTaskHistory(saved, actor, direct ? "DIRECT_ADMIN_ASSIGNMENT" : "ASSIGNED_TO_MEMBER", previous, saved.getStatus(), timeline);
        saveAuditEvent(actor, direct ? "TASK_DIRECTLY_ASSIGNED" : "TASK_ASSIGNED_BY_HEAD", String.valueOf(saved.getId()), timeline);
        overdueReminders.notifyUser(member.getId(), "New task assigned", "Task assigned by " + authorityLabel(actor) + ": " + saved.getTitle(), "info", "/employee", "dept-task-" + saved.getId() + "-member");
        if (direct) notifyDepartmentHead(task.getDepartment(), saved, actor, true);
        emailService.sendTaskAssignmentEmail(member.getEmail(), member.getFullName(), saved.getTitle(), saved.getDescription(), saved.getIssueId(), saved.getPriority(), saved.getDueDate() == null ? null : saved.getDueDate().toString(), authorityLabel(actor));
        return ResponseEntity.ok(taskDto(saved));
    }

    @GetMapping("/tasks/{id}/history")
    public ResponseEntity<?> taskTimeline(@PathVariable Long id) {
        Admin user = current();
        WorkTask task = tasks.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();
        if (!"ADMIN".equals(user.getRole()) && (user.getDepartment() == null || task.getDepartment() == null || !Objects.equals(user.getDepartment().getId(), task.getDepartment().getId())))
            return ResponseEntity.status(403).body(Map.of("message", "You cannot view this task timeline"));
        return ResponseEntity.ok(jdbc.queryForList("SELECT h.id,h.action,h.from_status AS \"fromStatus\",h.to_status AS \"toStatus\",h.details,h.\"timestamp\" AS \"timestamp\",concat_ws(', ',a.full_name,NULLIF(CASE WHEN a.role='ADMIN' THEN COALESCE(a.authority_title,a.designation) ELSE a.designation END,'')) AS actor FROM task_history h LEFT JOIN admin_users a ON a.id=h.actor_id WHERE h.task_id=? ORDER BY h.\"timestamp\"", id));
    }

    @PostMapping("/departments/approve-member/{id}")
    @Transactional
    public ResponseEntity<?> approveDepartmentMember(@PathVariable Long id, @RequestBody ApprovalRequest request) {
        Admin actor = current(); Admin target = accounts.findByIdAndOrganizationId(id, orgId(actor)).orElse(null);
        if (target == null || target.getDepartment() == null || !"EMPLOYEE".equals(target.getRole())) return ResponseEntity.notFound().build();
        boolean admin = "ADMIN".equals(actor.getRole());
        if (!admin && (!"HEAD".equals(actor.getDepartmentRole()) || actor.getDepartment() == null || !Objects.equals(actor.getDepartment().getId(), target.getDepartment().getId())))
            return ResponseEntity.status(403).body(Map.of("message", "Only this department's Head or an Admin can approve the member"));
        if ("HEAD".equals(target.getDepartmentRole()) && !admin) return ResponseEntity.status(403).body(Map.of("message", "Department Head signups require Admin approval"));
        String status = safe(request.getStatus(), "APPROVED").toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(status)) return ResponseEntity.badRequest().body(Map.of("message", "Status must be APPROVED or REJECTED"));
        if ("APPROVED".equals(status) && "HEAD".equals(target.getDepartmentRole())) {
            List<Admin> otherHeads = accounts.findAllByOrganizationIdOrderByFullName(orgId(actor)).stream().filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), target.getDepartment().getId()))
                    .filter(a -> "HEAD".equals(a.getDepartmentRole()) && a.isApproved() && !Boolean.FALSE.equals(a.getAccountActive()) && !Objects.equals(a.getId(), target.getId())).toList();
            if (!otherHeads.isEmpty() && !request.isReplaceExistingHead()) return ResponseEntity.status(409).body(Map.of("message", "This department already has an active Head. Set replaceExistingHead to true or reject this request."));
            for (Admin oldHead : otherHeads) { oldHead.setDepartmentRole("MEMBER"); accounts.save(oldHead); }
        }
        target.setApprovalStatus(status); target.setApproved("APPROVED".equals(status)); accounts.save(target);
        saveAuditEvent(actor, "DEPARTMENT_MEMBER_" + status, String.valueOf(target.getId()), "" + target.getFullName() + " " + status.toLowerCase(Locale.ROOT) + " for " + target.getDepartment().getName());
        return ResponseEntity.ok(employeeDto(target));
    }

    private void writeTaskHistory(WorkTask task, Admin actor, String action, String from, String to, String details) {
        jdbc.update("INSERT INTO task_history(task_id,actor_id,action,from_status,to_status,details,\"timestamp\") VALUES(?,?,?,?,?,?,NOW())", task.getId(), actor.getId(), action, from, to, details);
    }

    private void notifyDepartmentHead(Department department, WorkTask task, Admin actor, boolean direct) {
        accounts.findAllByOrganizationIdOrderByFullName(orgId(actor)).stream().filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), department.getId()))
                .filter(a -> "HEAD".equals(a.getDepartmentRole()) && a.isApproved() && !Boolean.FALSE.equals(a.getAccountActive())).forEach(head -> {
                    String message = direct ? "Task directly assigned by " + authorityLabel(actor) + " to " + (task.getEmployee() == null ? "a member" : task.getEmployee().getFullName()) + ": " + task.getTitle()
                            : "A task was assigned to your department by " + authorityLabel(actor) + ": " + task.getTitle();
                    overdueReminders.notifyUser(head.getId(), direct ? "Task assigned directly" : "Task assigned to your department", message, "info", "/employee", "dept-task-" + task.getId() + "-head");
                    emailService.sendTaskAssignmentEmail(head.getEmail(), head.getFullName(), direct ? "Direct assignment notice: " + task.getTitle() : "Department task assigned: " + task.getTitle(), message, task.getIssueId(), task.getPriority(), task.getDueDate() == null ? null : task.getDueDate().toString(), authorityLabel(actor));
                });
    }

    private static Map<String, Object> departmentDto(Department d) { return Map.of("id", d.getId(), "name", d.getName()); }

    @PutMapping("/profile/designation")
    public ResponseEntity<?> updateAuthorityTitle(@RequestBody DesignationRequest request) {
        Admin user = current();
        if (!"ADMIN".equals(user.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Admin access required"));
        String title = safe(request.getDesignation(), "").replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        if (title.isBlank() || title.length() > 100) return ResponseEntity.badRequest().body(Map.of("message", "Designation must be 1 to 100 characters"));
        String previous = user.getAuthorityTitle(); user.setAuthorityTitle(title); user.setDesignation(title); accounts.save(user);
        saveAuditEvent(user, "ADMIN_DESIGNATION_CHANGED", String.valueOf(user.getId()), "Changed authority designation from '" + safe(previous, "") + "' to '" + title + "'.");
        return ResponseEntity.ok(Map.of("authorityTitle", title));
    }

    @GetMapping("/departments/{id}/pending-members")
    public ResponseEntity<?> pendingDepartmentMembers(@PathVariable Long id) {
        Admin user = current();
        if (!"ADMIN".equals(user.getRole()) && (!"HEAD".equals(user.getDepartmentRole()) || user.getDepartment() == null || !Objects.equals(user.getDepartment().getId(), id)))
            return ResponseEntity.status(403).body(Map.of("message", "Only this department's Head or an Admin can view pending members"));
        if (departments.findByIdAndOrganizationId(id, orgId(user)).isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(accounts.findAllByOrganizationIdOrderByFullName(orgId(user)).stream()
                .filter(a -> a.getDepartment() != null && Objects.equals(a.getDepartment().getId(), id) && "PENDING".equals(a.getApprovalStatus()) && "MEMBER".equals(a.getDepartmentRole()))
                .map(OrganizationPortalController::memberDto).toList());
    }
    private static Map<String, Object> memberDto(Admin a) {
        Map<String,Object> dto = new LinkedHashMap<>(); dto.put("id",a.getId()); dto.put("name",a.getFullName()); dto.put("email",a.getEmail());
        dto.put("designation",a.getAuthorityTitle() == null ? a.getDesignation() : a.getAuthorityTitle()); dto.put("role",a.getRole()); dto.put("departmentRole",a.getDepartmentRole()); dto.put("employeeId",a.getEmployeeId()); return dto;
    }

    @GetMapping("/me/organization-members")
    public ResponseEntity<?> organizationMembers() {
        Admin user = current();
        if (!"EMPLOYEE".equals(user.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Employee access required"));
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(accounts.findAllByOrganizationIdOrderByFullName(organizationId).stream()
                .filter(member -> user.getDepartment() == null || (member.getDepartment() != null && Objects.equals(member.getDepartment().getId(), user.getDepartment().getId())))
                .filter(member -> ("ADMIN".equals(member.getRole()) || "EMPLOYEE".equals(member.getRole()))
                        && !Boolean.FALSE.equals(member.getAccountActive())
                        && (!"EMPLOYEE".equals(member.getRole()) || member.isApproved()))
                .map(member -> {
                    Map<String, Object> dto = new LinkedHashMap<>();
                    dto.put("id", member.getId());
                    dto.put("name", member.getFullName());
                    dto.put("designation", member.getDesignation() == null ? "" : member.getDesignation());
                    dto.put("role", member.getRole());
                    dto.put("employeeId", member.getEmployeeId());
                    dto.put("profileImage", member.getProfileImage());
                    dto.put("isCurrentUser", Objects.equals(member.getId(), user.getId()));
                    return dto;
                }).toList());
    }

    @GetMapping("/designations")
    public ResponseEntity<?> designations() {
        Admin user = current();
        Long orgId = orgId(user);
        if ("EMPLOYEE".equals(user.getRole())) {
            if (orgId == null || user.getDesignation() == null) return ResponseEntity.ok(List.of());
            DesignationPermission own = permissions.findByOrganizationIdAndDesignationIgnoreCase(orgId, user.getDesignation()).orElse(null);
            return ResponseEntity.ok(List.of(permissionDto(user.getDesignation(), own)));
        }
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Set<String> names = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        accounts.findAllByOrganizationIdOrderByFullName(orgId).stream()
                .filter(a -> "EMPLOYEE".equals(a.getRole()) && a.isApproved() && a.getDesignation() != null)
                .forEach(a -> names.add(a.getDesignation()));
        Map<String, DesignationPermission> configured = new HashMap<>();
        permissions.findAllByOrganizationIdOrderByDesignation(orgId)
                .forEach(p -> configured.put(p.getDesignation().toLowerCase(Locale.ROOT), p));
        return ResponseEntity.ok(names.stream().map(name -> permissionDto(name, configured.get(name.toLowerCase(Locale.ROOT)))).toList());
    }

    @PatchMapping("/employees/{id}/designation")
    public ResponseEntity<?> employeeDesignation(@PathVariable Long id, @RequestBody DesignationRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (request.getDesignation() == null || request.getDesignation().isBlank() || request.getDesignation().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a designation up to 100 characters"));
        Admin employee = accounts.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (employee == null || !"EMPLOYEE".equals(employee.getRole())) return ResponseEntity.notFound().build();
        employee.setDesignation(request.getDesignation().trim());
        return ResponseEntity.ok(employeeDto(accounts.save(employee)));
    }

    @PatchMapping("/employees/{id}/active")
    public ResponseEntity<?> employeeActive(@PathVariable Long id, @RequestBody ActiveRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Admin employee = accounts.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (employee == null || !"EMPLOYEE".equals(employee.getRole())) return ResponseEntity.notFound().build();
        employee.setAccountActive(request.isActive());
        return ResponseEntity.ok(employeeDto(accounts.save(employee)));
    }

    @PutMapping("/designations/{designation}")
    public ResponseEntity<?> updateDesignation(@PathVariable String designation, @RequestBody PermissionRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (designation.isBlank() || designation.length() > 100)
            return ResponseEntity.badRequest().body(Map.of("message", "Designation must be 1 to 100 characters"));
        Long orgId = orgId(user);
        if (orgId == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        DesignationPermission permission = permissions.findByOrganizationIdAndDesignationIgnoreCase(orgId, designation)
                .orElseGet(() -> {
                    DesignationPermission created = new DesignationPermission();
                    created.setOrganization(user.getOrganization());
                    created.setDesignation(designation.trim());
                    return created;
                });
        permission.setCanReportIssues(request.isCanReportIssues());
        permission.setCanViewAllIssues(request.isCanViewAllIssues());
        permission.setCanUpdateTasks(request.isCanUpdateTasks());
        permission.setCanAssignTasks(request.isCanAssignTasks());
        return ResponseEntity.ok(permissionDto(permission.getDesignation(), permissions.save(permission)));
    }

    private static final Set<String> RBAC_PERMISSIONS = Set.of("ISSUE_REPORT", "ISSUE_VIEW_ALL", "ISSUE_RESOLVE", "TASK_UPDATE", "TASK_ASSIGN");

    @GetMapping({"/admin/roles", "/roles"})
    public ResponseEntity<?> listRoles() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (orgId(user) == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        List<Map<String, Object>> result = jdbc.query(
                "SELECT id, name, description, created_at FROM admin_roles WHERE organization_id=? ORDER BY name",
                (rs, rowNum) -> {
                    Map<String, Object> role = new LinkedHashMap<>();
                    role.put("id", rs.getLong("id")); role.put("name", rs.getString("name"));
                    role.put("description", rs.getString("description"));
                    role.put("permissions", jdbc.queryForList("SELECT permission_key FROM admin_role_permissions WHERE role_id=? ORDER BY permission_key", String.class, rs.getLong("id")));
                    role.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
                    return role;
                }, orgId(user));
        return ResponseEntity.ok(result);
    }

    @PostMapping({"/admin/roles", "/roles"})
    @Transactional
    public ResponseEntity<?> createRole(@RequestBody RoleRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        return saveRole(user, null, request);
    }

    @PutMapping({"/admin/roles/{roleId}", "/roles/{roleId}"})
    @Transactional
    public ResponseEntity<?> updateRole(@PathVariable Long roleId, @RequestBody RoleRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        return saveRole(user, roleId, request);
    }

    private ResponseEntity<?> saveRole(Admin user, Long roleId, RoleRequest request) {
        Long organizationId = orgId(user);
        if (organizationId == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        String name = request.getName() == null ? "" : request.getName().trim();
        if (name.isBlank() || name.length() > 80) return ResponseEntity.badRequest().body(Map.of("message", "Role name must be 1 to 80 characters"));
        Set<String> requested = request.getPermissions() == null ? Set.of() : request.getPermissions().stream()
                .map(value -> value == null ? "" : value.trim().toUpperCase(Locale.ROOT)).collect(java.util.stream.Collectors.toSet());
        if (!RBAC_PERMISSIONS.containsAll(requested)) return ResponseEntity.badRequest().body(Map.of("message", "Permissions must be selected from " + RBAC_PERMISSIONS));
        try {
            if (roleId == null) {
                roleId = jdbc.queryForObject("INSERT INTO admin_roles(organization_id,name,description) VALUES (?,?,?) RETURNING id",
                        Long.class, organizationId, name, request.getDescription());
            } else {
                int changed = jdbc.update("UPDATE admin_roles SET name=?, description=? WHERE id=? AND organization_id=?",
                        name, request.getDescription(), roleId, organizationId);
                if (changed == 0) return ResponseEntity.notFound().build();
            }
            jdbc.update("DELETE FROM admin_role_permissions WHERE role_id=?", roleId);
            for (String permission : requested) jdbc.update("INSERT INTO admin_role_permissions(role_id,permission_key) VALUES (?,?)", roleId, permission);
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            return ResponseEntity.status(409).body(Map.of("message", "A role with that name already exists"));
        }
        saveAuditEvent(user, "RBAC_ROLE_UPDATED", String.valueOf(roleId), "Updated role '" + name + "' permissions: " + requested);
        return ResponseEntity.ok(Map.of("id", roleId, "name", name, "description", request.getDescription() == null ? "" : request.getDescription(), "permissions", requested));
    }

    @DeleteMapping({"/admin/roles/{roleId}", "/roles/{roleId}"})
    @Transactional
    public ResponseEntity<?> deleteRole(@PathVariable Long roleId) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        int deleted = jdbc.update("DELETE FROM admin_roles WHERE id=? AND organization_id=?", roleId, orgId(user));
        if (deleted == 0) return ResponseEntity.notFound().build();
        saveAuditEvent(user, "RBAC_ROLE_REVOKED", String.valueOf(roleId), "Deleted role and revoked it from assigned users.");
        return ResponseEntity.ok(Map.of("status", "deleted", "roleId", roleId));
    }

    @PutMapping("/admin/employees/{id}/access")
    @Transactional
    public ResponseEntity<?> updateEmployeeAccess(@PathVariable Long id, @RequestBody EmployeeAccessRequest request) {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        Long organizationId = orgId(user);
        Admin employee = organizationId == null ? null : accounts.findByIdAndOrganizationId(id, organizationId).orElse(null);
        if (employee == null || !"EMPLOYEE".equals(employee.getRole())) return ResponseEntity.notFound().build();
        Long roleId = request.getRoleId();
        if (roleId != null && jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM admin_roles WHERE id=? AND organization_id=?)", Boolean.class, roleId, organizationId) != Boolean.TRUE)
            return ResponseEntity.badRequest().body(Map.of("message", "Select a role from this organization"));
        Long managerId = request.getManagerId();
        if (managerId != null) {
            Admin manager = accounts.findByIdAndOrganizationId(managerId, organizationId).orElse(null);
            if (manager == null || !"EMPLOYEE".equals(manager.getRole()) || !manager.isApproved() || Boolean.FALSE.equals(manager.getAccountActive()))
                return ResponseEntity.badRequest().body(Map.of("message", "Manager must be an active, approved employee in this organization"));
            if (id.equals(managerId) || isBelow(id, managerId, organizationId))
                return ResponseEntity.badRequest().body(Map.of("message", "This manager selection would create a hierarchy cycle"));
        }
        employee.setRbacRoleId(roleId);
        employee.setRbacEnabled(true);
        employee.setManagerId(managerId);
        accounts.save(employee);
        saveAuditEvent(user, "RBAC_USER_ACCESS_CHANGED", String.valueOf(id), "Updated role and reporting manager for " + employee.getFullName());
        return ResponseEntity.ok(employeeDto(employee));
    }

    @GetMapping("/tasks")
    @Transactional(readOnly = true)
    public ResponseEntity<?> listTasks() {
        Admin user = current();
        if ("EMPLOYEE".equals(user.getRole())) {
            if (orgId(user) == null) return ResponseEntity.ok(List.of());
            Map<Long, WorkTask> visible = new LinkedHashMap<>();
            tasks.findAllByEmployeeIdAndOrganizationIdOrderByCreatedAtDesc(user.getId(), orgId(user)).forEach(task -> visible.put(task.getId(), task));
            if (hasPermission(user, "TASK_ASSIGN"))
                tasks.findAllByCreatedByIdAndOrganizationIdOrderByCreatedAtDesc(user.getId(), orgId(user)).forEach(task -> visible.put(task.getId(), task));
            return ResponseEntity.ok(taskDtos(new ArrayList<>(visible.values())));
        }
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(taskDtos(tasks.findAllByOrganizationIdOrderByCreatedAtDesc(orgId(user))));
    }

    @GetMapping("/tasks/status-board")
    @Transactional(readOnly = true)
    public ResponseEntity<?> organizationTaskStatusBoard() {
        Admin user = current();
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(tasks.findAllByOrganizationIdOrderByCreatedAtDesc(orgId(user)).stream().limit(500).map(task -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", task.getId()); item.put("title", task.getTitle());
            item.put("status", "Assigned to Member".equalsIgnoreCase(task.getStatus()) ? "Assigned" : task.getStatus());
            item.put("employeeName", task.getEmployee() == null ? "Unassigned" : task.getEmployee().getFullName());
            item.put("departmentName", task.getDepartment() == null ? "" : task.getDepartment().getName());
            item.put("priority", task.getPriority()); item.put("dueDate", task.getDueDate() == null ? "" : task.getDueDate().toString());
            item.put("updatedAt", task.getUpdatedAt().toString());
            return item;
        }).toList());
    }

    @GetMapping("/tasks/history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> organizationTaskHistory() {
        Admin user = current();
        ResponseEntity<?> denied = requireAdmin(user);
        if (denied != null) return denied;
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(history.findAllByOrganizationIdOrderByChangedAtDesc(orgId(user)).stream().map(event -> Map.of(
                "id", event.getId(), "taskId", event.getTask().getId(), "taskTitle", event.getTask().getTitle(),
                "status", event.getStatus(), "changedAt", event.getChangedAt().toString(), "actor", event.getActor().getFullName(),
                "employeeName", event.getTask().getEmployee() == null ? "Unassigned" : event.getTask().getEmployee().getFullName())).toList());
    }

    @PostMapping({"/tasks", "/tasks/assign"})
    public ResponseEntity<?> createTask(@RequestBody CreateTaskRequest request) {
        Admin user = current();
        boolean employeeActor = "EMPLOYEE".equals(user.getRole());
        if (employeeActor && !hasPermission(user, "TASK_ASSIGN"))
            return ResponseEntity.status(403).body(Map.of("message", "Your role does not allow task assignment"));
        if (!employeeActor) {
            ResponseEntity<?> denied = requireAdmin(user);
            if (denied != null) return denied;
        }
        if (orgId(user) == null) return ResponseEntity.badRequest().body(Map.of("message", "Account is not linked to an organization"));
        if (request.getTitle() == null || request.getTitle().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Task title is required"));
        if (request.getTitle().trim().length() > 160)
            return ResponseEntity.badRequest().body(Map.of("message", "Task title must be 160 characters or fewer"));
        Admin employee = null;
        if (request.getEmployeeId() != null) employee = accounts.findByIdAndOrganizationId(request.getEmployeeId(), orgId(user)).orElse(null);
        else if (request.getDesignation() != null) employee = accounts.findAllByOrganizationIdOrderByFullName(orgId(user)).stream()
                .filter(a -> "EMPLOYEE".equals(a.getRole()) && a.isApproved() && request.getDesignation().equalsIgnoreCase(a.getDesignation()))
                .filter(a -> !Boolean.FALSE.equals(a.getAccountActive()))
                .findFirst().orElse(null);
        if (employee == null || !"EMPLOYEE".equals(employee.getRole()) || !employee.isApproved())
            return ResponseEntity.badRequest().body(Map.of("message", "Choose an approved employee in your organization"));
        if (Boolean.FALSE.equals(employee.getAccountActive()))
            return ResponseEntity.badRequest().body(Map.of("message", "Choose an active employee"));
        if (employeeActor && user.getDepartment() != null && (employee.getDepartment() == null || !Objects.equals(employee.getDepartment().getId(), user.getDepartment().getId())))
            return ResponseEntity.status(403).body(Map.of("message", "You can assign tasks only within your department"));
        WorkTask parent = null;
        if (employeeActor) {
            if (!isBelow(user.getId(), employee.getId(), orgId(user)))
                return ResponseEntity.status(403).body(Map.of("message", "You may only assign tasks to employees below you in the organization hierarchy"));
            if (request.getParentTaskId() == null)
                return ResponseEntity.badRequest().body(Map.of("message", "Delegated tasks must reference the task assigned to you"));
            parent = tasks.findByIdAndOrganizationId(request.getParentTaskId(), orgId(user)).orElse(null);
            if (parent == null) return ResponseEntity.notFound().build();
            if (!parent.getEmployee().getId().equals(user.getId()))
                return ResponseEntity.status(403).body(Map.of("message", "You can only delegate a task that is currently assigned to you"));
            if ("Resolved".equalsIgnoreCase(parent.getStatus()))
                return ResponseEntity.badRequest().body(Map.of("message", "A resolved task cannot be delegated"));
        } else if (request.getParentTaskId() != null) {
            parent = tasks.findByIdAndOrganizationId(request.getParentTaskId(), orgId(user)).orElse(null);
            if (parent == null) return ResponseEntity.notFound().build();
        }
        WorkTask task = new WorkTask();
        task.setOrganization(user.getOrganization());
        task.setEmployee(employee);
        task.setDepartment(employee.getDepartment());
        task.setDirectAdminAssignment(!employeeActor && employee.getDepartment() != null);
        if (employee.getDepartment() != null) task.setStatus("Assigned");
        task.setCreatedBy(user);
        task.setParentTask(parent);
        task.setTitle(request.getTitle().trim());
        task.setDescription(request.getDescription());
        task.setIssueId(request.getIssueId());
        if (request.getPriority() != null && Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(request.getPriority().toUpperCase(Locale.ROOT)))
            task.setPriority(request.getPriority().substring(0, 1).toUpperCase(Locale.ROOT) + request.getPriority().substring(1).toLowerCase(Locale.ROOT));
        if (request.getDueDate() != null && !request.getDueDate().isBlank()) task.setDueDate(java.time.LocalDate.parse(request.getDueDate()));
        WorkTask saved = tasks.save(task);
        saveHistory(saved, user, saved.getStatus());
        String directTimeline = "Assigned directly by " + user.getFullName() + (isBlank(user.getAuthorityTitle()) ? "" : ", " + user.getAuthorityTitle()) + " to " + employee.getFullName();
        writeTaskHistory(saved, user, employeeActor ? "ASSIGNED_TO_MEMBER" : "DIRECT_ADMIN_ASSIGNMENT", null, saved.getStatus(), employeeActor ? "Assigned by " + user.getFullName() + " to " + employee.getFullName() : directTimeline);
        saveAuditEvent(user, "TASK_ASSIGNED", String.valueOf(saved.getId()),
                "Assigned task '" + saved.getTitle() + "' to " + employee.getFullName() + (saved.getIssueId() == null ? "" : " for issue " + saved.getIssueId()));
        String assignedMessage = "Task '" + saved.getTitle() + "' was assigned by " + authorityLabel(user) + " to " + employee.getFullName() + ".";
        String assignmentKey = "task-assigned:" + saved.getId();
        overdueReminders.notifyUser(employee.getId(), "New task assigned", assignedMessage, "info", "/employee", assignmentKey);
        overdueReminders.notifyOrganizationAdmins(orgId(user), "Task assigned", assignedMessage, "info", "/admin/tasks", assignmentKey);
        if (!employeeActor && employee.getDepartment() != null) notifyDepartmentHead(employee.getDepartment(), saved, user, true);
        try {
            emailService.sendTaskAssignmentEmail(employee.getEmail(), employee.getFullName(), saved.getTitle(),
                    saved.getDescription(), saved.getIssueId(), saved.getPriority(),
                    saved.getDueDate() == null ? null : saved.getDueDate().toString(), authorityLabel(user));
        } catch (Exception ex) {
            log.warn("Task {} was saved, but assignment email to employee {} could not be sent: {}",
                    saved.getId(), employee.getId(), ex.getMessage());
        }
        return ResponseEntity.ok(taskDto(saved));
    }

    @PatchMapping("/tasks/{id}/status")
    public ResponseEntity<?> updateTask(@PathVariable Long id, @RequestBody StatusRequest request) {
        Admin user = current();
        WorkTask task;
        if ("EMPLOYEE".equals(user.getRole())) {
            if (!hasPermission(user, "TASK_UPDATE"))
                return ResponseEntity.status(403).body(Map.of("message", "Your role does not allow task updates"));
            task = tasks.findByIdAndEmployeeIdAndOrganizationId(id, user.getId(), orgId(user)).orElse(null);
        } else task = tasks.findByIdAndOrganizationId(id, orgId(user)).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();
        String requestedStatus = request.getStatus() == null ? "" : request.getStatus().trim().toUpperCase(Locale.ROOT);
        if ("EMPLOYEE".equals(user.getRole()) && !Set.of("IN PROGRESS", "RESOLVED").contains(requestedStatus))
            return ResponseEntity.badRequest().body(Map.of("message", "Employees can set task status to In Progress or Resolved"));
        if (!"EMPLOYEE".equals(user.getRole()) && !Set.of("ASSIGNED", "ASSIGNED TO MEMBER", "IN PROGRESS", "RESOLVED", "CANCELLED").contains(requestedStatus))
            return ResponseEntity.badRequest().body(Map.of("message", "Status must be Assigned, In Progress, Resolved, or Cancelled"));
        String previousStatus = task.getStatus();
        task.setStatus(switch (requestedStatus) {
            case "ASSIGNED", "ASSIGNED TO MEMBER" -> "Assigned";
            case "IN PROGRESS" -> "In Progress";
            case "RESOLVED" -> "Resolved";
            case "CANCELLED" -> "Cancelled";
            default -> throw new IllegalStateException("Validated task status was not mapped");
        });
        task.setUpdatedAt(Instant.now());
        WorkTask saved = tasks.save(task);
        saveHistory(saved, user, saved.getStatus());
        writeTaskHistory(saved, user, "STATUS_CHANGED", previousStatus, saved.getStatus(), user.getFullName() + " changed status to " + saved.getStatus());
        if ("Resolved".equals(saved.getStatus()) && !isBlank(saved.getIssueId())) {
            try {
                jdbc.update("UPDATE issues SET metadata_json=jsonb_set(jsonb_set(COALESCE(NULLIF(metadata_json,''),'{}')::jsonb,'{status}','\"Resolved\"'::jsonb,true),'{resolved_at}',to_jsonb(NOW()::text),true)::text WHERE id=?", saved.getIssueId());
            } catch (Exception ex) { log.warn("Task {} was resolved, but linked issue {} could not be synchronized: {}", saved.getId(), saved.getIssueId(), ex.getMessage()); }
        }
        saveAuditEvent(user, "TASK_STATUS_CHANGED", String.valueOf(saved.getId()),
                user.getFullName() + " changed task '" + saved.getTitle() + "' status to " + saved.getStatus());
        String changedMessage = "Task '" + saved.getTitle() + "' is now " + saved.getStatus() + ".";
        String statusKey = "task-status:" + saved.getId() + ":" + saved.getUpdatedAt().toEpochMilli();
        if (saved.getEmployee() != null) overdueReminders.notifyUser(saved.getEmployee().getId(), "Task updated", changedMessage, "info", "/employee", statusKey);
        overdueReminders.notifyOrganizationAdmins(saved.getOrganization() == null ? null : saved.getOrganization().getId(), "Task updated", changedMessage, "info", "/admin/tasks", statusKey);
        return ResponseEntity.ok(taskDto(saved));
    }

    @GetMapping("/me/history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> taskHistory() {
        Admin user = current();
        if (!"EMPLOYEE".equals(user.getRole())) return ResponseEntity.status(403).body(Map.of("message", "Employee access required"));
        if (orgId(user) == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(history.findEmployeeHistoryForOrganization(user.getId(), orgId(user)).stream().map(event -> Map.of(
                "id", event.getId(), "taskId", event.getTask().getId(), "taskTitle", event.getTask().getTitle(),
                "status", event.getStatus(), "changedAt", event.getChangedAt().toString(), "actor", event.getActor().getFullName()
        )).toList());
    }

    private void saveHistory(WorkTask task, Admin actor, String status) {
        TaskStatusHistory event = new TaskStatusHistory();
        event.setOrganization(task.getOrganization());
        event.setTask(task);
        event.setActor(actor);
        event.setStatus(status);
        history.save(event);
    }

    private void syncLinkedIssueAssignment(WorkTask task, Admin employee, Admin actor) {
        if (task == null || isBlank(task.getIssueId())) return;
        String employeeName = employee == null ? "Department: " + task.getDepartment().getName() : employee.getFullName();
        String eventNote = employee == null
                ? "Issue assigned to " + task.getDepartment().getName() + "; awaiting department member assignment."
                : "Department task assigned to " + employee.getFullName() + ".";
        try {
            int updated = jdbc.update("""
                    UPDATE issues
                    SET metadata_json = (
                        COALESCE(NULLIF(metadata_json, ''), '{}')::jsonb
                        || jsonb_build_object(
                            'status', 'Assigned',
                            'assignedEmployeeId', ?::bigint,
                            'assignedEmployeeName', ?,
                            'assignedDepartmentId', ?::bigint,
                            'assignedDepartmentName', ?,
                            'last_updated', NOW()::text)
                        || jsonb_build_object(
                            'task_history',
                            COALESCE(NULLIF(metadata_json, '')::jsonb -> 'task_history', '[]'::jsonb)
                            || jsonb_build_array(jsonb_build_object(
                                'timestamp', NOW()::text, 'status', 'Assigned', 'actor', ?, 'note', ?)))
                    )::text
                    WHERE id = ?
                    """, employee == null ? null : employee.getId(), employeeName,
                    task.getDepartment() == null ? null : task.getDepartment().getId(),
                    task.getDepartment() == null ? "" : task.getDepartment().getName(),
                    actor == null ? "System" : actor.getFullName(), eventNote, task.getIssueId());
            if (updated == 0) log.warn("Task {} references issue {}, but that issue was not found for assignment sync", task.getId(), task.getIssueId());
        } catch (Exception ex) {
            log.warn("Task {} was assigned, but linked issue {} could not be synchronized: {}", task.getId(), task.getIssueId(), ex.getMessage());
        }
    }

    private void saveAuditEvent(Admin actor, String eventType, String target, String description) {
        Long organizationId = orgId(actor);
        if (organizationId == null) return;
        jdbc.update("INSERT INTO audit_events(organization_id, actor, event_type, target_entity, description, result) VALUES (?, ?, ?, ?, ?, 'SUCCESS')",
                organizationId, actor.getFullName(), eventType, target, description);
    }

    private static List<Map<String, Object>> taskDtos(List<WorkTask> list) { return list.stream().map(OrganizationPortalController::taskDto).toList(); }
    private String effectiveOrganizationEmailPattern(Organization organization, Admin organizationAdmin) {
        String configured = organization.getEmployeeEmailPattern();
        if (!isBlank(configured) && !"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$".equals(configured)) return configured;
        Admin owner = organizationAdmin;
        if (owner == null || owner.getOrganization() == null || !Objects.equals(owner.getOrganization().getId(), organization.getId()))
            owner = accounts.findAllByOrganizationIdOrderByFullName(organization.getId()).stream()
                    .filter(account -> "ADMIN".equalsIgnoreCase(account.getRole()) && !isBlank(account.getEmail())).findFirst().orElse(null);
        String email = owner == null ? null : owner.getEmail();
        int at = email == null ? -1 : email.lastIndexOf('@');
        return at <= 0 || at == email.length() - 1 ? null
                : "^[^\\s@]+@" + Pattern.quote(email.substring(at + 1).trim()) + "$";
    }
    private static Map<String, Object> taskDto(WorkTask t) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", t.getId()); dto.put("title", t.getTitle());
        dto.put("description", t.getDescription() == null ? "" : t.getDescription());
        dto.put("issueId", t.getIssueId() == null ? "" : t.getIssueId()); dto.put("status", "Assigned to Member".equalsIgnoreCase(t.getStatus()) ? "Assigned" : t.getStatus());
        dto.put("employeeId", t.getEmployee() == null ? null : t.getEmployee().getId()); dto.put("priority", t.getPriority());
        dto.put("dueDate", t.getDueDate() == null ? "" : t.getDueDate().toString());
        dto.put("employeeName", t.getEmployee() == null ? "Unassigned to member" : t.getEmployee().getFullName());
        dto.put("designation", t.getEmployee() == null || t.getEmployee().getDesignation() == null ? "" : t.getEmployee().getDesignation());
        dto.put("departmentId", t.getDepartment() == null ? null : t.getDepartment().getId());
        dto.put("departmentName", t.getDepartment() == null ? "" : t.getDepartment().getName());
        dto.put("directAdminAssignment", t.isDirectAdminAssignment());
        dto.put("assignedByHead", t.getAssignedByHead() == null ? null : t.getAssignedByHead().getFullName());
        dto.put("createdById", t.getCreatedBy() == null ? null : t.getCreatedBy().getId());
        dto.put("createdByName", t.getCreatedBy() == null ? "" : t.getCreatedBy().getFullName());
        dto.put("parentTaskId", t.getParentTask() == null ? null : t.getParentTask().getId());
        dto.put("createdAt", t.getCreatedAt().toString()); dto.put("updatedAt", t.getUpdatedAt().toString());
        return dto;
    }
    private static String authorityLabel(Admin actor) {
        String title = "ADMIN".equals(actor.getRole()) ? actor.getAuthorityTitle() : actor.getDesignation();
        return actor.getFullName() + (isBlank(title) ? "" : ", " + title);
    }
    private static Map<String, Object> employeeDto(Admin a) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", a.getId()); dto.put("fullName", a.getFullName()); dto.put("email", a.getEmail()); dto.put("employeeId", a.getEmployeeId());
        dto.put("designation", a.getDesignation() == null ? "" : a.getDesignation());
        dto.put("authorityTitle", a.getAuthorityTitle());
        dto.put("departmentId", a.getDepartment() == null ? null : a.getDepartment().getId());
        dto.put("departmentName", a.getDepartment() == null ? "" : a.getDepartment().getName());
        dto.put("departmentRole", a.getDepartmentRole());
        dto.put("roleId", a.getRbacRoleId()); dto.put("rbacEnabled", a.isRbacEnabled()); dto.put("managerId", a.getManagerId());
        dto.put("approvalStatus", a.getApprovalStatus() == null ? "PENDING" : a.getApprovalStatus());
        dto.put("approved", a.isApproved()); dto.put("accountActive", !Boolean.FALSE.equals(a.getAccountActive()));
        dto.put("profileImage", a.getProfileImage());
        dto.put("organizationId", a.getOrganization() == null ? null : a.getOrganization().getId());
        dto.put("organizationName", a.getOrganization() == null ? "Awaiting organization approval" : a.getOrganization().getName());
        dto.put("organizationChangeStatus", a.getOrganizationChangeStatus() == null ? "" : a.getOrganizationChangeStatus());
        dto.put("pendingOrganizationName", a.getPendingOrganization() == null ? "" : a.getPendingOrganization().getName());
        return dto;
    }
    private static Map<String, Object> permissionDto(String designation, DesignationPermission p) {
        if (p == null) return Map.of("designation", designation, "canReportIssues", true, "canViewAllIssues", false,
                "canUpdateTasks", true, "canAssignTasks", false);
        return Map.of("designation", designation, "canReportIssues", p.isCanReportIssues(), "canViewAllIssues", p.isCanViewAllIssues(),
                "canUpdateTasks", p.isCanUpdateTasks(), "canAssignTasks", p.isCanAssignTasks());
    }

    @Data public static class ApprovalRequest { private String status; private boolean replaceExistingHead; private String accountRole; private String authorityType; private String authorityTitle; }
    @Data public static class ProfileImageRequest { private String profileImage; }
    @Data public static class JoinCodeRequest { private String joinCode; }
    @Data public static class UsernameRequest { private String username; }
    @Data public static class PasswordChangeRequest { private String otp; private String newPassword; }
    @Data public static class DesignationRequest { private String designation; }
    @Data public static class ActiveRequest { private boolean active; }
    @Data public static class AuditEventRequest { private String actor; private String eventType; private String targetEntity; private String description; private String result; }
    @Data public static class EmailPatternRequest { private String pattern; }
    @Data public static class PermissionRequest { private boolean canReportIssues; private boolean canViewAllIssues; private boolean canUpdateTasks; private boolean canAssignTasks; }
    @Data public static class RoleRequest { private String name; private String description; private Set<String> permissions; }
    @Data public static class EmployeeAccessRequest { private Long roleId; private Long managerId; }
    @Data public static class CreateTaskRequest { private String title; private String description; private String issueId; private Long employeeId; private Long parentTaskId; private String designation; private String priority; private String dueDate; }
    @Data public static class DepartmentRequest { private Long id; private String name; }
    @Data public static class DepartmentTaskRequest { private Long taskId; private Long departmentId; private Long employeeId; private String title; private String description; private String issueId; private String priority; private String dueDate; }
    @Data public static class StatusRequest { private String status; }
}
