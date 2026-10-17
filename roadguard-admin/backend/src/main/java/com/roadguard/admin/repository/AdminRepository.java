package com.roadguard.admin.repository;

import com.roadguard.admin.Admin;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByUsername(String username);
    Optional<Admin> findByEmail(String email);
    Optional<Admin> findByEmployeeId(String employeeId);
    List<Admin> findAllByOrganizationIdOrderByFullName(Long organizationId);
    Optional<Admin> findByIdAndOrganizationId(Long id, Long organizationId);
    List<Admin> findAllByOrganizationIsNullAndRoleOrderByFullName(String role);
    List<Admin> findAllByPendingOrganizationIdAndOrganizationChangeStatusOrderByFullName(Long organizationId, String status);
    Optional<Admin> findByIdAndPendingOrganizationId(Long id, Long organizationId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Admin a where a.id = :id and a.role = 'EMPLOYEE' and a.organization is null")
    Optional<Admin> findUnassignedEmployeeForUpdate(@Param("id") Long id);
}
