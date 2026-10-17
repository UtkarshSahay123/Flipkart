package com.roadguard.admin.repository;

import com.roadguard.admin.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByJoinCodeIgnoreCase(String joinCode);
    Optional<Organization> findByNameIgnoreCase(String name);
}
