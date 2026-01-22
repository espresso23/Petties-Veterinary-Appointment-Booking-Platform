package com.petties.petties;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Simple test to verify compilation
 */
@SpringBootTest
@ActiveProfiles("test")
class PettiesApplicationTests {

    @Test
    void contextLoads() {
        // This test will fail if there are compilation errors
    }
}
