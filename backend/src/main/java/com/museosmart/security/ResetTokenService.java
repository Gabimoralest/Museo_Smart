package com.museosmart.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * Emite y valida un token temporal de restablecimiento, distinto del JWT de
 * sesion. Se usa como segunda prueba de autorizacion tras verificar el codigo,
 * evitando que el correo por si solo autorice el cambio de contrasena.
 *
 * El token incluye la finalidad 'reset' y una vida corta. La clave se deriva
 * del mismo secreto configurado para JWT.
 */
@Component
public class ResetTokenService {

    private static final String PURPOSE = "reset";

    private final SecretKey key;
    private final long expiracionMinutos;

    public ResetTokenService(
            @Value("${app.security.jwt.secret:}") String secret,
            @Value("${app.security.reset.expiracion-minutos:15}") long expiracionMinutos) {
        this.key = construirClave(secret);
        this.expiracionMinutos = expiracionMinutos;
    }

    private SecretKey construirClave(String secret) {
        if (secret != null && !secret.isBlank()) {
            byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 32) {
                throw new IllegalStateException(
                        "app.security.jwt.secret debe tener al menos 32 caracteres para HMAC-SHA256");
            }
            return Keys.hmacShaKeyFor(bytes);
        }
        byte[] aleatoria = new byte[32];
        new SecureRandom().nextBytes(aleatoria);
        return Keys.hmacShaKeyFor(aleatoria);
    }

    public String generar(String correo) {
        Instant ahora = Instant.now();
        return Jwts.builder()
                .subject(correo)
                .claim("purpose", PURPOSE)
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(expiracionMinutos, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    /** Valida firma, expiracion y finalidad. Devuelve el correo (subject). */
    public String validarYExtraerCorreo(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        if (!PURPOSE.equals(claims.get("purpose", String.class))) {
            throw new JwtException("Token de finalidad incorrecta");
        }
        return claims.getSubject();
    }

    public long getExpiracionMinutos() {
        return expiracionMinutos;
    }
}
