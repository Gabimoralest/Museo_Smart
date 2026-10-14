package com.museosmart.security;

import com.museosmart.config.SecurityConfig;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.repository.UsuarioAdminRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica la revocacion de JWT a nivel de filtro: estado de cuenta y version
 * de seguridad (claim tv) contra la base de datos (aqui, repositorio mockeado).
 * El fixture expone una ruta protegida que devuelve 200 si la autenticacion pasa.
 */
@WebMvcTest(controllers = com.museosmart.controller.SalaController.class)
@org.springframework.test.context.TestPropertySource(properties = {
        "app.security.jwt.secret=clave-de-prueba-suficientemente-larga-1234567890"
})
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class,
        RestSecurityHandlers.class, JwtService.class, JwtRevocationFilterTest.FixtureController.class})
class JwtRevocationFilterTest {

    private static final String SECRET = "clave-de-prueba-suficientemente-larga-1234567890";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private com.museosmart.service.SalaService salaService;

    @MockBean
    private UsuarioAdminRepository usuarioAdminRepository;

    @org.springframework.web.bind.annotation.RestController
    static class FixtureController {
        @org.springframework.web.bind.annotation.GetMapping("/api/v1/admin/exhibiciones")
        String admin() {
            return "ok";
        }
    }

    private UsuarioAdmin usuario(Long id, String estado, int tokenVersion, boolean primerInicio) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", id);
        u.setNombre("Nombre");
        u.setCorreo("admin@museo.com");
        u.setRol("ADMIN");
        u.setEstado(estado);
        u.setPrimerInicioSesion(primerInicio);
        u.setTokenVersion(tokenVersion);
        return u;
    }

    private String tokenDe(UsuarioAdmin usuario) {
        return jwtService.generarToken(usuario);
    }

    @Test
    @DisplayName("usuario ACTIVO con tv coincidente accede (200)")
    void activo_tvCoincide_accede() throws Exception {
        UsuarioAdmin usuario = usuario(1L, "ACTIVO", 0, false);
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(usuario));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + tokenDe(usuario)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("usuario INACTIVO es rechazado aunque el token sea válido (401)")
    void inactivo_rechazado() throws Exception {
        // El token se emite como ACTIVO/tv=0, pero en BD ya está INACTIVO.
        UsuarioAdmin alEmitir = usuario(1L, "ACTIVO", 0, false);
        String token = tokenDe(alEmitir);
        UsuarioAdmin enBd = usuario(1L, "INACTIVO", 0, false);
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(enBd));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("usuario BLOQUEADO es rechazado (401)")
    void bloqueado_rechazado() throws Exception {
        UsuarioAdmin token = usuario(1L, "ACTIVO", 0, false);
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(usuario(1L, "BLOQUEADO", 0, false)));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + tokenDe(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("token con tv antiguo tras cambio de contraseña es rechazado (401)")
    void tvAntiguo_rechazado() throws Exception {
        UsuarioAdmin alEmitir = usuario(1L, "ACTIVO", 0, false);
        String token = tokenDe(alEmitir);
        // Tras el cambio, token_version pasa a 1.
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(usuario(1L, "ACTIVO", 1, false)));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("token emitido con la nueva versión funciona (200)")
    void tvNuevo_funciona() throws Exception {
        UsuarioAdmin usuario = usuario(1L, "ACTIVO", 1, false);
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(usuario));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + tokenDe(usuario)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("usuario inexistente en BD es rechazado (401)")
    void usuarioInexistente_rechazado() throws Exception {
        UsuarioAdmin token = usuario(1L, "ACTIVO", 0, false);
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + tokenDe(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("token sin claim tv es rechazado (401)")
    void sinTv_rechazado() throws Exception {
        // Token construido con un JwtService que emite sin tv: usamos uno manual.
        String tokenSinTv = io.jsonwebtoken.Jwts.builder()
                .subject("admin@museo.com")
                .claim(JwtService.CLAIM_ID, 1L)
                .claim(JwtService.CLAIM_ROL, "ADMIN")
                .issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + 60000))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(SECRET.getBytes()))
                .compact();
        when(usuarioAdminRepository.findById(1L)).thenReturn(Optional.of(usuario(1L, "ACTIVO", 0, false)));

        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .header("Authorization", "Bearer " + tokenSinTv))
                .andExpect(status().isUnauthorized());
    }

    private void setField(Object target, String campo, Object valor) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(campo);
            field.setAccessible(true);
            field.set(target, valor);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
