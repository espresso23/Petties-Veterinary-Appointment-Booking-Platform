package com.petties.petties.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.util.function.Function;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret; // để mã hóa token

    @Value("${jwt.expiration}")
    private Long jwtExpiration; // để xác định thời gian sống của token

    @Value("${jwt.refresh-expiration}")
    private Long jwtRefreshExpiration;// để xác định thời gian sống của token refresh

    private SecretKey getSigningKey() {// function dùng để lấy secret key
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UUID userId, String username, String role) {// function dùng để tạo token
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        return Jwts.builder()
                .subject(username)
                .claim("userId", userId.toString())
                .claim("role", role)
                .claim("type", "access")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String generateRefreshToken(UUID userId, String username) {// function dùng để tạo token refresh
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtRefreshExpiration);

        return Jwts.builder()
                .subject(username)
                .claim("userId", userId.toString())
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String getTokenType(String token) {
        return getClaimFromToken(token, claims -> claims.get("type", String.class));
    }

    public String getUsernameFromToken(String token) {
        return getClaimFromToken(token, Claims::getSubject);
    }

    public UUID getUserIdFromToken(String token) {
        String userIdStr = getClaimFromToken(token, claims -> claims.get("userId", String.class));
        try {
            return UUID.fromString(userIdStr);
        } catch (IllegalArgumentException e) {
            org.slf4j.LoggerFactory.getLogger(JwtTokenProvider.class).error("Invalid UUID in token: {}", userIdStr);
            throw new IllegalArgumentException("Token contains invalid User ID format: " + userIdStr);
        }
    }

    public String getRoleFromToken(String token) {
        return getClaimFromToken(token, claims -> claims.get("role", String.class));
    }

    public Date getExpirationDateFromToken(String token) {
        return getClaimFromToken(token, Claims::getExpiration);
    }

    public <T> T getClaimFromToken(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = getAllClaimsFromToken(token);
        return claimsResolver.apply(claims);
    }

    private Claims getAllClaimsFromToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Boolean validateToken(String token) {// function dùng để validate token
        try {
            getAllClaimsFromToken(token);
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    private Boolean isTokenExpired(String token) {// function dùng để kiểm tra token có hết hạn hay không
        final Date expiration = getExpirationDateFromToken(token);
        return expiration.before(new Date());
    }
}
