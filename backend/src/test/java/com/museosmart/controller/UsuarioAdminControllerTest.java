package com.museosmart.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.ConflictoException;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.security.UsuarioAdminPrincipal;
import com.museosmart.service.UsuarioAdminService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UsuarioAdminController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class UsuarioAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UsuarioAdminService usuarioAdminService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    private Authentication auth(String rol, boolean primerInicio) {
        UsuarioAdminPrincipal principal = new UsuarioAdminPrincipal(
                1L, "Gabs", "gabs@museo.com", null, rol, primerInicio, true);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + rol)));
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor superadmin() {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                .authentication(auth("SUPERADMIN", false));
    }

    private UsuarioAdmin admin(Long id, String rol, String estado) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", id);
        u.setNombre("Nombre");
        u.setCorreo("user" + id + "@museo.com");
        u.setRol(rol);
        u.setEstado(estado);
        u.setPrimerInicioSesion(false);
        u.setHashContrasena("$2a$hash-que-nunca-debe-salir");
        return u;
    }

    // ---------- Seguridad ----------

    @Test
    @DisplayName("SUPERADMIN con primer inicio completado puede listar (200)")
    void superadmin_lista_ok() throws Exception {
        when(usuarioAdminService.listarTodos()).thenReturn(List.of(admin(1L, "ADMIN", "ACTIVO")));

        mockMvc.perform(get("/api/v1/admin/usuarios").with(superadmin()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ADMIN recibe 403 en las rutas de usuarios")
    void admin_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios").with(
                        org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                                .authentication(auth("ADMIN", false))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("anónimo recibe 401 en las rutas de usuarios")
    void anonimo_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("SUPERADMIN con primerInicioSesion=true recibe 403")
    void primerInicio_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/usuarios").with(
                        org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                                .authentication(auth("SUPERADMIN", true))))
                .andExpect(status().isForbidden());
    }

    // ---------- Listar / consultar ----------

    @Test
    @DisplayName("listar devuelve la lista de administradores")
    void listar_ok() throws Exception {
        when(usuarioAdminService.listarTodos()).thenReturn(List.of(
                admin(1L, "SUPERADMIN", "ACTIVO"), admin(2L, "ADMIN", "ACTIVO")));

        mockMvc.perform(get("/api/v1/admin/usuarios").with(superadmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].rol").value("SUPERADMIN"));
    }

    @Test
    @DisplayName("consultar por id existente devuelve 200")
    void obtener_ok() throws Exception {
        when(usuarioAdminService.obtenerPorId(3L)).thenReturn(admin(3L, "ADMIN", "ACTIVO"));

        mockMvc.perform(get("/api/v1/admin/usuarios/3").with(superadmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3));
    }

    @Test
    @DisplayName("consultar por id inexistente devuelve 404")
    void obtener_404() throws Exception {
        when(usuarioAdminService.obtenerPorId(99L))
                .thenThrow(new RecursoNoEncontradoException("No existe el administrador con id 99"));

        mockMvc.perform(get("/api/v1/admin/usuarios/99").with(superadmin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // ---------- Crear ----------

    @Test
    @DisplayName("crear un administrador válido devuelve 201")
    void crear_ok() throws Exception {
        when(usuarioAdminService.crear(eq("Gabs"), eq("nuevo@museo.com"), eq("Secreta123")))
                .thenReturn(admin(10L, "ADMIN", "ACTIVO"));

        mockMvc.perform(post("/api/v1/admin/usuarios").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Gabs\",\"correo\":\"nuevo@museo.com\",\"rol\":\"ADMIN\",\"contrasena\":\"Secreta123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10));
    }

    @Test
    @DisplayName("crear sin contraseña devuelve 400")
    void crear_sinContrasena_400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/usuarios").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Gabs\",\"correo\":\"nuevo@museo.com\",\"rol\":\"ADMIN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erroresValidacion").isNotEmpty());

        verify(usuarioAdminService, never()).crear(any(), any(), any());
    }

    @Test
    @DisplayName("crear con contraseña corta devuelve 400")
    void crear_contrasenaCorta_400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/usuarios").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Gabs\",\"correo\":\"nuevo@museo.com\",\"rol\":\"ADMIN\",\"contrasena\":\"corta\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("crear con correo duplicado devuelve 409")
    void crear_duplicado_409() throws Exception {
        when(usuarioAdminService.crear(any(), any(), any()))
                .thenThrow(new ConflictoException("Ya existe un administrador con el correo nuevo@museo.com"));

        mockMvc.perform(post("/api/v1/admin/usuarios").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Gabs\",\"correo\":\"nuevo@museo.com\",\"rol\":\"ADMIN\",\"contrasena\":\"Secreta123\"}"))
                .andExpect(status().isConflict());
    }

    // ---------- Actualizar ----------

    @Test
    @DisplayName("actualizar sin contraseña es válido y devuelve 200")
    void actualizar_sinContrasena_ok() throws Exception {
        when(usuarioAdminService.actualizar(eq(5L), eq("Nuevo Nombre"), eq("x@museo.com")))
                .thenReturn(admin(5L, "ADMIN", "ACTIVO"));

        mockMvc.perform(put("/api/v1/admin/usuarios/5").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Nuevo Nombre\",\"correo\":\"x@museo.com\",\"rol\":\"ADMIN\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("actualizar ignora la contraseña y el rol (rol ADMIN) del request")
    void actualizar_ignoraRolYContrasena() throws Exception {
        when(usuarioAdminService.actualizar(anyLong(), any(), any()))
                .thenReturn(admin(5L, "ADMIN", "ACTIVO"));

        mockMvc.perform(put("/api/v1/admin/usuarios/5").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Otro\",\"correo\":\"y@museo.com\",\"rol\":\"ADMIN\",\"contrasena\":\"NoDebeAplicarse1\"}"))
                .andExpect(status().isOk());

        verify(usuarioAdminService).actualizar(5L, "Otro", "y@museo.com");
        verify(usuarioAdminService).validarRolNoEscalable("ADMIN");
    }

    @Test
    @DisplayName("crear con rol=SUPERADMIN devuelve 400 y no crea nada")
    void crear_rolSuperAdmin_400() throws Exception {
        org.mockito.Mockito.doThrow(new ReglaNegocioException(
                        "No se puede crear ni asignar el rol SUPERADMIN: las cuentas del panel son siempre ADMIN"))
                .when(usuarioAdminService).validarRolNoEscalable("SUPERADMIN");

        mockMvc.perform(post("/api/v1/admin/usuarios").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Gabs\",\"correo\":\"nuevo@museo.com\",\"rol\":\"SUPERADMIN\",\"contrasena\":\"Secreta123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(
                        org.hamcrest.Matchers.containsString("siempre ADMIN")));

        verify(usuarioAdminService, never()).crear(any(), any(), any());
    }

    @Test
    @DisplayName("actualizar con rol=SUPERADMIN devuelve 400")
    void actualizar_rolSuperAdmin_400() throws Exception {
        org.mockito.Mockito.doThrow(new ReglaNegocioException(
                        "No se puede crear ni asignar el rol SUPERADMIN: las cuentas del panel son siempre ADMIN"))
                .when(usuarioAdminService).validarRolNoEscalable("SUPERADMIN");

        mockMvc.perform(put("/api/v1/admin/usuarios/5").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Otro\",\"correo\":\"y@museo.com\",\"rol\":\"SUPERADMIN\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("editar la cuenta SuperAdmin devuelve 403")
    void actualizar_superAdminProtegido_403() throws Exception {
        when(usuarioAdminService.actualizar(anyLong(), any(), any()))
                .thenThrow(new com.museosmart.exception.OperacionProhibidaException(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"));

        mockMvc.perform(put("/api/v1/admin/usuarios/1").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Otro\",\"correo\":\"y@museo.com\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"));
    }

    @Test
    @DisplayName("desactivar la cuenta SuperAdmin devuelve 403")
    void cambiarEstado_superAdminProtegido_403() throws Exception {
        when(usuarioAdminService.cambiarEstado(anyLong(), any()))
                .thenThrow(new com.museosmart.exception.OperacionProhibidaException(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"));

        mockMvc.perform(patch("/api/v1/admin/usuarios/1/estado").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\":\"INACTIVO\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"));
    }

    @Test
    @DisplayName("eliminar la cuenta SuperAdmin devuelve 403")
    void eliminar_superAdminProtegido_403() throws Exception {
        org.mockito.Mockito.doThrow(new com.museosmart.exception.OperacionProhibidaException(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"))
                .when(usuarioAdminService).eliminar(1L);

        mockMvc.perform(delete("/api/v1/admin/usuarios/1").with(superadmin()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value(
                        "La cuenta de SuperAdmin no se puede modificar desde el panel"));
    }
    @Test
    @DisplayName("actualizar un administrador inexistente devuelve 404")
    void actualizar_404() throws Exception {
        when(usuarioAdminService.actualizar(anyLong(), any(), any()))
                .thenThrow(new RecursoNoEncontradoException("No existe el administrador con id 77"));

        mockMvc.perform(put("/api/v1/admin/usuarios/77").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"X\",\"correo\":\"x@museo.com\",\"rol\":\"ADMIN\"}"))
                .andExpect(status().isNotFound());
    }

    // ---------- Cambiar estado ----------

    @Test
    @DisplayName("cambiar estado válido devuelve 200 con el nuevo estado")
    void cambiarEstado_ok() throws Exception {
        when(usuarioAdminService.cambiarEstado(6L, "BLOQUEADO")).thenReturn(admin(6L, "ADMIN", "BLOQUEADO"));

        mockMvc.perform(patch("/api/v1/admin/usuarios/6/estado").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\":\"BLOQUEADO\",\"motivo\":\"Prueba\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("BLOQUEADO"));
    }

    @Test
    @DisplayName("cambiar estado con valor inválido devuelve 400")
    void cambiarEstado_invalido_400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/usuarios/6/estado").with(superadmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\":\"SUSPENDIDO\"}"))
                .andExpect(status().isBadRequest());

        verify(usuarioAdminService, never()).cambiarEstado(anyLong(), any());
    }

    // ---------- Eliminar ----------

    @Test
    @DisplayName("eliminar un administrador devuelve 204")
    void eliminar_ok() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/usuarios/8").with(superadmin()))
                .andExpect(status().isNoContent());

        verify(usuarioAdminService).eliminar(8L);
    }

    @Test
    @DisplayName("eliminar protegido por regla de negocio devuelve 400")
    void eliminar_ultimoSuperAdmin_400() throws Exception {
        org.mockito.Mockito.doThrow(new ReglaNegocioException(
                        "No se puede desactivar, bloquear ni eliminar al último SuperAdmin activo"))
                .when(usuarioAdminService).eliminar(1L);

        mockMvc.perform(delete("/api/v1/admin/usuarios/1").with(superadmin()))
                .andExpect(status().isBadRequest());
    }

    // ---------- No exposición de datos sensibles ----------

    @Test
    @DisplayName("las respuestas no exponen hashContrasena ni contrasena")
    void respuestas_sinDatosSensibles() throws Exception {
        when(usuarioAdminService.obtenerPorId(3L)).thenReturn(admin(3L, "ADMIN", "ACTIVO"));

        mockMvc.perform(get("/api/v1/admin/usuarios/3").with(superadmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hashContrasena").doesNotExist())
                .andExpect(jsonPath("$.hash_contrasena").doesNotExist())
                .andExpect(jsonPath("$.contrasena").doesNotExist());
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
