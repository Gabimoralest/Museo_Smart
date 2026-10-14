package com.museosmart.service;

import com.museosmart.dto.CambioContrasenaRequest;
import com.museosmart.dto.LoginRequest;
import com.museosmart.dto.LoginResponse;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.CredencialesInvalidasException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private final UsuarioAdminRepository usuarioAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioAdminRepository usuarioAdminRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.usuarioAdminRepository = usuarioAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Autentica y emite un JWT. Mensaje de error unico para no revelar si el
     * correo existe. Las cuentas no ACTIVAS se rechazan con el mismo mensaje.
     */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        UsuarioAdmin usuario = usuarioAdminRepository.findByCorreoIgnoreCase(request.correo())
                .orElseThrow(() -> new CredencialesInvalidasException("Credenciales inválidas"));

        if (!"ACTIVO".equals(usuario.getEstado())) {
            throw new CredencialesInvalidasException("Credenciales inválidas");
        }

        if (!passwordEncoder.matches(request.contrasena(), usuario.getHashContrasena())) {
            throw new CredencialesInvalidasException("Credenciales inválidas");
        }

        // Solo tras validar estado y contrasena se registra el acceso.
        usuario.setUltimoAccesoEn(OffsetDateTime.now());
        usuarioAdminRepository.save(usuario);

        String token = jwtService.generarToken(usuario);
        return new LoginResponse(
                token,
                "Bearer",
                usuario.getCorreo(),
                usuario.getRol(),
                usuario.isPrimerInicioSesion(),
                jwtService.getExpiracionMinutos());
    }

    /**
     * Cambio de contrasena del propio usuario autenticado. Verifica la contrasena
     * actual, valida la nueva y actualiza el hash y primer_inicio_sesion de forma
     * transaccional. Nunca permite cambiar la contrasena de otra cuenta: el correo
     * se toma del principal autenticado, no de la peticion.
     */
    @Transactional
    public void cambiarContrasena(String correoAutenticado, CambioContrasenaRequest request) {
        UsuarioAdmin usuario = usuarioAdminRepository.findByCorreoIgnoreCase(correoAutenticado)
                .orElseThrow(() -> new CredencialesInvalidasException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.contrasenaActual(), usuario.getHashContrasena())) {
            throw new ReglaNegocioException("La contraseña actual no es correcta");
        }
        if (passwordEncoder.matches(request.nuevaContrasena(), usuario.getHashContrasena())) {
            throw new ReglaNegocioException("La nueva contraseña debe ser diferente a la actual");
        }

        usuario.setHashContrasena(passwordEncoder.encode(request.nuevaContrasena()));
        usuario.setPrimerInicioSesion(false);
        // Invalida todos los JWT emitidos antes del cambio de contrasena.
        usuario.incrementarTokenVersion();
        usuarioAdminRepository.save(usuario);
    }
}
