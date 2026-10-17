package com.roadguard.admin.service;

import com.roadguard.admin.Admin;
import com.roadguard.admin.DesignationPermission;
import com.roadguard.admin.repository.AdminRepository;
import com.roadguard.admin.repository.DesignationPermissionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class RbacService {
    private final AdminRepository accounts;
    private final DesignationPermissionRepository designationPermissions;
    private final JdbcTemplate jdbc;

    public RbacService(AdminRepository accounts, DesignationPermissionRepository designationPermissions, JdbcTemplate jdbc) {
        this.accounts = accounts;
        this.designationPermissions = designationPermissions;
        this.jdbc = jdbc;
    }

    public Admin currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return accounts.findByUsername(username).orElseThrow();
    }

    public boolean hasPermission(Admin user, String permissionKey) {
        if (!"EMPLOYEE".equals(user.getRole())) return true;
        if (user.getOrganization() == null) return false;
        Long organizationId = user.getOrganization().getId();
        if (user.isRbacEnabled()) {
            if (user.getRbacRoleId() == null) return false;
            return Boolean.TRUE.equals(jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM admin_role_permissions rp JOIN admin_roles r ON r.id=rp.role_id WHERE rp.role_id=? AND r.organization_id=? AND rp.permission_key=?)",
                    Boolean.class, user.getRbacRoleId(), organizationId, permissionKey));
        }
        DesignationPermission legacy = user.getDesignation() == null ? null : designationPermissions
                .findByOrganizationIdAndDesignationIgnoreCase(organizationId, user.getDesignation()).orElse(null);
        // Existing organizations without a designation override retain the standard
        // employee workflow; explicit RBAC roles continue to use the strict branch above.
        if (legacy == null) return switch (permissionKey) {
            case "TASK_UPDATE", "ISSUE_REPORT", "ISSUE_RESOLVE" -> true;
            default -> false;
        };
        return switch (permissionKey) {
            case "TASK_ASSIGN" -> legacy.isCanAssignTasks();
            case "TASK_UPDATE" -> legacy.isCanUpdateTasks();
            case "ISSUE_REPORT" -> legacy.isCanReportIssues();
            case "ISSUE_VIEW_ALL" -> legacy.isCanViewAllIssues();
            case "ISSUE_RESOLVE" -> legacy.isCanUpdateTasks();
            default -> false;
        };
    }

    public boolean isBelow(Long actorId, Long targetId, Long organizationId) {
        if (actorId == null || targetId == null || organizationId == null || actorId.equals(targetId)) return false;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE descendants(id) AS (
                    SELECT id FROM admin_users WHERE manager_id=? AND organization_id=? AND role='EMPLOYEE'
                    UNION
                    SELECT u.id FROM admin_users u JOIN descendants d ON u.manager_id=d.id
                    WHERE u.organization_id=? AND u.role='EMPLOYEE'
                ) SELECT EXISTS(SELECT 1 FROM descendants WHERE id=?)
                """, Boolean.class, actorId, organizationId, organizationId, targetId));
    }
}
