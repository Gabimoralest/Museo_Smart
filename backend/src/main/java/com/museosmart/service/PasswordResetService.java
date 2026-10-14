package com.museosmart.service;

import com.museosmart.dto.RestablecerContrasenaRequest;
import com.museosmart.dto.VerificarCodigoRequest;
import com.museosmart.dto.VerificarCodigoResponse;
import com.museosmart.entity.ContrasenaReset;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.mail.MailErrorDiagnostics;
import com.museosmart.mail.MailSendException;
import com.museosmart.mail.MailService;
import com.museosmart.repository.ContrasenaResetRepository;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.security.ResetTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int LONGITUD_CODIGO = 6;
    private static final long EXPIRACION_CODIGO_MINUTOS = 15;
    private static final short MAX_INTENTOS = 5;
    private static final String ESTADO_ACTIVO = "ACTIVO";

    private final UsuarioAdminRepository usuarioAdminRepository;
    private final ContrasenaResetRepository contrasenaResetRepository;
    private final PasswordEncoder passwordEncoder;
    private final ResetTokenService resetTokenService;
    private final MailService mailService;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(UsuarioAdminRepository usuarioAdminRepository,
                                ContrasenaResetRepository contrasenaResetRepository,
                                PasswordEncoder passwordEncoder,
                                ResetTokenService resetTokenService,
                                MailService mailService) {
        this.usuarioAdminRepository = usuarioAdminRepository;
        this.contrasenaResetRepository = contrasenaResetRepository;
        this.passwordEncoder = passwordEncoder;
        this.resetTokenService = resetTokenService;
        this.mailService = mailService;
    }

    /**
     * Solicita un codigo de recuperacion. La respuesta del controlador es uniforme
     * independientemente de si el correo existe. Solo se genera y envia codigo si
     * la cuenta existe y esta ACTIVA.
     */
    @Transactional
    public void solicitar(String correo) {
        Optional<UsuarioAdmin> posible = usuarioAdminRepository.findByCorreoIgnoreCase(correo);
        if (posible.isEmpty()) {
            return;
        }
        UsuarioAdmin usuario = posible.get();
        if (!ESTADO_ACTIVO.equals(usuario.getEstado())) {
            return;
        }

        OffsetDateTime ahora = OffsetDateTime.now();
        // Invalida los codigos vigentes anteriores; respeta el indice unico parcial.
        contrasenaResetRepository.invalidarVigentes(usuario.getId(), ahora);

        String codigo = generarCodigo();
        ContrasenaReset reset = new ContrasenaReset();
        reset.setUsuarioAdmin(usuario);
        reset.setCodigoHash(passwordEncoder.encode(codigo));
        reset.setExpiraEn(ahora.plus(EXPIRACION_CODIGO_MINUTOS, ChronoUnit.MINUTES));
        reset.setIntentos((short) 0);
        contrasenaResetRepository.save(reset);

        try {
            mailService.enviarCodigoRecuperacion(usuario.getCorreo(), codigo);
        } catch (MailSendException ex) {
            // El proveedor rechazo el correo: se revierte la transaccion para no dejar
            // un codigo vigente inutilizable. No se informa al cliente (respuesta uniforme).
            // Se registra el diagnostico (tipo y cadena de causas) sin datos sensibles.
            log.warn("Fallo al enviar el correo de recuperación; se revierte la solicitud. Diagnóstico={}",
                    MailErrorDiagnostics.describir(ex));
            marcarRollback();
        }
    }

    /**
     * Marca la transaccion actual para rollback sin lanzar una excepcion hacia el
     * controlador (asi la respuesta HTTP sigue siendo uniforme). Si no hay
     * transaccion activa (pruebas unitarias con mocks), no se hace nada.
     */
    private void marcarRollback() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        }
    }

    /**
     * Verifica el codigo vigente y, si es correcto, emite un token temporal de
     * restablecimiento. No consume el codigo aqui (se consume al restablecer).
     * Un codigo incorrecto incrementa el contador de intentos.
     */
    @Transactional
    public VerificarCodigoResponse verificar(VerificarCodigoRequest request) {
        UsuarioAdmin usuario = usuarioAdminRepository.findByCorreoIgnoreCase(request.correo())
                .orElseThrow(this::codigoInvalido);
        if (!ESTADO_ACTIVO.equals(usuario.getEstado())) {
            throw codigoInvalido();
        }

        ContrasenaReset reset = codigoVigente(usuario.getId());

        if (reset.getExpiraEn().isBefore(OffsetDateTime.now())) {
            reset.setInvalidadoEn(OffsetDateTime.now());
            contrasenaResetRepository.save(reset);
            throw codigoInvalido();
        }
        if (reset.getIntentos() >= MAX_INTENTOS) {
            reset.setInvalidadoEn(OffsetDateTime.now());
            contrasenaResetRepository.save(reset);
            throw codigoInvalido();
        }
        if (!passwordEncoder.matches(request.codigo(), reset.getCodigoHash())) {
            short intentos = (short) (reset.getIntentos() + 1);
            reset.setIntentos(intentos);
            if (intentos >= MAX_INTENTOS) {
                reset.setInvalidadoEn(OffsetDateTime.now());
            }
            contrasenaResetRepository.save(reset);
            throw codigoInvalido();
        }

        String token = resetTokenService.generar(usuario.getCorreo());
        return new VerificarCodigoResponse(token, resetTokenService.getExpiracionMinutos());
    }

    /**
     * Restablece la contrasena usando el token temporal (prueba de autorizacion
     * distinta del correo). Consume el codigo vigente, actualiza el hash BCrypt y
     * desactiva el primer inicio de sesion. Un token reutilizado no encuentra
     * codigo vigente y falla.
     */
    @Transactional
    public void restablecer(RestablecerContrasenaRequest request) {
        String correo;
        try {
            correo = resetTokenService.validarYExtraerCorreo(request.tokenRestablecimiento());
        } catch (RuntimeException ex) {
            throw new ReglaNegocioException("El token de restablecimiento no es válido o ha expirado");
        }

        UsuarioAdmin usuario = usuarioAdminRepository.findByCorreoIgnoreCase(correo)
                .orElseThrow(() -> new ReglaNegocioException("No se puede restablecer la contraseña"));
        if (!ESTADO_ACTIVO.equals(usuario.getEstado())) {
            throw new ReglaNegocioException("No se puede restablecer la contraseña");
        }

        ContrasenaReset reset = codigoVigente(usuario.getId());

        reset.setUsadoEn(OffsetDateTime.now());
        contrasenaResetRepository.save(reset);

        usuario.setHashContrasena(passwordEncoder.encode(request.nuevaContrasena()));
        usuario.setPrimerInicioSesion(false);
        // Invalida todos los JWT emitidos antes del restablecimiento.
        usuario.incrementarTokenVersion();
        usuarioAdminRepository.save(usuario);
    }

    private ContrasenaReset codigoVigente(Long usuarioId) {
        return contrasenaResetRepository
                .findFirstByUsuarioAdminIdAndUsadoEnIsNullAndInvalidadoEnIsNullOrderByCreadoEnDesc(usuarioId)
                .orElseThrow(this::codigoInvalido);
    }

    private ReglaNegocioException codigoInvalido() {
        return new ReglaNegocioException("El código de recuperación no es válido");
    }

    private String generarCodigo() {
        int valor = secureRandom.nextInt(1_000_000);
        return String.format("%0" + LONGITUD_CODIGO + "d", valor);
    }
}
