package com.cesarx.analytics.service;

import com.cesarx.analytics.exception.InvalidResetTokenException;
import com.cesarx.analytics.model.entity.PasswordResetToken;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.PasswordResetTokenRepository;
import com.cesarx.analytics.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/** Passwords are stored as BCrypt hashes and cannot be read back, only replaced. */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailer mailer;
    private final SecureRandom random = new SecureRandom();

    /** Unknown addresses end silently, so this endpoint cannot be used to discover accounts. */
    @Transactional
    public void requestReset(String email) {
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            tokenRepository.deleteAllForUser(user);
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            tokenRepository.save(PasswordResetToken.builder()
                    .user(user)
                    .tokenHash(sha256(token))
                    .expiresAt(Instant.now().plus(TOKEN_LIFETIME))
                    .build());
            mailer.send(user.getEmail(), user.getUsername(), token);
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken stored = tokenRepository.findByTokenHash(sha256(token))
                .orElseThrow(InvalidResetTokenException::new);
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidResetTokenException();
        }
        User user = stored.getUser();
        tokenRepository.deleteAllForUser(user);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
