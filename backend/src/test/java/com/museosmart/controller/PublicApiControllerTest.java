package com.museosmart.controller;

import com.museosmart.config.SecurityConfig;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.service.ExhibicionService;
import com.museosmart.service.SalaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {SalaController.class, ExhibicionController.class})
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class PublicApiControllerTest {

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

    // ---------- Salas ----------

    @Test
    @DisplayName("GET /api/v1/salas devuelve 200 y la lista de salas sin autenticacion")
    void listarSalas_okSinAutenticacion() throws Exception {
        when(salaService.listarTodas()).thenReturn(List.of(sala(1L, "Pintura histórica", (short) 1),
                sala(2L, "Cerámica y artesanía", (short) 2)));

        mockMvc.perform(get("/api/v1/salas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].nombre").value("Pintura histórica"))
                .andExpect(jsonPath("$[0].orden").value(1))
                .andExpect(jsonPath("$[0].codigo3d").value("SALA_1"));
    }

    @Test
    @DisplayName("GET /api/v1/salas/{id} devuelve 200 cuando la sala existe")
    void obtenerSala_ok() throws Exception {
        when(salaService.obtenerPorId(1L)).thenReturn(sala(1L, "Pintura histórica", (short) 1));

        mockMvc.perform(get("/api/v1/salas/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.nombre").value("Pintura histórica"));
    }

    @Test
    @DisplayName("GET /api/v1/salas/{id} devuelve 404 con formato de error cuando no existe")
    void obtenerSala_404() throws Exception {
        when(salaService.obtenerPorId(99L))
                .thenThrow(new RecursoNoEncontradoException("No existe la sala con id 99"));

        mockMvc.perform(get("/api/v1/salas/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.mensaje").value("No existe la sala con id 99"))
                .andExpect(jsonPath("$.ruta").value("/api/v1/salas/99"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("GET /api/v1/salas/{id} con id no numerico devuelve 400")
    void obtenerSala_idInvalido_devuelve400() throws Exception {
        mockMvc.perform(get("/api/v1/salas/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    // ---------- Exhibiciones ----------

    @Test
    @DisplayName("GET /api/v1/exhibiciones devuelve las exhibiciones activas")
    void listarExhibicionesActivas_ok() throws Exception {
        when(exhibicionService.listarActivas()).thenReturn(List.of(exhibicion(1L, "pintura-historica-01", true)));

        mockMvc.perform(get("/api/v1/exhibiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].codigo").value("pintura-historica-01"))
                .andExpect(jsonPath("$[0].ubicacion3dCodigo").value("EXH_S1_01"))
                .andExpect(jsonPath("$[0].activa").value(true))
                .andExpect(jsonPath("$[0].salaId").value(1))
                .andExpect(jsonPath("$[0].salaNombre").value("Pintura histórica"));
    }

    @Test
    @DisplayName("GET /api/v1/exhibiciones/{id} de una exhibicion inactiva devuelve 404")
    void obtenerExhibicionInactiva_404() throws Exception {
        when(exhibicionService.obtenerActivaPorId(5L))
                .thenThrow(new RecursoNoEncontradoException("No existe la exhibición con id 5"));

        mockMvc.perform(get("/api/v1/exhibiciones/5"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("GET /api/v1/salas/{salaId}/exhibiciones devuelve las exhibiciones de la sala")
    void listarPorSala_ok() throws Exception {
        when(exhibicionService.listarPorSala(1L)).thenReturn(List.of(
                exhibicion(1L, "pintura-historica-01", true),
                exhibicion(2L, "pintura-historica-02", false)));

        mockMvc.perform(get("/api/v1/salas/1/exhibiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].salaId").value(1));
    }

    @Test
    @DisplayName("GET /api/v1/salas/{salaId}/exhibiciones devuelve 404 si la sala no existe")
    void listarPorSala_salaInexistente_404() throws Exception {
        when(exhibicionService.listarPorSala(99L))
                .thenThrow(new RecursoNoEncontradoException("No existe la sala con id 99"));

        mockMvc.perform(get("/api/v1/salas/99/exhibiciones"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.ruta").value("/api/v1/salas/99/exhibiciones"));
    }

    @Test
    @DisplayName("las respuestas de exhibicion no contienen el campo hash_contrasena")
    void respuestas_sinHashContrasena() throws Exception {
        when(exhibicionService.listarActivas()).thenReturn(List.of(exhibicion(1L, "pintura-historica-01", true)));

        mockMvc.perform(get("/api/v1/exhibiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hashContrasena").doesNotExist())
                .andExpect(jsonPath("$[0].hash_contrasena").doesNotExist());
    }

    private Sala sala(Long id, String nombre, Short orden) {
        Sala s = new Sala();
        setField(s, "id", id);
        s.setNombre(nombre);
        s.setEstado("activa");
        s.setOrden(orden);
        s.setCodigo3d("SALA_" + orden);
        return s;
    }

    private Exhibicion exhibicion(Long id, String codigo, boolean activa) {
        Sala sala = sala(1L, "Pintura histórica", (short) 1);
        Exhibicion e = new Exhibicion();
        setField(e, "id", id);
        e.setSala(sala);
        e.setCodigo(codigo);
        setField(e, "ubicacion3d", ubicacion3d("EXH_S1_01", sala));
        e.setTitulo("[PROVISIONAL] " + codigo);
        e.setActiva(activa);
        e.setTempMinC(new BigDecimal("18.00"));
        return e;
    }

    private com.museosmart.entity.Ubicacion3d ubicacion3d(String codigo, Sala sala) {
        com.museosmart.entity.Ubicacion3d u = new com.museosmart.entity.Ubicacion3d();
        setField(u, "id", 1L);
        setField(u, "codigo", codigo);
        setField(u, "sala", sala);
        setField(u, "estado", "OCUPADA");
        return u;
    }

    private void setField(Object target, String campo, Object valor) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(campo);
            field.setAccessible(true);
            field.set(target, valor);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("No se pudo asignar el campo " + campo, ex);
        }
    }
}
