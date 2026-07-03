package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.auth.AuthResponse;
import com.cesarx.analytics.dto.auth.LoginRequest;
import com.cesarx.analytics.dto.auth.RegisterRequest;
import com.cesarx.analytics.exception.DuplicateResourceException;
import com.cesarx.analytics.model.entity.Role;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.UserRepository;
import com.cesarx.analytics.security.JwtUtil;
import com.cesarx.analytics.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DuplicateResourceException("Username already taken: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("Email already registered: " + request.email());
        }

        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.USER)
                .build();

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name());
        return AuthResponse.of(token, user.getUsername(), user.getRole().name(), jwtUtil.getExpirationMs());
    }

    public AuthResponse login(LoginRequest request) {
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password())
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String role = principal.getUser().getRole().name();
        String token = jwtUtil.generateToken(principal.getUsername(), role);

        return AuthResponse.of(token, principal.getUsername(), role, jwtUtil.getExpirationMs());
    }
}
