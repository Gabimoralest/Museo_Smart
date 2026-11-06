package com.museosmart.simulador;

import com.museosmart.config.SecurityConfig;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Con APP_SIMULADOR_HABILITADO=false el controlador NO se registra: las rutas
 * responden 404 incluso para SUPERADMIN. Es el comportamiento por defecto en
 * una instalacion normal.
 */
@WebMvcTest(controllers = SimuladorController.class,
        properties = "app.simulador.habilitado=false")
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class SimuladorDeshabilitadoTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SimuladorService simuladorService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    @Test
    @DisplayName("con el flag en false, SUPERADMIN recibe 404")
    @WithMockUser(roles = "SUPERADMIN")
    void deshabilitado_GET_404() throws Exception {
        mockMvc.perform(get("/api/v1/admin/simulador/escenarios"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("con el flag en false, activar responde 404")
    @WithMockUser(roles = "SUPERADMIN")
    void deshabilitado_POST_404() throws Exception {
        mockMvc.perform(post("/api/v1/admin/simulador/escenarios")
                        .contentType("application/json")
                        .content("{\"tipo\":\"FALLA_CLIMA\",\"sala\":\"SALA_1\"}"))
                .andExpect(status().isNotFound());
    }
}
