package com.museosmart.service;

import com.museosmart.dto.RestablecerContrasenaRequest;
import com.museosmart.dto.VerificarCodigoRequest;
import com.museosmart.dto.VerificarCodigoResponse;
import com.museosmart.entity.ContrasenaReset;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.mail.MailService;
import com.museosmart.repository.ContrasenaResetRepository;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.security.ResetTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UsuarioAdminRepository usuarioAdminRepository;

    @Mock
    private ContrasenaResetRepository contrasenaResetRepository;

    @Mock
    private MailService mailService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final ResetTokenService resetTokenService =
            new ResetTokenService("clave-de-prueba-suficientemente-larga-1234567890", 15);

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(usuarioAdminRepository, contrasenaResetRepository,
                passwordEncoder, resetTokenService, mailService);
        org.mockito.Mockito.lenient().when(contrasenaResetRepository.save(any(ContrasenaReset.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    private UsuarioAdmin usuario(String estado) {
        UsuarioAdmin u = new UsuarioAdmin();
        setField(u, "id", 1L);
        u.setNombre("Gabs");
        u.setCorreo("admin@museo.com");
        u.setRol("ADMIN");
        u.setEstado(estado);
        u.setHashContrasena(passwordEncoder.encode("Secreta123"));
        return u;
    }

    private ContrasenaReset resetVigente(String codigoClaro, OffsetDateTime expira, short intentos) {
        ContrasenaReset r = new ContrasenaReset();
        setField(r, "id", 10L);
        r.setUsuarioAdmin(usuario("ACTIVO"));
        r.setCodigoHash(passwordEncoder.encode(codigoClaro));
        r.setExpiraEn(expira);
        r.setIntentos(intentos);
        return r;
    }

    // ---------- solicitar ----------

    @Test
    @DisplayName("solicitar con correo existente y activo genera código y envía correo")
    void solicitar_correoExistente() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));

        service.solicitar("admin@museo.com");

        verify(contrasenaResetRepository).invalidarVigentes(eq(1L), any(OffsetDateTime.class));
        ArgumentCaptor<ContrasenaReset> captor = ArgumentCaptor.forClass(ContrasenaReset.class);
        verify(contrasenaResetRepository).save(captor.capture());
        ContrasenaReset guardado = captor.getValue();
        assertThat(guardado.getCodigoHash()).isNotBlank();
        assertThat(guardado.getExpiraEn()).isAfter(OffsetDateTime.now());
        assertThat(guardado.getIntentos()).isZero();
        verify(mailService).enviarCodigoRecuperacion(eq("admin@museo.com"), anyString());
    }

    @Test
    @DisplayName("solicitar con correo inexistente no genera ni envía nada")
    void solicitar_correoInexistente() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("nadie@museo.com")).thenReturn(Optional.empty());

        service.solicitar("nadie@museo.com");

        verify(contrasenaResetRepository, never()).save(any());
        verify(mailService, never()).enviarCodigoRecuperacion(anyString(), anyString());
    }

    @Test
    @DisplayName("solicitar con cuenta inactiva no genera ni envía nada")
    void solicitar_cuentaInactiva() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("INACTIVO")));

        service.solicitar("admin@museo.com");

        verify(contrasenaResetRepository, never()).save(any());
        verify(mailService, never()).enviarCodigoRecuperacion(anyString(), anyString());
    }

    @Test
    @DisplayName("si falla el envío, no se propaga excepción (respuesta uniforme)")
    void solicitar_falloEnvio_noPropaga() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        org.mockito.Mockito.doThrow(new com.museosmart.mail.MailSendException("fallo", new RuntimeException()))
                .when(mailService).enviarCodigoRecuperacion(anyString(), anyString());

        // No debe lanzar hacia el controlador; sin transacción activa, no hay rollback real aquí.
        service.solicitar("admin@museo.com");

        verify(contrasenaResetRepository).save(any(ContrasenaReset.class));
    }

    // ---------- verificar ----------

    @Test
    @DisplayName("verificar con código correcto devuelve token")
    void verificar_codigoCorrecto() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.of(resetVigente("123456", OffsetDateTime.now().plusMinutes(10), (short) 0)));

        VerificarCodigoResponse respuesta = service.verificar(new VerificarCodigoRequest("admin@museo.com", "123456"));

        assertThat(respuesta.tokenRestablecimiento()).isNotBlank();
        assertThat(respuesta.expiraEnMinutos()).isEqualTo(15);
    }

    @Test
    @DisplayName("verificar con código incorrecto incrementa intentos y falla")
    void verificar_codigoIncorrecto() {
        ContrasenaReset reset = resetVigente("123456", OffsetDateTime.now().plusMinutes(10), (short) 0);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.of(reset));

        assertThatThrownBy(() -> service.verificar(new VerificarCodigoRequest("admin@museo.com", "000000")))
                .isInstanceOf(ReglaNegocioException.class);
        assertThat(reset.getIntentos()).isEqualTo((short) 1);
    }

    @Test
    @DisplayName("verificar con código expirado falla y lo invalida")
    void verificar_codigoExpirado() {
        ContrasenaReset reset = resetVigente("123456", OffsetDateTime.now().minusMinutes(1), (short) 0);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.of(reset));

        assertThatThrownBy(() -> service.verificar(new VerificarCodigoRequest("admin@museo.com", "123456")))
                .isInstanceOf(ReglaNegocioException.class);
        assertThat(reset.getInvalidadoEn()).isNotNull();
    }

    @Test
    @DisplayName("verificar sin código vigente falla")
    void verificar_sinCodigoVigente() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.verificar(new VerificarCodigoRequest("admin@museo.com", "123456")))
                .isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("verificar alcanzando el límite de intentos invalida el código")
    void verificar_limiteIntentos() {
        ContrasenaReset reset = resetVigente("123456", OffsetDateTime.now().plusMinutes(10), (short) 5);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("ACTIVO")));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.of(reset));

        assertThatThrownBy(() -> service.verificar(new VerificarCodigoRequest("admin@museo.com", "000000")))
                .isInstanceOf(ReglaNegocioException.class);
        assertThat(reset.getInvalidadoEn()).isNotNull();
    }

    // ---------- restablecer ----------

    @Test
    @DisplayName("restablecer con token válido cambia la contraseña y desactiva primer inicio")
    void restablecer_ok() {
        UsuarioAdmin usuario = usuario("ACTIVO");
        ContrasenaReset reset = resetVigente("123456", OffsetDateTime.now().plusMinutes(10), (short) 0);
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.of(reset));

        String token = resetTokenService.generar("admin@museo.com");
        service.restablecer(new RestablecerContrasenaRequest(token, "NuevaClave456"));

        assertThat(passwordEncoder.matches("NuevaClave456", usuario.getHashContrasena())).isTrue();
        assertThat(usuario.isPrimerInicioSesion()).isFalse();
        assertThat(usuario.getTokenVersion()).isEqualTo(1);
        assertThat(reset.getUsadoEn()).isNotNull();
        verify(usuarioAdminRepository).save(usuario);
    }

    @Test
    @DisplayName("restablecer con token inválido falla")
    void restablecer_tokenInvalido() {
        assertThatThrownBy(() -> service.restablecer(
                new RestablecerContrasenaRequest("token.falso", "NuevaClave456")))
                .isInstanceOf(ReglaNegocioException.class);

        verify(usuarioAdminRepository, never()).save(any());
    }

    @Test
    @DisplayName("restablecer no permite reutilizar el código (ya consumido)")
    void restablecer_codigoYaUsado() {
        UsuarioAdmin usuario = usuario("ACTIVO");
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com")).thenReturn(Optional.of(usuario));
        when(contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(1L))
                .thenReturn(Optional.empty());

        String token = resetTokenService.generar("admin@museo.com");

        assertThatThrownBy(() -> service.restablecer(new RestablecerContrasenaRequest(token, "NuevaClave456")))
                .isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("restablecer en cuenta inactiva falla")
    void restablecer_cuentaInactiva() {
        when(usuarioAdminRepository.findByCorreoIgnoreCase("admin@museo.com"))
                .thenReturn(Optional.of(usuario("INACTIVO")));
        String token = resetTokenService.generar("admin@museo.com");

        assertThatThrownBy(() -> service.restablecer(new RestablecerContrasenaRequest(token, "NuevaClave456")))
                .isInstanceOf(ReglaNegocioException.class);
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
