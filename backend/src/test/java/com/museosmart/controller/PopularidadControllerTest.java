package com.museosmart.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.dto.RegistrarVisitaRequest;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.service.PopularidadService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {PopularidadController.class, PopularidadAdminController.class})
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class PopularidadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PopularidadService popularidadService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    private String cuerpo(String exhibicionId, String sesion, String fuente) {
        try {
            return objectMapper.writeValueAsString(
                    new RegistrarVisitaRequest(exhibicionId != null ? Long.valueOf(exhibicionId) : null,
                            sesion, fuente));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    // ---------- Registro publico ----------

    @Test
    @DisplayName("POST /api/v1/popularidad/visitas registra sin autenticacion (201)")
    void registrar_sinAutenticacion_201() throws Exception {
        when(popularidadService.registrarVisita(eq(1L), any(), eq("CURSOR"))).thenReturn(true);

        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("1", UUID.randomUUID().toString(), "CURSOR")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.registrada").value(true))
                .andExpect(jsonPath("$.exhibicionId").value(1));
    }

    @Test
    @DisplayName("una interaccion deduplicada devuelve 201 con registrada=false")
    void registrar_deduplicada_registradaFalse() throws Exception {
        when(popularidadService.registrarVisita(anyLong(), any(), anyString())).thenReturn(false);

        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("1", null, "QR")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.registrada").value(false));
    }

    @Test
    @DisplayName("exhibicion inexistente/inactiva devuelve 404 con formato de error")
    void registrar_exhibicionNoActiva_404() throws Exception {
        when(popularidadService.registrarVisita(anyLong(), any(), anyString()))
                .thenThrow(new RecursoNoEncontradoException("No existe la exhibición con id 99"));

        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("99", null, "CURSOR")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.ruta").value("/api/v1/popularidad/visitas"));
    }

    @Test
    @DisplayName("fuente no permitida es rechazada con 400 por validacion")
    void registrar_fuenteInvalida_400() throws Exception {
        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("1", null, "HACK")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.erroresValidacion.fuente").exists());

        verify(popularidadService, never()).registrarVisita(anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("exhibicionId nulo es rechazado con 400")
    void registrar_exhibicionIdNulo_400() throws Exception {
        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo(null, null, "CURSOR")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erroresValidacion.exhibicionId").exists());

        verify(popularidadService, never()).registrarVisita(any(), any(), any());
    }

    @Test
    @DisplayName("sesion anonima con formato invalido es rechazada con 400 por validacion")
    void registrar_sesionInvalida_400() throws Exception {
        mockMvc.perform(post("/api/v1/popularidad/visitas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpo("1", "no-es-uuid", "CURSOR")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erroresValidacion.sesionAnonimaId").exists());
    }

    // ---------- Ranking administrativo ----------

    @Test
    @DisplayName("ADMIN autenticado consulta el ranking completo (200)")
    @WithMockUser(roles = "ADMIN")
    void ranking_completo_admin_200() throws Exception {
        when(popularidadService.rankingCompleto()).thenReturn(List.of(
                fila(1L, "pintura-historica-01", 3L),
                fila(2L, "pintura-historica-02", 3L),
                fila(3L, "ceramica-artesania-01", 0L)));

        mockMvc.perform(get("/api/v1/admin/popularidad/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].posicion").value(1))
                .andExpect(jsonPath("$[0].totalVisitasValidas").value(3))
                .andExpect(jsonPath("$[1].posicion").value(1))
                .andExpect(jsonPath("$[2].posicion").value(3));
    }

    @Test
    @DisplayName("el ranking admite el parametro limite (delega en rankingLimitado)")
    @WithMockUser(roles = "ADMIN")
    void ranking_limitado_200() throws Exception {
        when(popularidadService.rankingLimitado(2)).thenReturn(List.of(fila(1L, "a", 5L)));

        mockMvc.perform(get("/api/v1/admin/popularidad/ranking").param("limite", "2"))
                .andExpect(status().isOk());

        verify(popularidadService).rankingLimitado(2);
        verify(popularidadService, never()).rankingCompleto();
    }

    @Test
    @DisplayName("limite invalido (<=0) devuelve 400 con formato de error")
    @WithMockUser(roles = "ADMIN")
    void ranking_limiteInvalido_400() throws Exception {
        when(popularidadService.rankingLimitado(0))
                .thenThrow(new ReglaNegocioException("El limite del ranking debe ser mayor que cero"));

        mockMvc.perform(get("/api/v1/admin/popularidad/ranking").param("limite", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("visitante anonimo no puede consultar el ranking (401)")
    void ranking_anonimo_401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/popularidad/ranking"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("rol sin permiso no puede consultar el ranking (403)")
    @WithMockUser(roles = "VISITANTE")
    void ranking_rolSinPermiso_403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/popularidad/ranking"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("SUPERADMIN tambien puede consultar el ranking (200)")
    @WithMockUser(roles = "SUPERADMIN")
    void ranking_superadmin_200() throws Exception {
        when(popularidadService.rankingCompleto()).thenReturn(List.of(fila(1L, "a", 1L)));

        mockMvc.perform(get("/api/v1/admin/popularidad/ranking"))
                .andExpect(status().isOk());
    }

    private RankingExhibicionView fila(Long exhibicionId, String codigo, Long total) {
        return new RankingExhibicionView() {
            @Override
            public Long getExhibicionId() {
                return exhibicionId;
            }

            @Override
            public String getCodigo() {
                return codigo;
            }

            @Override
            public String getTitulo() {
                return "[PROVISIONAL] " + codigo;
            }

            @Override
            public Long getSalaId() {
                return 1L;
            }

            @Override
            public String getSalaNombre() {
                return "Pintura histórica";
            }

            @Override
            public Long getTotalVisitasValidas() {
                return total;
            }
        };
    }
}
