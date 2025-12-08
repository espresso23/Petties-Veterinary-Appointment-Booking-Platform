package com.petties.petties.service;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.auth.AuthResponse;
import com.petties.petties.dto.auth.LoginRequest;
import com.petties.petties.dto.auth.RegisterRequest;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.UnauthorizedException;
import com.petties.petties.model.BlacklistedToken;
import com.petties.petties.model.RefreshToken;
import com.petties.petties.model.User;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.RefreshTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.util.TokenUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BlacklistedTokenRepository blacklistedTokenRepository;
    
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Check if username or email already exists
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResourceAlreadyExistsException("Username already exists");
        }
        
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResourceAlreadyExistsException("Email already exists");
        }
        
        // Create new user
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setRole(request.getRole());
        
        User savedUser = userRepository.save(user);
        
        // Generate tokens
        String accessToken = tokenProvider.generateToken(
                savedUser.getUserId(),
                savedUser.getUsername(),
                savedUser.getRole().name()
        );
        String refreshToken = tokenProvider.generateRefreshToken(
                savedUser.getUserId(),
                savedUser.getUsername()
        );
        
        // Save refresh token to database
        saveRefreshToken(savedUser.getUserId(), refreshToken);
        
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(savedUser.getUserId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .role(savedUser.getRole().name())
                .build();
    }
    
    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(),
                        request.getPassword()
                )
        );
        
        SecurityContextHolder.getContext().setAuthentication(authentication);
        
        UserDetailsServiceImpl.UserPrincipal userPrincipal = 
                (UserDetailsServiceImpl.UserPrincipal) authentication.getPrincipal();
        
        String token = tokenProvider.generateToken(
                userPrincipal.getUserId(),
                userPrincipal.getUsername(),
                userPrincipal.getRole()
        );
        
        User user = userRepository.findById(userPrincipal.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        
        // Generate refresh token
        String refreshToken = tokenProvider.generateRefreshToken(
                user.getUserId(),
                user.getUsername()
        );
        
        // Delete old refresh tokens for this user (rotation)
        refreshTokenRepository.deleteAllByUserId(user.getUserId());
        
        // Save new refresh token
        saveRefreshToken(user.getUserId(), refreshToken);
        
        return AuthResponse.builder()
                .accessToken(token)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
    
    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
        // Validate token format and expiration
        if (!tokenProvider.validateToken(refreshToken)) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }
        
        // Check if it's actually a refresh token
        String tokenType = tokenProvider.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            throw new UnauthorizedException("Invalid token type");
        }
        
        // Check if token exists in database
        String tokenHash = TokenUtil.hashToken(refreshToken);
        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("Refresh token not found"));
        
        // Check if token is expired
        if (storedToken.isExpired()) {
            refreshTokenRepository.delete(storedToken);
            throw new UnauthorizedException("Refresh token expired");
        }
        
        // Get user info
        String username = tokenProvider.getUsernameFromToken(refreshToken);
        UUID userId = tokenProvider.getUserIdFromToken(refreshToken);
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        
        // Generate new tokens
        String newAccessToken = tokenProvider.generateToken(
                userId,
                username,
                user.getRole().name()
        );
        String newRefreshToken = tokenProvider.generateRefreshToken(
                userId,
                username
        );
        
        // Delete old refresh token (rotation)
        refreshTokenRepository.delete(storedToken);
        
        // Save new refresh token
        saveRefreshToken(userId, newRefreshToken);
        
        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
    
    @Transactional
    public void logout(String accessToken) {
        if (!tokenProvider.validateToken(accessToken)) {
            throw new UnauthorizedException("Invalid access token");
        }
        
        // Check if it's an access token
        String tokenType = tokenProvider.getTokenType(accessToken);
        if (!"access".equals(tokenType)) {
            throw new UnauthorizedException("Invalid token type");
        }
        
        UUID userId = tokenProvider.getUserIdFromToken(accessToken);
        LocalDateTime expiresAt = LocalDateTime.ofInstant(
                tokenProvider.getExpirationDateFromToken(accessToken).toInstant(),
                java.time.ZoneId.systemDefault()
        );
        
        // Blacklist the access token
        String tokenHash = TokenUtil.hashToken(accessToken);
        BlacklistedToken blacklistedToken = new BlacklistedToken();
        blacklistedToken.setTokenHash(tokenHash);
        blacklistedToken.setUserId(userId);
        blacklistedToken.setExpiresAt(expiresAt);
        blacklistedTokenRepository.save(blacklistedToken);
        
        // Delete all refresh tokens for this user
        refreshTokenRepository.deleteAllByUserId(userId);
    }
    
    private void saveRefreshToken(UUID userId, String refreshToken) {
        String tokenHash = TokenUtil.hashToken(refreshToken);
        LocalDateTime expiresAt = LocalDateTime.ofInstant(
                tokenProvider.getExpirationDateFromToken(refreshToken).toInstant(),
                java.time.ZoneId.systemDefault()
        );
        
        RefreshToken token = new RefreshToken();
        token.setUserId(userId);
        token.setTokenHash(tokenHash);
        token.setExpiresAt(expiresAt);
        refreshTokenRepository.save(token);
    }
    
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("User not authenticated");
        }
        
        UserDetailsServiceImpl.UserPrincipal userPrincipal = 
                (UserDetailsServiceImpl.UserPrincipal) authentication.getPrincipal();
        
        return userRepository.findById(userPrincipal.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}

