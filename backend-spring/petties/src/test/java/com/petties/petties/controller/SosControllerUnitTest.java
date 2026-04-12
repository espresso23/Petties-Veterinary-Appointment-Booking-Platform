package com.petties.petties.controller;

import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.SosMatchingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import com.petties.petties.dto.sos.SosMatchingStatusMessage;

@WebMvcTest(SosController.class)
@AutoConfigureMockMvc(addFilters = false)
class SosControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private SosMatchingService sosMatchingService;

        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @MockitoBean
        private com.petties.petties.repository.UserRepository userRepository;

        @Test
        void getActiveSosAlerts_Success() throws Exception {
                UUID managerId = UUID.randomUUID();
                UserPrincipal principal = new UserPrincipal(
                                managerId, "manager", "password", "CLINIC_MANAGER",
                                Collections.singletonList(new SimpleGrantedAuthority("ROLE_CLINIC_MANAGER")));
                Authentication auth = new UsernamePasswordAuthenticationToken(principal, null,
                                principal.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);

                SosMatchingStatusMessage alert = SosMatchingStatusMessage.builder()
                                .bookingId(UUID.randomUUID())
                                .message("Test Alert")
                                .build();

                when(sosMatchingService.getActiveSosAlertsForManager(any(UUID.class)))
                                .thenReturn(List.of(alert));

                mockMvc.perform(get("/sos/alerts"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$", hasSize(1)))
                                .andExpect(jsonPath("$[0].message", is("Test Alert")));

                SecurityContextHolder.clearContext();
        }
}
