package com.museosmart.security;

import com.museosmart.entity.UsuarioAdmin;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    public static final String CLAIM_ROL = "rol";
    public static final String CLAIM_PRIMER_INICIO = "pio";
    public static final String CLAIM_NOMBRE = "nombre";
    public static final String CLAIM_ID = "uid";
    public static final String CLAIM_TOKEN_VERSION = "tv";

    private final SecretKey key;
    private final long expiracionMinutos;

    public JwtService(
            @Value("${app.security.jwt.secret:}") String secret,
            @Value("${app.security.jwt.expiracion-minutos:60}") long expiracionMinutos) {
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
        // Sin secreto configurado: clave aleatoria en memoria (solo desarrollo).
        // Los tokens dejan de ser validos al reiniciar. No se registra el valor.
        log.warn("JWT_SECRET no configurado. Se usara una clave aleatoria en memoria (solo desarrollo).");
        byte[] aleatoria = new byte[32];
        new SecureRandom().nextBytes(aleatoria);
        return Keys.hmacShaKeyFor(aleatoria);
    }

    public String generarToken(UsuarioAdmin usuario) {
        Instant ahora = Instant.now();
        return Jwts.builder()
                .subject(usuario.getCorreo())
                .claim(CLAIM_ID, usuario.getId())
                .claim(CLAIM_ROL, usuario.getRol())
                .claim(CLAIM_NOMBRE, usuario.getNombre())
                .claim(CLAIM_PRIMER_INICIO, usuario.isPrimerInicioSesion())
                .claim(CLAIM_TOKEN_VERSION, usuario.getTokenVersion())
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(expiracionMinutos, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    /**
     * Valida firma y expiracion. Lanza JwtException si el token es invalido o expirado.
     */
    public Claims parsear(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getExpiracionMinutos() {
        return expiracionMinutos;
    }
}
