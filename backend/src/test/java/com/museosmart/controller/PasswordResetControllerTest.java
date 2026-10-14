package com.museosmart.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.config.SecurityConfig;
import com.museosmart.dto.VerificarCodigoResponse;
import com.museosmart.exception.GlobalExceptionHandler;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.security.JwtAuthenticationFilter;
import com.museosmart.security.JwtService;
import com.museosmart.security.PrimerInicioSesionFilter;
import com.museosmart.security.RestSecurityHandlers;
import com.museosmart.service.PasswordResetService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = PasswordResetController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class, PrimerInicioSesionFilter.class, RestSecurityHandlers.class})
class PasswordResetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PasswordResetService passwordResetService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.museosmart.repository.UsuarioAdminRepository usuarioAdminRepository;

    // ---------- Solicitar (público, uniforme) ----------

    @Test
    @DisplayName("solicitar con correo existente devuelve 200 con mensaje uniforme")
    void solicitar_existente() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/solicitar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"admin@museo.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mensaje").exists());
    }

    @Test
    @DisplayName("solicitar con correo inexistente devuelve el mismo 200 y mensaje uniforme")
    void solicitar_inexistente_uniforme() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/solicitar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"nadie@museo.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mensaje").exists());
    }

    @Test
    @DisplayName("solicitar con correo inválido devuelve 400")
    void solicitar_correoInvalido_400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/solicitar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"no-es-correo\"}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- Verificar ----------

    @Test
    @DisplayName("verificar con código válido devuelve token y no expone el código")
    void verificar_ok() throws Exception {
        when(passwordResetService.verificar(any()))
                .thenReturn(new VerificarCodigoResponse("token-reset", 15));

        mockMvc.perform(post("/api/v1/auth/recuperacion/verificar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"admin@museo.com\",\"codigo\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenRestablecimiento").value("token-reset"))
                .andExpect(jsonPath("$.codigo").doesNotExist());
    }

    @Test
    @DisplayName("verificar con código con formato inválido devuelve 400")
    void verificar_formatoInvalido_400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/verificar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"admin@museo.com\",\"codigo\":\"12\"}"))
                .andExpect(status().isBadRequest());

        verify(passwordResetService, never()).verificar(any());
    }

    @Test
    @DisplayName("verificar con código no válido devuelve 400")
    void verificar_codigoInvalido_400() throws Exception {
        when(passwordResetService.verificar(any()))
                .thenThrow(new ReglaNegocioException("El código de recuperación no es válido"));

        mockMvc.perform(post("/api/v1/auth/recuperacion/verificar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"admin@museo.com\",\"codigo\":\"000000\"}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- Restablecer ----------

    @Test
    @DisplayName("restablecer con token válido devuelve 204")
    void restablecer_ok() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/restablecer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tokenRestablecimiento\":\"token-reset\",\"nuevaContrasena\":\"NuevaClave456\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("restablecer con contraseña corta devuelve 400")
    void restablecer_contrasenaCorta_400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/recuperacion/restablecer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tokenRestablecimiento\":\"token-reset\",\"nuevaContrasena\":\"corta\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("restablecer con token inválido devuelve 400")
    void restablecer_tokenInvalido_400() throws Exception {
        org.mockito.Mockito.doThrow(new ReglaNegocioException("El token de restablecimiento no es válido o ha expirado"))
                .when(passwordResetService).restablecer(any());

        mockMvc.perform(post("/api/v1/auth/recuperacion/restablecer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tokenRestablecimiento\":\"malo\",\"nuevaContrasena\":\"NuevaClave456\"}"))
                .andExpect(status().isBadRequest());
    }
}
