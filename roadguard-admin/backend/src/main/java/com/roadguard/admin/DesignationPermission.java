package com.roadguard.admin;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "designation_permissions", uniqueConstraints =
        @UniqueConstraint(name = "uq_org_designation", columnNames = {"organization_id", "designation"}))
@Getter
@Setter
@NoArgsConstructor
public class DesignationPermission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 100)
    private String designation;

    @Column(name = "can_report_issues", nullable = false)
    private boolean canReportIssues = true;

    @Column(name = "can_view_all_issues", nullable = false)
    private boolean canViewAllIssues;

    @Column(name = "can_update_tasks", nullable = false)
    private boolean canUpdateTasks = true;

    @Column(name = "can_assign_tasks", nullable = false)
    private boolean canAssignTasks;
}
