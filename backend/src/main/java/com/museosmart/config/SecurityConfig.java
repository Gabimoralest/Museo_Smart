package com.museosmart.config;

import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final PrimerInicioSesionFilter primerInicioSesionFilter;
    private final RestSecurityHandlers restSecurityHandlers;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          PrimerInicioSesionFilter primerInicioSesionFilter,
                          RestSecurityHandlers restSecurityHandlers) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.primerInicioSesionFilter = primerInicioSesionFilter;
        this.restSecurityHandlers = restSecurityHandlers;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Autenticacion: login publico; cambio obligatorio requiere autenticarse.
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/cambiar-contrasena").authenticated()

                        // Recuperacion de contrasena: publica (respuesta uniforme).
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/recuperacion/solicitar",
                                "/api/v1/auth/recuperacion/verificar",
                                "/api/v1/auth/recuperacion/restablecer").permitAll()

                        // Consultas publicas de visitantes.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/salas",
                                "/api/v1/salas/*",
                                "/api/v1/salas/*/exhibiciones",
                                "/api/v1/exhibiciones",
                                "/api/v1/exhibiciones/*").permitAll()

                        // Swagger / OpenAPI / health en desarrollo.
                        .requestMatchers(
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/actuator/health",
                                "/actuator/info").permitAll()

                        // CRUD administrativo de exhibiciones: ADMIN y SUPERADMIN.
                        .requestMatchers("/api/v1/admin/exhibiciones/**").hasAnyRole("ADMIN", "SUPERADMIN")

                        // Gestion de cuentas de administradores: SOLO SUPERADMIN.
                        // Debe ir antes de anyRequest() para que no quede anulada.
                        .requestMatchers("/api/v1/admin/usuarios/**").hasRole("SUPERADMIN")

                        // Cualquier otra ruta requiere autenticacion.
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restSecurityHandlers)
                        .accessDeniedHandler(restSecurityHandlers)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(primerInicioSesionFilter, JwtAuthenticationFilter.class);

        return http.build();
    }
}
