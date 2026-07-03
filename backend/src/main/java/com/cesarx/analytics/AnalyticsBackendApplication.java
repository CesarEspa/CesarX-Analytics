package com.cesarx.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AnalyticsBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnalyticsBackendApplication.class, args);
    }
}
