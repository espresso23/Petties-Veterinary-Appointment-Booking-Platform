package com.petties.petties.scheduler;

import com.petties.petties.service.SandboxService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("SandboxScheduler Unit Tests")
class SandboxSchedulerUnitTest {

    @Mock
    private SandboxService sandboxService;

    @InjectMocks
    private SandboxScheduler sandboxScheduler;

    @Test
    @DisplayName("cleanupExpiredSandboxes - gọi service cleanup thành công")
    void cleanupExpiredSandboxes_success_callsServiceOnce() {
        doNothing().when(sandboxService).cleanupExpiredSandboxes();

        sandboxScheduler.cleanupExpiredSandboxes();

        verify(sandboxService, times(1)).cleanupExpiredSandboxes();
    }

    @Test
    @DisplayName("cleanupExpiredSandboxes - service throw exception nhưng scheduler không throw")
    void cleanupExpiredSandboxes_serviceThrows_noRethrow() {
        doThrow(new RuntimeException("DB down")).when(sandboxService).cleanupExpiredSandboxes();

        assertDoesNotThrow(() -> sandboxScheduler.cleanupExpiredSandboxes());
        verify(sandboxService, times(1)).cleanupExpiredSandboxes();
    }
}
