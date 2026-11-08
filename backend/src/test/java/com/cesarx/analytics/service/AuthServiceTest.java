package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.auth.AuthResponse;
import com.cesarx.analytics.dto.auth.RegisterRequest;
import com.cesarx.analytics.exception.DuplicateResourceException;
import com.cesarx.analytics.model.entity.Role;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.UserRepository;
import com.cesarx.analytics.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtUtil jwtUtil;
    @InjectMocks
    private AuthService service;

    private final RegisterRequest request = new RegisterRequest("cesar", "cesar@example.com", "changeme123");

    @Test
    void registerStoresOnlyTheHashAndAssignsUserRole() {
        when(passwordEncoder.encode("changeme123")).thenReturn("hash");
        when(jwtUtil.generateToken("cesar", "USER")).thenReturn("token");

        AuthResponse response = service.register(request);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("hash");
        assertThat(saved.getValue().getRole()).isEqualTo(Role.USER);
        assertThat(response.token()).isEqualTo("token");
    }

    @Test
    void duplicateUsernameIsRejected() {
        when(userRepository.existsByUsername("cesar")).thenReturn(true);

        assertThatThrownBy(() -> service.register(request)).isInstanceOf(DuplicateResourceException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void duplicateEmailIsRejected() {
        when(userRepository.existsByEmail("cesar@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(request)).isInstanceOf(DuplicateResourceException.class);
        verify(userRepository, never()).save(any());
    }
}
