package com.roadguard.admin.controller;

import com.roadguard.admin.Admin;
import com.roadguard.admin.repository.AdminRepository;
import com.roadguard.admin.Organization;
import com.roadguard.admin.repository.OrganizationRepository;
import com.roadguard.admin.repository.DepartmentRepository;
import com.roadguard.admin.Department;
import com.roadguard.admin.service.EmailService;
import com.roadguard.admin.service.PasswordOtpService;
import com.roadguard.admin.service.AccessTokenService;
import com.roadguard.admin.service.BurstRateLimiter;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final long OTP_TTL_SECONDS = 5 * 60;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final ConcurrentMap<String, OtpChallenge> otpChallenges = new ConcurrentHashMap<>();

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordOtpService passwordOtpService;

    @Autowired
    private AccessTokenService accessTokens;

    @Autowired
    private BurstRateLimiter rateLimiter;

    @Autowired
    private Environment environment;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7))
            accessTokens.revoke(authorization.substring(7).trim());
        return ResponseEntity.ok(Map.of("message", "Signed out"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7))
            return ResponseEntity.status(401).body(Map.of("message", "Sign in again to continue"));
        try {
            String username = accessTokens.subject(authorization.substring(7).trim());
            Admin account = adminRepository.findByEmail(normalizeEmail(username)).orElse(null);
            if (account == null || !account.isEnabled()
                    || ("EMPLOYEE".equals(account.getRole()) && !account.isApproved()))
                return ResponseEntity.status(401).body(Map.of("message", "Your account can no longer sign in"));
            return ResponseEntity.ok(Map.of("accessToken", accessTokens.create(username),
                    "expiresIn", accessTokens.ttlSeconds()));
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException ex) {
            return ResponseEntity.status(401).body(Map.of("message", "Your session expired. Sign in again."));
        }
    }

    @PostMapping("/password/otp/send")
    public ResponseEntity<?> sendPasswordOtp(@RequestBody PasswordOtpRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getEmail()))
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid email address"));
        if (!allowOtpSend(httpRequest, request.getEmail(), "reset"))
            return ResponseEntity.status(429).body(Map.of("message", "Too many verification requests. Please wait before trying again."));
        Admin account = adminRepository.findByEmail(normalizeEmail(request.getEmail())).orElse(null);
        // Keep the response identical whether or not the address has an account.
        if (account != null) {
            String code = passwordOtpService.issue(account.getEmail(), "RESET");
            try { emailService.sendOtpEmail(account.getEmail(), code); }
            catch (RestClientException | IllegalStateException ex) {
                passwordOtpService.clear(account.getEmail(), "RESET");
                logger.error("Password reset OTP delivery failed", ex);
                return ResponseEntity.internalServerError().body(Map.of("message", "Unable to send verification code"));
            }
        }
        return ResponseEntity.ok(Map.of("message", "If an account exists for that email, a verification code has been sent"));
    }

    @PostMapping("/password/reset")
    public ResponseEntity<?> resetPassword(@RequestBody PasswordResetRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getEmail()))
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid email address"));
        String email = normalizeEmail(request.getEmail());
        if (!allowOtpAttempt(httpRequest, email, "reset"))
            return ResponseEntity.status(429).body(Map.of("message", "Too many verification attempts. Please wait before trying again."));
        if (request.getOtp() == null || !request.getOtp().matches("\\d{6}"))
            return ResponseEntity.badRequest().body(Map.of("message", "Verification code must contain exactly 6 digits"));
        Admin account = adminRepository.findByEmail(email).orElse(null);
        if (isBlank(request.getNewPassword()) || request.getNewPassword().length() < 8 || request.getNewPassword().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("message", "Password must be between 8 and 100 characters"));
        if (account == null || !passwordOtpService.consume(email, "RESET", request.getOtp()))
            return ResponseEntity.badRequest().body(Map.of("message", "Verification code is invalid or expired"));
        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        adminRepository.save(account);
        return ResponseEntity.ok(Map.of("message", "Password updated. You can now sign in."));
    }

    @PostMapping("/otp/send")
    public ResponseEntity<String> sendOtp(@RequestBody OtpRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Enter a valid email address");
        }
        if (!allowOtpSend(httpRequest, request.getEmail(), "signup"))
            return ResponseEntity.status(429).body("Too many verification requests. Please wait before trying again.");
        if (!isBlank(request.getOrganizationJoinCode())
                && !request.getOrganizationJoinCode().trim().matches("[A-Za-z0-9]{10}"))
            return ResponseEntity.badRequest().body("Organization joining code must be 10 letters or numbers");
        if (!isBlank(request.getOrganizationJoinCode())) {
            Organization organization = organizationRepository.findByJoinCodeIgnoreCase(request.getOrganizationJoinCode().trim()).orElse(null);
            if (organization == null) return ResponseEntity.badRequest().body("Organization join code was not found");
            if (!matchesOrganizationEmail(organization, request.getEmail()))
                return ResponseEntity.badRequest().body("Email does not match this organization's employee email rule");
        }
        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        try {
            emailService.sendOtpEmail(request.getEmail(), otp);
            otpChallenges.put(normalizeEmail(request.getEmail()), new OtpChallenge(otp, Instant.now().plusSeconds(OTP_TTL_SECONDS)));
            return ResponseEntity.ok("OTP sent");
        } catch (RestClientException | IllegalStateException ex) {
            logger.error("OTP email delivery failed", ex);
            return ResponseEntity.internalServerError().body("Unable to send OTP. Check the admin mail configuration.");
        }
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifySignupOtp(@RequestBody OtpVerificationRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getEmail()) || request.getOtp() == null || !request.getOtp().matches("\\d{6}"))
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Email and verification code are required"));
        String email = normalizeEmail(request.getEmail());
        if (!allowOtpAttempt(httpRequest, email, "signup"))
            return ResponseEntity.status(429).body(Map.of("valid", false, "message", "Too many verification attempts. Please wait before trying again."));
        OtpChallenge challenge = otpChallenges.get(email);
        boolean valid = challenge != null && Instant.now().isBefore(challenge.expiresAt()) && MessageDigest.isEqual(
                challenge.code().getBytes(StandardCharsets.UTF_8), request.getOtp().getBytes(StandardCharsets.UTF_8));
        if (challenge != null && !Instant.now().isBefore(challenge.expiresAt())) otpChallenges.remove(email, challenge);
        return valid ? ResponseEntity.ok(Map.of("valid", true, "message", "Verification code accepted"))
                : ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Verification code is invalid or expired"));
    }

    @GetMapping("/policy/{joinCode}")
    public ResponseEntity<?> employeeEmailPolicy(@PathVariable String joinCode) {
        Organization organization = organizationRepository.findByJoinCodeIgnoreCase(joinCode.trim()).orElse(null);
        if (organization == null) return ResponseEntity.notFound().build();
        String pattern = effectiveEmailPattern(organization);
        if (isBlank(pattern)) return ResponseEntity.status(409).body(Map.of("message", "This organization must configure an employee email rule before accepting registrations"));
        return ResponseEntity.ok(Map.of("emailPattern", pattern));
    }

    @GetMapping("/departments")
    public ResponseEntity<?> signupDepartments(@RequestParam String joinCode) {
        Organization organization = organizationRepository.findByJoinCodeIgnoreCase(joinCode.trim()).orElse(null);
        if (organization == null) return ResponseEntity.badRequest().body(Map.of("message", "Organization joining code was not found"));
        return ResponseEntity.ok(departmentRepository.findAllByOrganizationIdOrderByName(organization.getId()).stream()
                .map(department -> Map.of("id", department.getId(), "name", department.getName())).toList());
    }

    @PostMapping({"/login", "/signin"})
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getUsername()))
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid email address to sign in"));
        if (isBlank(request.getPassword()) || request.getPassword().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid password"));
        if (!rateLimiter.allow("login-ip:" + clientAddress(httpRequest), 30, 900)
                || !rateLimiter.allow("login-email:" + normalizeEmail(request.getUsername()), 10, 900))
            return ResponseEntity.status(429).body(Map.of("message", "Too many sign-in attempts. Please wait before trying again."));
        String email = normalizeEmail(request.getUsername());
        Admin account = adminRepository.findByEmail(email).orElse(null);
        if (account == null)
            return ResponseEntity.status(401).body(Map.of("message", "Email or password is incorrect"));
        if (account != null && "EMPLOYEE".equals(account.getRole()) && !account.isApproved()) {
            String message = "REJECTED".equalsIgnoreCase(account.getApprovalStatus())
                    ? "Employee registration was rejected by the organization admin"
                    : "Employee registration is waiting for organization admin approval";
            return ResponseEntity.status(403).body(Map.of("message", message));
        }
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword())
        );
        if (authentication.isAuthenticated()) {
            // In a real app return JWT token. Here we return a simple success message.
            String role = account == null || account.getRole() == null ? "ADMIN" : account.getRole();
            return ResponseEntity.ok(Map.of(
                    "message", "Login successful",
                    "accessToken", accessTokens.create(authentication.getName()),
                    "expiresIn", accessTokens.ttlSeconds(),
                    "role", role,
                    "accountId", account.getId(),
                    "organizationId", account.getOrganization() == null ? 0L : account.getOrganization().getId(),
                    "name", account.getFullName()
            ));
        }
        return ResponseEntity.status(401).body("Invalid credentials");
    }

    @PostMapping({"/register", "/signup"})
    public ResponseEntity<?> register(@RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        if (request == null || !isValidEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Enter a valid email address");
        }
        if (request.getOtp() == null || !request.getOtp().matches("\\d{6}")) {
            return ResponseEntity.badRequest().body("Verification code must contain exactly 6 digits");
        }
        if (request.getAccountType() == null || !java.util.Set.of("organisation", "individual")
                .contains(request.getAccountType().trim().toLowerCase(java.util.Locale.ROOT))) {
            return ResponseEntity.badRequest().body("Choose a valid account type");
        }
        String email = normalizeEmail(request.getEmail());
        if (!allowOtpAttempt(httpRequest, email, "signup"))
            return ResponseEntity.status(429).body("Too many verification attempts. Please wait before trying again.");
        OtpChallenge challenge = otpChallenges.get(email);
        if (challenge == null || Instant.now().isAfter(challenge.expiresAt()) || !MessageDigest.isEqual(
                challenge.code().getBytes(StandardCharsets.UTF_8), request.getOtp().getBytes(StandardCharsets.UTF_8))) {
            if (challenge != null && Instant.now().isAfter(challenge.expiresAt())) otpChallenges.remove(email, challenge);
            return ResponseEntity.badRequest().body("OTP is invalid or expired");
        }
        if (!isValidFullName(request.getFullName()))
            return ResponseEntity.badRequest().body("Full name may contain only letters, spaces, apostrophes, periods, and hyphens");
        if (!isValidEmployeeId(request.getEmployeeId()))
            return ResponseEntity.badRequest().body("Employee ID may contain only letters, numbers, dots, underscores, slashes, and hyphens");
        if (!isValidDesignation(request.getDesignation()))
            return ResponseEntity.badRequest().body("Enter a valid designation using letters, numbers, spaces, and common punctuation");
        if (isBlank(request.getPassword()) || request.getPassword().length() < 8 || request.getPassword().length() > 100) {
            return ResponseEntity.badRequest().body("Password must be between 8 and 100 characters");
        }
        Admin existingAccount = adminRepository.findByEmail(email).orElse(null);
        boolean joiningFromLegacyIndividual = existingAccount != null
                && "EMPLOYEE".equals(existingAccount.getRole())
                && existingAccount.getOrganization() == null
                && "individual".equalsIgnoreCase(existingAccount.getAccountType());
        if (existingAccount != null && !joiningFromLegacyIndividual) {
            return ResponseEntity.status(409).body("An account with this email already exists");
        }
        Admin employeeIdOwner = adminRepository.findByEmployeeId(request.getEmployeeId().trim()).orElse(null);
        if (employeeIdOwner != null && (!joiningFromLegacyIndividual || !employeeIdOwner.getId().equals(existingAccount.getId()))) {
            return ResponseEntity.status(409).body("An account with this employee ID already exists");
        }
        Admin admin = joiningFromLegacyIndividual ? existingAccount : new Admin();
        String generatedJoinCode = null;
        admin.setUsername(email);
        admin.setPassword(passwordEncoder.encode(request.getPassword()));
        admin.setAccountType(request.getAccountType().trim());
        admin.setFullName(request.getFullName().trim());
        admin.setEmployeeId(request.getEmployeeId().trim());
        admin.setEmail(email);
        String designation = sanitizeTitle(request.getDesignation());
        if (designation == null) return ResponseEntity.badRequest().body("Designation must be 1 to 100 characters");
        admin.setDesignation(designation);
        if ("organisation".equalsIgnoreCase(request.getAccountType().trim())) {
            if (!"ADMIN".equalsIgnoreCase(request.getAuthorityType() == null ? "" : request.getAuthorityType().trim()))
                return ResponseEntity.badRequest().body("Authority type must be Admin for an organization account");
            if (!isValidOrganizationName(request.getOrganizationName()))
                return ResponseEntity.badRequest().body("Enter a valid organization name using letters, numbers, spaces, and common punctuation");
            String authorityTitle = sanitizeTitle(request.getAuthorityTitle());
            String authorityType = sanitizeTitle(request.getAuthorityType());
            if (authorityTitle == null || authorityType == null)
                return ResponseEntity.badRequest().body("Authority type and designation are required (maximum 100 characters)");
            if (isBlank(request.getOrganizationName())) {
                return ResponseEntity.badRequest().body("Organization name is required for an admin account");
            }
            String organizationName = request.getOrganizationName().trim();
            if (organizationRepository.findByNameIgnoreCase(organizationName).isPresent()) {
                return ResponseEntity.status(409).body("An organization with this name already exists");
            }
            Organization organization = new Organization();
            organization.setName(organizationName);
            organization.setEmployeeEmailPattern(emailPatternFor(email));
            organization.setJoinCode(UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(java.util.Locale.ROOT));
            generatedJoinCode = organization.getJoinCode();
            organization = organizationRepository.save(organization);
            String[] defaultDepartments = {"Traffic Police Department", "Public Works Department (PWD)", "Municipal Corporation / Municipality", "Police Department"};
            java.util.List<Department> seededDepartments = new java.util.ArrayList<>();
            for (String departmentName : defaultDepartments) { Department department = new Department(); department.setOrganization(organization); department.setName(departmentName); seededDepartments.add(department); }
            departmentRepository.saveAll(seededDepartments);
            admin.setOrganization(organization);
            admin.setRole("ADMIN");
            admin.setApproved(true);
            admin.setApprovalStatus("APPROVED");
            admin.setAuthorityTitle(authorityTitle);
            admin.setAuthorityType(authorityType);
            admin.setDesignation(authorityTitle);
        } else {
            if (isBlank(request.getOrganizationJoinCode()) || !request.getOrganizationJoinCode().trim().matches("[A-Za-z0-9]{10}"))
                return ResponseEntity.badRequest().body("Employee joining code must contain 10 letters or numbers");
            Organization organization = organizationRepository.findByJoinCodeIgnoreCase(request.getOrganizationJoinCode().trim()).orElse(null);
            if (organization == null) return ResponseEntity.badRequest().body("Employee joining code was not found");
            if (!matchesOrganizationEmail(organization, email))
                return ResponseEntity.badRequest().body("Email does not match this organization's employee email rule");
            Department department = departmentRepository.findByIdAndOrganizationId(request.getDepartmentId(), organization.getId()).orElse(null);
            String departmentRole = request.getDepartmentRole() == null ? "" : request.getDepartmentRole().trim().toUpperCase(java.util.Locale.ROOT);
            if (department == null || !java.util.Set.of("HEAD", "MEMBER").contains(departmentRole))
                return ResponseEntity.badRequest().body("Choose a department and select Department Head or Department Member");
            admin.setOrganization(organization);
            admin.setDepartment(department);
            admin.setDepartmentRole(departmentRole);
            admin.setRole("EMPLOYEE");
            admin.setApproved(false);
            admin.setApprovalStatus("PENDING");
        }
        try {
            adminRepository.saveAndFlush(admin);
            otpChallenges.remove(email, challenge);
        } catch (DataIntegrityViolationException ex) {
            return ResponseEntity.status(409).body("An account with this email or employee ID already exists");
        }
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("message", "organisation".equalsIgnoreCase(request.getAccountType().trim())
                ? "Organization admin registered successfully. Share the organization join code with your employees."
                : "Employee registration submitted. An organization admin must approve your account.");
        if (generatedJoinCode != null) result.put("organizationJoinCode", generatedJoinCode);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/google-oauth")
    public ResponseEntity<?> googleOAuth(@RequestBody GoogleOAuthRequest request) {
        String idToken = !isBlank(request.getCredential()) ? request.getCredential() : request.getIdToken();
        String clientId = configuredGoogleClientId();
        if (isBlank(idToken)) return ResponseEntity.badRequest().body(Map.of("message", "Google ID token is required"));
        if (isBlank(clientId)) return ResponseEntity.status(503).body(Map.of("message", "Google sign-in is not configured"));
        try {
            String query = "https://oauth2.googleapis.com/tokeninfo?id_token=" + URLEncoder.encode(idToken, StandardCharsets.UTF_8);
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
            HttpRequest tokenRequest = HttpRequest.newBuilder(URI.create(query)).timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> tokenResponse = client.send(tokenRequest, HttpResponse.BodyHandlers.ofString());
            if (tokenResponse.statusCode() != 200) return ResponseEntity.status(401).body(Map.of("message", "Google token is invalid or expired"));
            JsonNode claims = objectMapper.readTree(tokenResponse.body());
            if (!clientId.equals(claims.path("aud").asText()) || !"true".equalsIgnoreCase(claims.path("email_verified").asText()))
                return ResponseEntity.status(401).body(Map.of("message", "Google account verification failed"));
            String email = normalizeEmail(claims.path("email").asText(""));
            if (!isValidEmail(email))
                return ResponseEntity.status(401).body(Map.of("message", "Google account verification failed"));
            Admin account = adminRepository.findByEmail(email).orElse(null);
            if (account == null) return ResponseEntity.status(404).body(Map.of("message", "Create a RoadGuard account with this email before signing in"));
            if ("EMPLOYEE".equals(account.getRole()) && !account.isApproved())
                return ResponseEntity.status(403).body(Map.of("message", "Employee account is waiting for organization admin approval"));
            if (!account.isEnabled())
                return ResponseEntity.status(403).body(Map.of("message", "This account is disabled. Contact your organization administrator"));
            return ResponseEntity.ok(Map.of("message", "Google sign-in successful", "accessToken", accessTokens.create(account.getUsername()),
                    "expiresIn", accessTokens.ttlSeconds(), "role", account.getRole() == null ? "ADMIN" : account.getRole(),
                    "accountId", account.getId(), "organizationId", account.getOrganization() == null ? 0L : account.getOrganization().getId(),
                    "name", account.getFullName()));
        } catch (Exception ex) {
            logger.warn("Google token verification failed: {}", ex.getMessage());
            return ResponseEntity.status(502).body(Map.of("message", "Google sign-in could not be verified right now"));
        }
    }

    @GetMapping("/google-config")
    public ResponseEntity<?> googleConfig() {
        String clientId = configuredGoogleClientId();
        if (isBlank(clientId)) return ResponseEntity.status(503).body(Map.of("message", "Google sign-in is not configured"));
        return ResponseEntity.ok(Map.of("clientId", clientId));
    }

    private static String normalizeEmail(String email) { return email.trim().toLowerCase(java.util.Locale.ROOT); }
    private String configuredGoogleClientId() {
        String clientId = environment.getProperty("GOOGLE_CLIENT_ID");
        return clientId == null ? null : clientId.trim();
    }
    private boolean allowOtpSend(HttpServletRequest request, String email, String purpose) {
        return rateLimiter.allow("otp-ip:" + clientAddress(request), 8, 900)
                && rateLimiter.allow("otp-email:" + purpose + ":" + normalizeEmail(email), 3, 900);
    }
    private boolean allowOtpAttempt(HttpServletRequest request, String email, String purpose) {
        return rateLimiter.allow("otp-attempt-ip:" + clientAddress(request) + ":" + purpose, 12, 300)
                && rateLimiter.allow("otp-attempt-email:" + purpose + ":" + email, 8, 300);
    }
    private static String clientAddress(HttpServletRequest request) {
        String address = request.getRemoteAddr();
        return address == null || address.isBlank() ? "unknown" : address;
    }
    private static boolean isValidEmail(String email) {
        return email != null && email.length() <= 254
                && email.matches("(?i)^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");
    }
    private static boolean isValidFullName(String value) {
        return value != null && value.trim().length() <= 100
                && value.trim().matches("[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]*");
    }
    private static boolean isValidEmployeeId(String value) {
        return value != null && value.trim().matches("[A-Za-z0-9][A-Za-z0-9._/-]{0,49}");
    }
    private static boolean isValidDesignation(String value) {
        return value != null && value.trim().length() <= 100
                && value.trim().matches("[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 .,'&()/\\-]*");
    }
    private static boolean isValidOrganizationName(String value) {
        return value != null && value.trim().length() <= 150
                && value.trim().matches("[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 .,'&()/\\-]*");
    }
    private static String sanitizeTitle(String value) {
        if (isBlank(value)) return null;
        String cleaned = value.replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.isEmpty() || cleaned.length() > 100 ? null : cleaned;
    }
    private static boolean isBlank(String value) { return value == null || value.isBlank(); }
    private String effectiveEmailPattern(Organization organization) {
        String configured = organization.getEmployeeEmailPattern();
        if (!isBlank(configured) && !"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$".equals(configured)) return configured;
        Admin owner = adminRepository.findAllByOrganizationIdOrderByFullName(organization.getId()).stream()
                .filter(account -> "ADMIN".equalsIgnoreCase(account.getRole()) && !isBlank(account.getEmail()))
                .findFirst().orElse(null);
        return owner == null ? null : emailPatternFor(owner.getEmail());
    }
    private boolean matchesOrganizationEmail(Organization organization, String email) {
        String pattern = effectiveEmailPattern(organization);
        if (isBlank(pattern)) return false;
        try { return Pattern.compile(pattern, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                .matcher(email.trim()).matches(); }
        catch (PatternSyntaxException ex) { return false; }
    }
    private static String emailPatternFor(String email) {
        int at = email == null ? -1 : email.lastIndexOf('@');
        if (at <= 0 || at == email.length() - 1) return null;
        return "^[^\\s@]+@" + Pattern.quote(email.substring(at + 1).trim()) + "$";
    }

    private record OtpChallenge(String code, Instant expiresAt) { }
}

@Data
class LoginRequest {
    private String username;
    private String password;
}

@Data
class RegisterRequest {
    private String password;
    private String accountType;
    private String fullName;
    private String employeeId;
    private String email;
    private String designation;
    private String otp;
    private String organizationName;
    private String organizationJoinCode;
    private Long departmentId;
    private String departmentRole;
    private String authorityType;
    private String authorityTitle;
}

@Data
class OtpRequest {
    private String email;
    private String organizationJoinCode;
}

@Data
class PasswordOtpRequest { private String email; }

@Data
class PasswordResetRequest { private String email; private String otp; private String newPassword; }

@Data
class OtpVerificationRequest { private String email; private String otp; }

@Data
class GoogleOAuthRequest { private String credential; private String idToken; }
