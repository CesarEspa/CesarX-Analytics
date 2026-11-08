package com.cesarx.analytics.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private static final String SECRET = "una-clave-de-prueba-suficientemente-larga-para-hs256";
    private static final long ONE_HOUR = 3_600_000L;

    private final JwtUtil jwt = new JwtUtil(SECRET, ONE_HOUR);

    @Test
    void validTokenRoundTrips() {
        String token = jwt.generateToken("cesar", "USER");

        assertThat(jwt.extractUsername(token)).isEqualTo("cesar");
        assertThat(jwt.isTokenValid(token, "cesar")).isTrue();
    }

    @Test
    void tokenForAnotherUserIsRejected() {
        assertThat(jwt.isTokenValid(jwt.generateToken("cesar", "USER"), "otro")).isFalse();
    }

    @Test
    void expiredTokenIsRejected() {
        JwtUtil expired = new JwtUtil(SECRET, -1_000L);

        assertThat(jwt.isTokenValid(expired.generateToken("cesar", "USER"), "cesar")).isFalse();
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = jwt.generateToken("cesar", "USER");
        String tampered = token.substring(0, token.length() - 3) + "abc";

        assertThat(jwt.isTokenValid(tampered, "cesar")).isFalse();
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        JwtUtil other = new JwtUtil("otra-clave-distinta-tambien-suficientemente-larga", ONE_HOUR);

        assertThat(jwt.isTokenValid(other.generateToken("cesar", "USER"), "cesar")).isFalse();
    }

    @Test
    void shortSecretStillSignsAndIsStable() {
        JwtUtil first = new JwtUtil("corta", ONE_HOUR);
        JwtUtil second = new JwtUtil("corta", ONE_HOUR);

        assertThat(second.isTokenValid(first.generateToken("cesar", "USER"), "cesar")).isTrue();
    }

    @Test
    void missingSecretUsesAnUnguessableKey() {
        JwtUtil first = new JwtUtil("", ONE_HOUR);
        JwtUtil second = new JwtUtil("", ONE_HOUR);

        assertThat(first.isTokenValid(first.generateToken("cesar", "USER"), "cesar")).isTrue();
        assertThat(second.isTokenValid(first.generateToken("cesar", "USER"), "cesar")).isFalse();
    }

    @Test
    void publishedPlaceholderIsNeverUsedAsKey() {
        String placeholder = "change-this-super-secret-key-before-deploying-to-production-min-32-bytes";
        JwtUtil first = new JwtUtil(placeholder, ONE_HOUR);
        JwtUtil attacker = new JwtUtil(placeholder, ONE_HOUR);

        assertThat(first.isTokenValid(attacker.generateToken("admin", "ADMIN"), "admin")).isFalse();
    }
}
