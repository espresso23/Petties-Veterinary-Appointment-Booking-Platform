
package com.petties.petties.controller;
import com.petties.petties.service.MasterServiceService;

import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@WebMvcTest(MasterServiceController.class)
public class MasterServiceControllerUnitTest {

	// Mock các bean bảo mật và service để tránh lỗi context
	@MockBean
	private JwtTokenProvider jwtTokenProvider;

	@MockBean
	private JwtAuthenticationFilter jwtAuthenticationFilter;

	@MockBean
	private MasterServiceService masterServiceService;

		@Test
		void contextLoads() {
			// TODO: Viết test cho MasterServiceController (CRUD, weightPrices)
		}
}