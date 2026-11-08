package com.cesarx.analytics.security;

import com.cesarx.analytics.config.SecurityConfig;
import com.cesarx.analytics.controller.MarketDataController;
import com.cesarx.analytics.model.entity.Role;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.service.EtfService;
import com.cesarx.analytics.service.MarketDataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = MarketDataController.class, properties = {
        "app.jwt.secret=una-clave-de-prueba-suficientemente-larga-para-hs256",
        "app.jwt.expiration-ms=3600000",
        "app.cors.allowed-origins=https://cesarespa.github.io"
})
@Import({SecurityConfig.class, JwtUtil.class, JwtAuthenticationEntryPoint.class,
        JwtAuthenticationFilter.class, RateLimitingFilter.class})
class ApiSecurityTest {

    private static final String QUOTES = "/api/market/quotes";
    private static final String GITHUB_PAGES = "https://cesarespa.github.io";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwt;

    @MockBean
    private UserDetailsServiceImpl userDetailsService;
    @MockBean
    private MarketDataService marketDataService;
    @MockBean
    private EtfService etfService;

    @BeforeEach
    void knownUser() {
        User cesar = User.builder().username("cesar").passwordHash("x").role(Role.USER).build();
        when(userDetailsService.loadUserByUsername("cesar")).thenReturn(new UserPrincipal(cesar));
        when(userDetailsService.loadUserByUsername("borrado")).thenThrow(new UsernameNotFoundException("borrado"));
        when(etfService.findAll()).thenReturn(List.of());
    }

    @Test
    void requestWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get(QUOTES)).andExpect(status().isUnauthorized());
    }

    @Test
    void requestWithValidTokenIsAllowed() throws Exception {
        mvc.perform(get(QUOTES).header("Authorization", "Bearer " + jwt.generateToken("cesar", "USER")))
                .andExpect(status().isOk());
    }

    @Test
    void garbageTokenIsUnauthorized() throws Exception {
        mvc.perform(get(QUOTES).header("Authorization", "Bearer no-es-un-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenOfDeletedUserIsUnauthorizedNotServerError() throws Exception {
        mvc.perform(get(QUOTES).header("Authorization", "Bearer " + jwt.generateToken("borrado", "USER")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void frontendOriginMayUsePatch() throws Exception {
        mvc.perform(options("/api/alerts/1/active")
                        .header("Origin", GITHUB_PAGES)
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("PATCH")));
    }

    @Test
    void unknownOriginIsRejected() throws Exception {
        mvc.perform(options(QUOTES)
                        .header("Origin", "https://sitio-ajeno.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
