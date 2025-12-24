package com.petties.petties;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@Disabled("Skip context load test because it requires real database connections")
@SpringBootTest
class PettiesApplicationTests {

    @Test
    void contextLoads() {
    }

}
