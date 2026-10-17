package com.roadguard.admin;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Collections;

@Entity
@Table(name = "admin_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Admin implements UserDetails {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password; // stored as BCrypt hash

    @Column(name = "account_type", nullable = false)
    private String accountType; // individual or organisation

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "employee_id", nullable = false, unique = true)
    private String employeeId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "designation")
    private String designation;

    @Column(name = "authority_title", length = 100)
    private String authorityTitle;

    @Column(name = "authority_type", length = 100)
    private String authorityType;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "department_role", length = 12)
    private String departmentRole;

    @Column(name = "profile_image", columnDefinition = "text")
    private String profileImage;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "pending_organization_id")
    private Organization pendingOrganization;

    @Column(name = "organization_change_status", length = 20)
    private String organizationChangeStatus;

    @Column(name = "role")
    private String role = "ADMIN";

    @Column(name = "rbac_role_id")
    private Long rbacRoleId;

    @Column(name = "rbac_enabled")
    private boolean rbacEnabled;

    @Column(name = "manager_id")
    private Long managerId;

    @Column(name = "approved")
    private Boolean approved = true;

    @Column(name = "approval_status", length = 20)
    private String approvalStatus = "APPROVED";

    @Column(name = "account_active")
    private Boolean accountActive = true;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        String resolvedRole = role == null ? "ADMIN" : role;
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + resolvedRole));
    }

    @Override
    public String getPassword() { return password; }

    @Override
    public String getUsername() { return username; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return !Boolean.FALSE.equals(accountActive) && (!"EMPLOYEE".equals(role) || Boolean.TRUE.equals(approved)); }

    public boolean isApproved() { return Boolean.TRUE.equals(approved); }
}
