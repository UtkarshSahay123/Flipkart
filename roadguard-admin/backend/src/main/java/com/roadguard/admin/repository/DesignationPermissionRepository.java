package com.roadguard.admin.repository;

import com.roadguard.admin.DesignationPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DesignationPermissionRepository extends JpaRepository<DesignationPermission, Long> {
    List<DesignationPermission> findAllByOrganizationIdOrderByDesignation(Long organizationId);
    Optional<DesignationPermission> findByOrganizationIdAndDesignationIgnoreCase(Long organizationId, String designation);
}
