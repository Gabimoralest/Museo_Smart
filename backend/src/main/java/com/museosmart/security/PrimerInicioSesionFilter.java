package com.museosmart.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.dto.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Impide el uso de operaciones administrativas mientras el usuario autenticado
 * tiene primerInicioSesion=true. Debe cambiar la contrasena antes. La
 * comprobacion es efectiva en el backend, no solo en el cliente.
 *
 * Cubre las rutas de administracion de exhibiciones y de gestion de usuarios.
 */
@Component
public class PrimerInicioSesionFilter extends OncePerRequestFilter {

    private static final List<String> RUTAS_PROTEGIDAS = List.of(
            "/api/v1/admin/exhibiciones",
            "/api/v1/admin/usuarios");

    private final ObjectMapper objectMapper;

    public PrimerInicioSesionFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (esRutaProtegida(request.getRequestURI())) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UsuarioAdminPrincipal principal
                    && principal.isPrimerInicioSesion()) {
                escribirBloqueo(response, request);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean esRutaProtegida(String uri) {
        return RUTAS_PROTEGIDAS.stream().anyMatch(uri::startsWith);
    }

    private void escribirBloqueo(HttpServletResponse response, HttpServletRequest request) throws IOException {
        ApiErrorResponse body = new ApiErrorResponse(
                OffsetDateTime.now(),
                HttpStatus.FORBIDDEN.value(),
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                "Debe cambiar su contraseña antes de usar las operaciones administrativas",
                request.getRequestURI(),
                null);
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), body);
    }
}
