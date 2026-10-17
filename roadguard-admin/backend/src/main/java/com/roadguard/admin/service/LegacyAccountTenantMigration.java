package com.roadguard.admin.service;

import com.roadguard.admin.Admin;
import com.roadguard.admin.Organization;
import com.roadguard.admin.repository.AdminRepository;
import com.roadguard.admin.repository.OrganizationRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.regex.Pattern;

/** Assigns pre-RBAC organization-head accounts their own tenant on first startup. */
@Component
public class LegacyAccountTenantMigration implements ApplicationRunner {
    private final AdminRepository accounts;
    private final OrganizationRepository organizations;

    public LegacyAccountTenantMigration(AdminRepository accounts, OrganizationRepository organizations) {
        this.accounts = accounts;
        this.organizations = organizations;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Admin account : accounts.findAll()) {
            if (account.getRole() != null) continue;
            if ("organisation".equalsIgnoreCase(account.getAccountType())) {
                Organization organization = new Organization();
                String name = account.getFullName().trim() + " Organization";
                if (organizations.findByNameIgnoreCase(name).isPresent()) name += " " + account.getEmployeeId();
                organization.setName(name);
                String email = account.getEmail();
                int at = email == null ? -1 : email.lastIndexOf('@');
                if (at > 0 && at < email.length() - 1)
                    organization.setEmployeeEmailPattern("^[^\\s@]+@" + Pattern.quote(email.substring(at + 1).trim()) + "$" );
                organization.setJoinCode(UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
                account.setOrganization(organizations.save(organization));
                account.setRole("ADMIN");
                account.setApproved(true);
                account.setApprovalStatus("APPROVED");
            } else {
                // Legacy individual accounts were citizen accounts and have no verified tenant.
                // They must join an organization before they can enter the employee portal.
                account.setRole("EMPLOYEE");
                account.setApproved(false);
                account.setApprovalStatus("PENDING");
            }
            if (account.getAccountActive() == null) account.setAccountActive(true);
            accounts.save(account);
        }
    }
}
