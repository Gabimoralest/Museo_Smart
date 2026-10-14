package com.museosmart.controller;

import com.museosmart.config.SecurityConfig;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.security.UsuarioAdminPrincipal;
import com.museosmart.service.ExhibicionService;
import com.museosmart.service.SalaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica la politica de seguridad de /api/v1/admin/usuarios/** (fase de
 * refuerzo, antes de crear el controlador real). El controlador anidado es un
 * fixture de prueba que devuelve 200: permite distinguir "paso la seguridad"
 * (200) de "rechazado" (401/403).
 */
@WebMvcTest(controllers = {SalaController.class, ExhibicionAdminController.class})
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class,
        UsuariosSecurityConfigTest.UsuariosFixtureController.class})
class UsuariosSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SalaService salaService;

    @MockBean
    private ExhibicionService exhibicionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    @org.junit.jupiter.api.BeforeEach
    void stubExhibicionesListarTodas() {
        org.mockito.Mockito.lenient()
                .when(exhibicionService.listarTodas())
                .thenReturn(java.util.List.of());
    }

    @RestController
    static class UsuariosFixtureController {
        @GetMapping("/api/v1/admin/usuarios")
        String ping() {
            return "ok";
        }
    }

    private Authentication auth(String rol, boolean primerInicio) {
        UsuarioAdminPrincipal principal = new UsuarioAdminPrincipal(
                1L, "Prueba", "prueba@museo.com", null, rol, primerInicio, true);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + rol)));
    }

    // ---------- Rutas de usuarios: autorizacion por rol ----------

    @Test
    @DisplayName("SUPERADMIN con primer inicio completado pasa la autorizacion (200)")
    void superadmin_ok() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios").with(authentication(auth("SUPERADMIN", false))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ADMIN no puede acceder a rutas de usuarios (403)")
    void admin_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios").with(authentication(auth("ADMIN", false))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("visitante anonimo no puede acceder a rutas de usuarios (401)")
    void anonimo_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    // ---------- Rutas de usuarios: primer inicio ----------

    @Test
    @DisplayName("SUPERADMIN con primerInicioSesion=true recibe 403 en rutas de usuarios")
    void superadmin_primerInicio_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios").with(authentication(auth("SUPERADMIN", true))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value(
                        "Debe cambiar su contraseña antes de usar las operaciones administrativas"));
    }

    // ---------- Rutas publicas siguen funcionando ----------

    @Test
    @DisplayName("la consulta publica de salas sigue siendo accesible sin autenticacion")
    void publicoSigueFuncionando() throws Exception {
        mockMvc.perform(get("/api/v1/salas"))
                .andExpect(status().isOk());
    }

    // ---------- Exhibiciones mantienen sus reglas ----------

    @Test
    @DisplayName("ADMIN sigue autorizado en rutas de exhibiciones (no 401/403)")
    void exhibiciones_adminSigueAutorizado() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .with(authentication(auth("ADMIN", false))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("SUPERADMIN con primerInicioSesion=true sigue bloqueado en exhibiciones (403)")
    void exhibiciones_primerInicio_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exhibiciones")
                        .with(authentication(auth("SUPERADMIN", true))))
                .andExpect(status().isForbidden());
    }

    // Helper de import estatico para legibilidad.
    private static org.springframework.test.web.servlet.request.RequestPostProcessor authentication(
            Authentication authentication) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                .authentication(authentication);
    }
}
