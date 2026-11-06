package com.museosmart.simulador;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.SensorRepository;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * El simulador exige rol SUPERADMIN. Un ADMIN recibe 403. El controlador solo
 * se registra con app.simulador.habilitado=true (las pruebas de 404 con el
 * flag en false viven en {@link SimuladorDeshabilitadoTest}).
 */
@WebMvcTest(controllers = SimuladorController.class,
        properties = "app.simulador.habilitado=true")
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class SimuladorSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SimuladorService simuladorService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    @Test
    @DisplayName("SUPERADMIN puede consultar los escenarios activos")
    @WithMockUser(roles = "SUPERADMIN")
    void superadmin_puedeConsultar() throws Exception {
        when(simuladorService.estado()).thenReturn(SimuladorEstadoResponse.vacio());
        mockMvc.perform(get("/api/v1/admin/simulador/escenarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.escenarios.length()").value(0));
    }

    @Test
    @DisplayName("ADMIN no puede consultar ni activar escenarios (403)")
    @WithMockUser(roles = "ADMIN")
    void admin_recibe403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/simulador/escenarios"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/simulador/escenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipo\":\"FALLA_CLIMA\",\"sala\":\"SALA_1\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("sin autenticacion se rechaza (401)")
    void anonimo_recibe401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/simulador/escenarios"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("SUPERADMIN activa un escenario y recibe el estado")
    @WithMockUser(roles = "SUPERADMIN")
    void superadmin_activaEscenario() throws Exception {
        when(simuladorService.activar(any(), anyString())).thenReturn(SimuladorEstadoResponse.vacio());
        mockMvc.perform(post("/api/v1/admin/simulador/escenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tipo\":\"FALLA_CLIMA\",\"sala\":\"SALA_1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.horarioForzado").value(false));
    }

    @Test
    @DisplayName("SUPERADMIN restablece todos los escenarios")
    @WithMockUser(roles = "SUPERADMIN")
    void superadmin_restablece() throws Exception {
        when(simuladorService.restablecer(any(), anyString())).thenReturn(SimuladorEstadoResponse.vacio());
        mockMvc.perform(post("/api/v1/admin/simulador/restablecer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"todo\":true}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("el cuerpo invalido (sin tipo) se rechaza con 400")
    @WithMockUser(roles = "SUPERADMIN")
    void superadmin_cuerpoInvalido() throws Exception {
        mockMvc.perform(post("/api/v1/admin/simulador/escenarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sala\":\"SALA_1\"}"))
                .andExpect(status().isBadRequest());
    }
}
