package com.roadguard.admin;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
public class Organization {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String name;

    @Column(name = "join_code", nullable = false, unique = true, length = 32)
    private String joinCode;

    @Column(name = "employee_email_pattern", length = 300)
    private String employeeEmailPattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    @Column(name = "dashboard_settings", columnDefinition = "text")
    private String dashboardSettings;
}
