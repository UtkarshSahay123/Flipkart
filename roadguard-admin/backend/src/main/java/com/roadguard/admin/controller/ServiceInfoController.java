package com.roadguard.admin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ServiceInfoController {

    @GetMapping("/")
    public Map<String, String> serviceInfo() {
        return Map.of(
            "service", "Road Guard Organization API",
            "status", "running",
            "health", "/actuator/health"
        );
    }
}
