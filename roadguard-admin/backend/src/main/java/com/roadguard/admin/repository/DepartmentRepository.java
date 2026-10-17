package com.roadguard.admin.repository;

import com.roadguard.admin.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findAllByOrganizationIdOrderByName(Long organizationId);
    Optional<Department> findByIdAndOrganizationId(Long id, Long organizationId);
    Optional<Department> findByOrganizationIdAndNameIgnoreCase(Long organizationId, String name);
}
