package com.roadguard.admin.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/** Sends RoadGuard transactional email through Brevo's HTTPS API. */
@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

    private final RestClient restClient;

    @Value("${brevo.api-key:}")
    private String apiKey;

    @Value("${brevo.sender-email:}")
    private String senderEmail;

    @Value("${brevo.sender-name:RoadGuard}")
    private String senderName;

    public EmailService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public void sendOtpEmail(String toEmail, String otpCode) {
        String body = "Your RoadGuard verification code is: " + otpCode + "\n"
                + "It will expire in 5 minutes.\n\n"
                + "If you did not request this, you can safely ignore this email.";
        send(toEmail, "RoadGuard – Your One-Time Password (OTP)", body);
    }

    public void sendOverdueIssueReminder(String toEmail, String adminName, String issueId,
                                         String issueType, String location, String reportedAt) {
        if (toEmail == null || toEmail.isBlank()) throw new IllegalStateException("Admin email is not configured");
        String body = "Hello " + (adminName == null ? "Admin" : adminName) + ",\n\n"
                + "Issue " + issueId + " (" + issueType + ") has been unattended for more than 2 days.\n"
                + "Location: " + location + "\nReported at: " + reportedAt + "\n\n"
                + "Please review it in the RoadGuard admin dashboard.";
        send(toEmail, "RoadGuard reminder: issue unattended for over 2 days", body);
    }

    @Async
    public void sendTaskAssignmentEmail(String toEmail, String employeeName, String taskTitle,
                                        String description, String issueId, String priority, String dueDate,
                                        String assignedBy) {
        try {
            if (toEmail == null || toEmail.isBlank()) throw new IllegalStateException("Employee email is not configured");
            StringBuilder body = new StringBuilder("Hello ").append(employeeName == null ? "Employee" : employeeName).append(",\n\n")
                    .append("A new task has been assigned to you in RoadGuard.\n\n")
                    .append("Task: ").append(taskTitle).append("\n")
                    .append("Priority: ").append(priority == null || priority.isBlank() ? "Medium" : priority).append("\n");
            if (description != null && !description.isBlank()) body.append("Details: ").append(description).append("\n");
            if (issueId != null && !issueId.isBlank()) body.append("Related issue: ").append(issueId).append("\n");
            if (dueDate != null && !dueDate.isBlank()) body.append("Due date: ").append(dueDate).append("\n");
            if (assignedBy != null && !assignedBy.isBlank()) body.append("Assigned by: ").append(assignedBy).append("\n");
            body.append("\nPlease sign in to RoadGuard to review and update your task.");
            send(toEmail, "RoadGuard task assigned: " + taskTitle, body.toString());
        } catch (Exception ex) {
            log.warn("Could not send task assignment email to {}: {}", toEmail, ex.getMessage());
        }
    }

    private void send(String toEmail, String subject, String text) {
        if (apiKey == null || apiKey.isBlank()) throw new IllegalStateException("BREVO_API_KEY is not configured");
        if (senderEmail == null || senderEmail.isBlank()) throw new IllegalStateException("BREVO_SENDER_EMAIL is not configured");

        Map<String, Object> payload = Map.of(
                "sender", Map.of("name", senderName, "email", senderEmail),
                "to", List.of(Map.of("email", toEmail)),
                "subject", subject,
                "textContent", text
        );

        restClient.post()
                .uri(BREVO_SEND_URL)
                .header("api-key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
    }
}
