package com.roadguard.admin.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Simple service that sends a plain‑text OTP e‑mail using the Gmail SMTP
 * configuration defined in {@code application.properties}.
 */
@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private Environment env; // to read spring.mail.username

    /**
     * Sends an OTP code to the specified e‑mail address.
     *
     * @param toEmail recipient address
     * @param otpCode the 6‑digit code
     */
    public void sendOtpEmail(String toEmail, String otpCode) {
        SimpleMailMessage message = new SimpleMailMessage();
        // "From" will be the Gmail address configured in application.properties
        String from = env.getProperty("spring.mail.username");
        if (from == null || from.isBlank()) {
            throw new IllegalStateException("MAIL_USERNAME is not configured for the admin backend");
        }
        message.setFrom(from);
        message.setTo(toEmail);
        message.setSubject("RoadGuard – Your One‑Time‑Password (OTP)");
        message.setText(
                "Your RoadGuard verification code is: " + otpCode + "\n" +
                "It will expire in 5 minutes.\n\n" +
                "If you did not request this, you can safely ignore this e‑mail."
        );
        mailSender.send(message);
    }

    public void sendOverdueIssueReminder(String toEmail, String adminName, String issueId,
                                         String issueType, String location, String reportedAt) {
        if (toEmail == null || toEmail.isBlank()) throw new IllegalStateException("Admin email is not configured");
        String from = env.getProperty("spring.mail.username");
        if (from == null || from.isBlank()) throw new IllegalStateException("MAIL_USERNAME is not configured for the admin backend");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(toEmail);
        message.setSubject("RoadGuard reminder: issue unattended for over 2 days");
        message.setText("Hello " + (adminName == null ? "Admin" : adminName) + ",\n\n"
                + "Issue " + issueId + " (" + issueType + ") has been unattended for more than 2 days.\n"
                + "Location: " + location + "\nReported at: " + reportedAt + "\n\n"
                + "Please review it in the RoadGuard admin dashboard.");
        mailSender.send(message);
    }

    @Async
    public void sendTaskAssignmentEmail(String toEmail, String employeeName, String taskTitle,
                                        String description, String issueId, String priority, String dueDate,
                                        String assignedBy) {
        try {
            if (toEmail == null || toEmail.isBlank()) throw new IllegalStateException("Employee email is not configured");
            String from = env.getProperty("spring.mail.username");
            if (from == null || from.isBlank()) throw new IllegalStateException("MAIL_USERNAME is not configured for the admin backend");
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(toEmail);
            message.setSubject("RoadGuard task assigned: " + taskTitle);
            StringBuilder body = new StringBuilder("Hello ").append(employeeName == null ? "Employee" : employeeName).append(",\n\n")
                    .append("A new task has been assigned to you in RoadGuard.\n\n")
                    .append("Task: ").append(taskTitle).append("\n")
                    .append("Priority: ").append(priority == null || priority.isBlank() ? "Medium" : priority).append("\n");
            if (description != null && !description.isBlank()) body.append("Details: ").append(description).append("\n");
            if (issueId != null && !issueId.isBlank()) body.append("Related issue: ").append(issueId).append("\n");
            if (dueDate != null && !dueDate.isBlank()) body.append("Due date: ").append(dueDate).append("\n");
            if (assignedBy != null && !assignedBy.isBlank()) body.append("Assigned by: ").append(assignedBy).append("\n");
            body.append("\nPlease sign in to RoadGuard to review and update your task.");
            message.setText(body.toString());
            mailSender.send(message);
        } catch (Exception ex) {
            log.warn("Could not send task assignment email to {}: {}", toEmail, ex.getMessage());
        }
    }
}
