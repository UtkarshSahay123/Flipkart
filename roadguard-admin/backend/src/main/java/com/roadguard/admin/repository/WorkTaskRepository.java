package com.roadguard.admin.repository;

import com.roadguard.admin.WorkTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WorkTaskRepository extends JpaRepository<WorkTask, Long> {
    List<WorkTask> findAllByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    List<WorkTask> findAllByOrganizationIdAndDepartmentIdOrderByCreatedAtDesc(Long organizationId, Long departmentId);
    List<WorkTask> findAllByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
    List<WorkTask> findAllByEmployeeIdAndOrganizationIdOrderByCreatedAtDesc(Long employeeId, Long organizationId);
    List<WorkTask> findAllByCreatedByIdAndOrganizationIdOrderByCreatedAtDesc(Long createdById, Long organizationId);
    Optional<WorkTask> findByIdAndOrganizationId(Long id, Long organizationId);
    Optional<WorkTask> findByIdAndEmployeeId(Long id, Long employeeId);
    Optional<WorkTask> findByIdAndEmployeeIdAndOrganizationId(Long id, Long employeeId, Long organizationId);
}
