package com.cesarx.analytics.dto.auth;

public record AuthResponse(
        String token,
        String tokenType,
        String username,
        String role,
        long expiresInMs
) {
    public static AuthResponse of(String token, String username, String role, long expiresInMs) {
        return new AuthResponse(token, "Bearer", username, role, expiresInMs);
    }
}
