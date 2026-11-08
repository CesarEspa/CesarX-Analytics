package com.cesarx.analytics.service;

import com.cesarx.analytics.exception.InvalidResetTokenException;
import com.cesarx.analytics.model.entity.PasswordResetToken;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.PasswordResetTokenRepository;
import com.cesarx.analytics.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository tokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private PasswordResetMailer mailer;
    @InjectMocks
    private PasswordResetService service;

    private final User user = User.builder().username("cesar").email("cesar@example.com").passwordHash("old").build();

    @Test
    void storesOnlyTheHashAndEmailsTheRawToken() {
        when(userRepository.findByEmail("cesar@example.com")).thenReturn(Optional.of(user));

        service.requestReset(" cesar@example.com ");

        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mailer).send(eq("cesar@example.com"), eq("cesar"), token.capture());
        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash())
                .isEqualTo(PasswordResetService.sha256(token.getValue()))
                .isNotEqualTo(token.getValue());
        assertThat(saved.getValue().getExpiresAt()).isAfter(Instant.now());
        verify(tokenRepository).deleteAllForUser(user);
    }

    @Test
    void unknownEmailEndsSilently() {
        when(userRepository.findByEmail("nadie@example.com")).thenReturn(Optional.empty());

        service.requestReset("nadie@example.com");

        verifyNoInteractions(mailer, tokenRepository);
    }

    @Test
    void validTokenReplacesThePasswordAndIsConsumed() {
        givenToken(Instant.now().plusSeconds(60));
        when(passwordEncoder.encode("nueva-clave-123")).thenReturn("new-hash");

        service.resetPassword("token", "nueva-clave-123");

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        verify(userRepository).save(user);
        verify(tokenRepository).deleteAllForUser(user);
    }

    @Test
    void expiredTokenIsRejected() {
        givenToken(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.resetPassword("token", "nueva-clave-123"))
                .isInstanceOf(InvalidResetTokenException.class);
        assertThat(user.getPasswordHash()).isEqualTo("old");
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void unknownTokenIsRejected() {
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword("otro", "nueva-clave-123"))
                .isInstanceOf(InvalidResetTokenException.class);
    }

    private void givenToken(Instant expiresAt) {
        PasswordResetToken stored = PasswordResetToken.builder().user(user).expiresAt(expiresAt).build();
        when(tokenRepository.findByTokenHash(PasswordResetService.sha256("token"))).thenReturn(Optional.of(stored));
    }
}
