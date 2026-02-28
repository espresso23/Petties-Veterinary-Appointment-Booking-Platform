package com.petties.petties;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class PettiesApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(PettiesApplication.class);
        // Optimize startup performance and memory scan
        app.run(args);
    }

}
