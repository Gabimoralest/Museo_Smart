package com.museosmart.service;

import com.museosmart.dto.CambioContrasenaRequest;
import com.museosmart.dto.LoginRequest;
import com.museosmart.dto.LoginResponse;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.CredencialesInvalidasException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioAdminRepository usuarioAdminRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = new JwtService("clave-de-prueba-suficientemente-larga-1234567890", 60);

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(usuarioAdminRepository, passwordEncoder, jwtService);
    }

    @Test
    @DisplayName("login con credenciales válidas devuelve token y datos del usuario")
    void login_credencialesValidas() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        LoginResponse respuesta = authService.login(new LoginRequest("admin@museo.com", "Secreta123"));

        assertThat(respuesta.token()).isNotBlank();
        assertThat(respuesta.tipo()).isEqualTo("Bearer");
        assertThat(respuesta.rol()).isEqualTo("ADMIN");
        assertThat(respuesta.debeCambiarContrasena()).isFalse();
        assertThat(respuesta.expiraEnMinutos()).isEqualTo(60);
    }

    @Test
    @DisplayName("login con contraseña incorrecta lanza CredencialesInvalidasException")
    void login_contrasenaIncorrecta() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@museo.com", "Incorrecta")))
                .isInstanceOf(CredencialesInvalidasException.class)
                .hasMessageContaining("Credenciales inválidas");
    }

    @Test
    @DisplayName("login con usuario inexistente lanza el mismo mensaje genérico")
    void login_usuarioInexistente() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("nadie@museo.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nadie@museo.com", "Secreta123")))
                .isInstanceOf(CredencialesInvalidasException.class)
                .hasMessageContaining("Credenciales inválidas");
    }

    @Test
    @DisplayName("login de cuenta no ACTIVA es rechazado")
    void login_cuentaInactiva() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "INACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@museo.com", "Secreta123")))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    @Test
    @DisplayName("login de cuenta bloqueada es rechazado")
    void login_cuentaBloqueada() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "BLOQUEADO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@museo.com", "Secreta123")))
                .isInstanceOf(CredencialesInvalidasException.class);
    }

    @Test
    @DisplayName("login de primer inicio marca debeCambiarContrasena=true")
    void login_primerInicio() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", true);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        LoginResponse respuesta = authService.login(new LoginRequest("admin@museo.com", "Secreta123"));

        assertThat(respuesta.debeCambiarContrasena()).isTrue();
    }

    // ---------- ultimoAccesoEn ----------

    @Test
    @DisplayName("login correcto actualiza ultimoAccesoEn")
    void login_correcto_actualizaUltimoAcceso() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", false);
        assertThat(usuario.getUltimoAccesoEn()).isNull();
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.login(new LoginRequest("admin@museo.com", "Secreta123"));

        assertThat(usuario.getUltimoAccesoEn()).isNotNull();
        verify(usuarioAdminRepository).save(usuario);
    }

    @Test
    @DisplayName("login con correo inexistente no actualiza ultimoAccesoEn")
    void login_correoInexistente_noActualiza() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("nadie@museo.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nadie@museo.com", "Secreta123")))
                .isInstanceOf(CredencialesInvalidasException.class);
        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("login con contraseña incorrecta no actualiza ultimoAccesoEn")
    void login_contrasenaIncorrecta_noActualiza() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@museo.com", "Incorrecta")))
                .isInstanceOf(CredencialesInvalidasException.class);
        assertThat(usuario.getUltimoAccesoEn()).isNull();
        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("login de cuenta inactiva no actualiza ultimoAccesoEn")
    void login_cuentaInactiva_noActualiza() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "INACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@museo.com", "Secreta123")))
                .isInstanceOf(CredencialesInvalidasException.class);
        assertThat(usuario.getUltimoAccesoEn()).isNull();
        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("cambio de contraseña válido actualiza hash y desactiva primer_inicio_sesion")
    void cambiarContrasena_ok() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", true);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));
        when(usuarioAdminRepository.save(any(UsuarioAdmin.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.cambiarContrasena("admin@museo.com",
                new CambioContrasenaRequest("Secreta123", "NuevaClave456"));

        assertThat(usuario.isPrimerInicioSesion()).isFalse();
        assertThat(passwordEncoder.matches("NuevaClave456", usuario.getHashContrasena())).isTrue();
        assertThat(passwordEncoder.matches("Secreta123", usuario.getHashContrasena())).isFalse();
        assertThat(usuario.getTokenVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("cambio de contraseña con contraseña actual incorrecta es rechazado")
    void cambiarContrasena_actualIncorrecta() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", true);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.cambiarContrasena("admin@museo.com",
                new CambioContrasenaRequest("MalaActual", "NuevaClave456")))
                .isInstanceOf(ReglaNegocioException.class);

        verify(usuarioAdminRepository, never()).save(any(UsuarioAdmin.class));
    }

    @Test
    @DisplayName("no se permite repetir la contraseña actual como nueva")
    void cambiarContrasena_repetida() {
        UsuarioAdmin usuario = usuario("admin@museo.com", "ADMIN", "ACTIVO", "Secreta123", false);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> authService.cambiarContrasena("admin@museo.com",
                new CambioContrasenaRequest("Secreta123", "Secreta123")))
                .isInstanceOf(ReglaNegocioException.class);
    }

    private UsuarioAdmin usuario(String correo, String rol, String estado, String contrasena, boolean primerInicio) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", 1L);
        u.setNombre("Nombre");
        u.setCorreo(correo);
        u.setRol(rol);
        u.setEstado(estado);
        u.setPrimerInicioSesion(primerInicio);
        u.setHashContrasena(passwordEncoder.encode(contrasena));
        return u;
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
