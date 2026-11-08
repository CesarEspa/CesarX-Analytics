package com.cesarx.analytics.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;

@Component
@Slf4j
public class JwtUtil {

    private static final int MIN_KEY_BYTES = 32;
    private static final String PLACEHOLDER_PREFIX = "change-this";

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                    @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.signingKey = buildSigningKey(secret);
        this.expirationMs = expirationMs;
    }

    /**
     * Nunca firma con una clave conocida: sin secreto, o con el valor de ejemplo
     * publicado en el repo, se usa una clave aleatoria en memoria. Un secreto
     * corto se deriva con SHA-256 en lugar de impedir el arranque.
     */
    private static SecretKey buildSigningKey(String secret) {
        if (secret == null || secret.isBlank() || secret.startsWith(PLACEHOLDER_PREFIX)) {
            log.warn("JWT_SECRET no está configurado: se usa una clave aleatoria y las sesiones se pierden al reiniciar.");
            return Jwts.SIG.HS256.key().build();
        }

        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length >= MIN_KEY_BYTES) {
            return Keys.hmacShaKeyFor(bytes);
        }

        log.warn("JWT_SECRET tiene menos de {} bytes: se deriva con SHA-256. Usa un secreto más largo.", MIN_KEY_BYTES);
        try {
            return Keys.hmacShaKeyFor(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    public String generateToken(String username, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, String expectedUsername) {
        try {
            Claims claims = parseClaims(token);
            return claims.getSubject().equals(expectedUsername) && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
