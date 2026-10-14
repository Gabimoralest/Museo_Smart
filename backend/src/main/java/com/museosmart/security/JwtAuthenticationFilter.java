package com.museosmart.security;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.repository.UsuarioAdminRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Extrae el JWT del encabezado Authorization: Bearer, valida firma/expiracion y
 * comprueba, ademas, contra la base de datos:
 *   - que el usuario exista y su estado sea ACTIVO,
 *   - que la version de seguridad del token (claim 'tv') coincida con la actual.
 *
 * El principal se construye con los datos ACTUALES del usuario (rol, primer
 * inicio), no con los claims del token, que pueden estar obsoletos. Un token
 * invalido (firma, expiracion, tv ausente/desajustado, usuario inexistente o no
 * ACTIVO) no autentica: la peticion sigue anonima y las rutas protegidas
 * responden 401.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final UsuarioAdminRepository usuarioAdminRepository;

    public JwtAuthenticationFilter(JwtService jwtService,
                                   UsuarioAdminRepository usuarioAdminRepository) {
        this.jwtService = jwtService;
        this.usuarioAdminRepository = usuarioAdminRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(PREFIX.length());
            try {
                Claims claims = jwtService.parsear(token);
                Long id = claims.get(JwtService.CLAIM_ID, Number.class) != null
                        ? claims.get(JwtService.CLAIM_ID, Number.class).longValue()
                        : null;
                Integer tv = claims.get(JwtService.CLAIM_TOKEN_VERSION, Integer.class);

                if (id != null && tv != null) {
                    Optional<UsuarioAdmin> posible = usuarioAdminRepository.findById(id);
                    if (posible.isPresent()) {
                        UsuarioAdmin usuario = posible.get();
                        if (esAutenticable(usuario, tv)) {
                            autenticar(request, usuario);
                        }
                    }
                }
            } catch (JwtException | IllegalArgumentException ex) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean esAutenticable(UsuarioAdmin usuario, int tvDelToken) {
        return "ACTIVO".equals(usuario.getEstado())
                && usuario.getTokenVersion() == tvDelToken;
    }

    private void autenticar(HttpServletRequest request, UsuarioAdmin usuario) {
        UsuarioAdminPrincipal principal = new UsuarioAdminPrincipal(usuario);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
