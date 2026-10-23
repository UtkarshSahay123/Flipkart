package com.roadguard.admin.controller;

import com.roadguard.admin.Admin;
import com.roadguard.admin.service.RbacService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/** Spring Boot REST façade for the issue/map/Chitti service maintained by FastAPI. */
@RestController
@RequestMapping("/api")
public class RestCompatibilityController {
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final String issueService;
    private final RbacService rbac;
    private final JdbcTemplate jdbc;

    public RestCompatibilityController(
            RbacService rbac,
            JdbcTemplate jdbc,
            @Value("${ROADGUARD_PYTHON_API_BASE_URL:http://127.0.0.1:8001}") String issueService) {
        this.rbac = rbac;
        this.jdbc = jdbc;
        this.issueService = issueService.replaceAll("/+$", "");
    }

    @GetMapping("/issues")
    public ResponseEntity<byte[]> listIssues(HttpServletRequest request) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_VIEW_ALL");
        if (denied != null) return denied;
        return forward(HttpMethod.GET, "/api/issues", request.getQueryString(), null, null);
    }

    @GetMapping("/portal/issues")
    public ResponseEntity<byte[]> listPortalIssues(HttpServletRequest request) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_VIEW_ALL");
        if (denied != null) return denied;
        return forward(HttpMethod.GET, "/api/issues", request.getQueryString(), null, null);
    }

    @PostMapping("/portal/issues/{issueId}/resolve")
    public ResponseEntity<?> resolvePortalIssue(@PathVariable String issueId,
            @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_RESOLVE");
        if (denied != null) return denied;
        String notes = body == null || body.get("resolutionNotes") == null ? "" : String.valueOf(body.get("resolutionNotes"));
        String resolutionDate = body == null || body.get("resolutionDate") == null ? "" : String.valueOf(body.get("resolutionDate"));
        String actor = body == null || body.get("actor") == null ? "Employee" : String.valueOf(body.get("actor"));
        int updated = jdbc.update("""
                UPDATE issues SET metadata_json = (
                    COALESCE(NULLIF(metadata_json, ''), '{}')::jsonb
                    || jsonb_build_object(
                        'status', 'Resolved',
                        'resolved_at', NOW()::text,
                        'resolutionDate', COALESCE(NULLIF(?::text, ''), NOW()::text),
                        'resolutionNotes', ?::text,
                        'resolution_actor', ?::text,
                        'last_updated', NOW()::text)
                )::text WHERE id = ?
                """, resolutionDate, notes, actor, issueId);
        if (updated == 0) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("status", "resolved", "issueId", issueId));
    }

    @PostMapping("/issues")
    public ResponseEntity<byte[]> createIssue(@RequestBody(required = false) byte[] body,
                                               @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_REPORT");
        if (denied != null) return denied;
        return forward(HttpMethod.POST, "/api/issues", null, body, contentType);
    }

    @GetMapping("/issues/{issueId}")
    public ResponseEntity<byte[]> issueDetail(@PathVariable String issueId) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_VIEW_ALL");
        if (denied != null) return denied;
        return forward(HttpMethod.GET, "/api/issues/" + encodePath(issueId), null, null, null);
    }

    @PostMapping("/issues/{issueId}/resolve")
    public ResponseEntity<byte[]> resolveIssue(@PathVariable String issueId, @RequestBody(required = false) byte[] body,
                                                @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_RESOLVE");
        if (denied != null) return denied;
        return forward(HttpMethod.POST, "/api/issues/" + encodePath(issueId) + "/resolve", null, body, contentType);
    }

    @PostMapping("/issues/{issueId}/report")
    public ResponseEntity<byte[]> reportIssue(@PathVariable String issueId, @RequestBody(required = false) byte[] body,
                                               @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType) {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_REPORT");
        if (denied != null) return denied;
        return forward(HttpMethod.POST, "/api/issues/" + encodePath(issueId) + "/report", null, body, contentType);
    }

    @GetMapping("/map/markers")
    public ResponseEntity<byte[]> mapMarkers() {
        ResponseEntity<byte[]> denied = requirePermission("ISSUE_VIEW_ALL");
        if (denied != null) return denied;
        return forward(HttpMethod.GET, "/api/map/markers", null, null, null);
    }

    private ResponseEntity<byte[]> requirePermission(String permission) {
        Admin user = rbac.currentUser();
        if (rbac.hasPermission(user, permission)) return null;
        byte[] body = ("{\"message\":\"Permission denied: " + permission + "\"}").getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.status(403).contentType(MediaType.APPLICATION_JSON).body(body);
    }

    @GetMapping("/chitti/query")
    public ResponseEntity<byte[]> chittiQuery(HttpServletRequest request) {
        return forward(HttpMethod.GET, "/api/chitti/query", request.getQueryString(), null, null);
    }

    private ResponseEntity<byte[]> forward(HttpMethod method, String path, String query, byte[] body, String contentType) {
        try {
            String url = issueService + path + (query == null || query.isBlank() ? "" : "?" + query);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(25));
            if (contentType != null && !contentType.isBlank()) builder.header(HttpHeaders.CONTENT_TYPE, contentType);
            HttpRequest.BodyPublisher publisher = body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body);
            HttpResponse<byte[]> response = client.send(builder.method(method.name(), publisher).build(), HttpResponse.BodyHandlers.ofByteArray());
            String responseType = response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse(MediaType.APPLICATION_JSON_VALUE);
            return ResponseEntity.status(response.statusCode()).header(HttpHeaders.CONTENT_TYPE, responseType).body(response.body());
        } catch (Exception ex) {
            byte[] message = "{\"detail\":\"Issue and Chitti services are temporarily unavailable.\"}".getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.status(502).contentType(MediaType.APPLICATION_JSON).body(message);
        }
    }

    private static String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
