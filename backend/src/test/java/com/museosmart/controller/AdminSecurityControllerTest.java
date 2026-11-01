package com.museosmart.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.dto.EditarExhibicionRequest;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.service.ExhibicionService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {ExhibicionAdminController.class, AuthController.class})
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class AdminSecurityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ExhibicionService exhibicionService;

    @MockBean
    private com.museosmart.service.AuthService authService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    // ---------- Listado administrativo ----------

    @Test
    @DisplayName("ADMIN autenticado puede listar todas las exhibiciones (200)")
    @WithMockUser(roles = "ADMIN")
    void admin_puedeListar() throws Exception {
        when(exhibicionService.listarTodas()).thenReturn(List.of(exhibicion(1L, true), exhibicion(2L, false)));

        mockMvc.perform(get("/api/v1/admin/exhibiciones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].activa").value(false));
    }

    @Test
    @DisplayName("visitante anónimo no puede listar exhibiciones (401)")
    void anonimo_noPuedeListar() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exhibiciones"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("rol sin permiso no puede listar exhibiciones (403)")
    @WithMockUser(roles = "VISITANTE")
    void rolSinPermiso_noPuedeListar() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exhibiciones"))
                .andExpect(status().isForbidden());
    }

    // ---------- Creacion fuera de alcance ----------

    @Test
    @DisplayName("crear exhibición ya no forma parte del contrato (POST no permitido en la colección)")
    @WithMockUser(roles = "ADMIN")
    void crear_noMapeado() throws Exception {
        mockMvc.perform(post("/api/v1/admin/exhibiciones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isMethodNotAllowed());
    }

    // ---------- Edicion ----------

    @Test
    @DisplayName("ADMIN puede editar una exhibición con PUT (200, versión incrementada)")
    @WithMockUser(roles = "ADMIN")
    void editar_ok() throws Exception {
        when(exhibicionService.editar(anyLong(), any(EditarExhibicionRequest.class), any())).thenReturn(exhibicion(5L, true));
        when(exhibicionService.obtenerPorId(5L)).thenReturn(exhibicion(5L, true));

        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("Nuevo título", "corta", "desc", null, null, "autor", null, 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5));
    }

    @Test
    @DisplayName("editar con título en blanco devuelve 400 (validación)")
    @WithMockUser(roles = "ADMIN")
    void editar_tituloVacio_400() throws Exception {
        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("   ", "corta", "desc", null, null, "autor", null, 0))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erroresValidacion.titulo").exists());
    }

    @Test
    @DisplayName("editar con versión obsoleta devuelve 409 con el mensaje esperado")
    @WithMockUser(roles = "ADMIN")
    void editar_versionObsoleta_409() throws Exception {
        when(exhibicionService.editar(anyLong(), any(EditarExhibicionRequest.class), any()))
                .thenThrow(new com.museosmart.exception.ConflictoException(
                        "Otro administrador modificó esta exhibición; recarga para ver los cambios"));

        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("Nuevo", "corta", null, null, null, null, null, 3))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensaje").value(
                        "Otro administrador modificó esta exhibición; recarga para ver los cambios"));
    }

    @Test
    @DisplayName("editar sin token devuelve 401")
    void editar_anonimo_401() throws Exception {
        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("Nuevo", "corta", null, null, null, null, null, 0))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("editar con rol sin permiso devuelve 403")
    @WithMockUser(roles = "VISITANTE")
    void editar_rolSinPermiso_403() throws Exception {
        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("Nuevo", "corta", null, null, null, null, null, 0))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("ver historial devuelve 200 con la lista")
    @WithMockUser(roles = "ADMIN")
    void historial_ok() throws Exception {
        when(exhibicionService.historial(5L)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/exhibiciones/5/historial"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("ver historial sin token devuelve 401")
    void historial_anonimo_401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exhibiciones/5/historial"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("ADMIN con primerInicioSesion=true no puede editar (403)")
    void editar_primerInicioPendiente_403() throws Exception {
        com.museosmart.security.UsuarioAdminPrincipal principal =
                new com.museosmart.security.UsuarioAdminPrincipal(
                        1L, "Gabs", "gabs@museo.com", null, "ADMIN", true, true);
        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        principal, null, java.util.List.of(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN")));

        mockMvc.perform(put("/api/v1/admin/exhibiciones/5")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new EditarExhibicionRequest("Nuevo", "corta", null, null, null, null, null, 0))))
                .andExpect(status().isForbidden());
    }

    // ---------- Activacion / desactivacion ----------

    @Test
    @DisplayName("cambiar estado de exhibición devuelve 200 con el nuevo estado")
    @WithMockUser(roles = "ADMIN")
    void cambiarEstado_ok() throws Exception {
        Exhibicion inactiva = exhibicion(5L, false);
        when(exhibicionService.cambiarEstado(anyLong(), any(CambioEstadoRequest.class), any())).thenReturn(inactiva);

        mockMvc.perform(patch("/api/v1/admin/exhibiciones/5/estado")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CambioEstadoRequest(false, "Mantenimiento"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activa").value(false));
    }

    @Test
    @DisplayName("visitante anónimo no puede cambiar el estado (401)")
    void anonimo_noPuedeCambiarEstado() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/exhibiciones/5/estado")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"activa\":false}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("login público no requiere autenticación previa (se invoca el servicio)")
    void login_publico() throws Exception {
        when(authService.login(any())).thenReturn(new com.museosmart.dto.LoginResponse(
                "tok", "Bearer", "a@museo.com", "ADMIN", false, 60));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"a@museo.com\",\"contrasena\":\"Secreta123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("tok"));
    }

    private Exhibicion exhibicion(Long id, boolean activa) {
        Sala sala = new Sala();
        setField(sala, "id", 1L);
        sala.setNombre("Pintura histórica");
        Exhibicion e = new Exhibicion();
        setField(e, "id", id);
        e.setSala(sala);
        e.setCodigo("codigo-" + id);
        e.setTitulo("Título");
        e.setActiva(activa);
        return e;
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
