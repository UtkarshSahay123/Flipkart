package com.roadguard.admin.repository;

import com.roadguard.admin.TaskStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskStatusHistoryRepository extends JpaRepository<TaskStatusHistory, Long> {
    List<TaskStatusHistory> findAllByTaskEmployeeIdOrderByChangedAtDesc(Long employeeId);
    List<TaskStatusHistory> findAllByOrganizationIdOrderByChangedAtDesc(Long organizationId);
    @Query("select h from TaskStatusHistory h where h.task.employee.id = :employeeId and h.task.organization.id = :organizationId order by h.changedAt desc")
    List<TaskStatusHistory> findEmployeeHistoryForOrganization(@Param("employeeId") Long employeeId, @Param("organizationId") Long organizationId);
}
