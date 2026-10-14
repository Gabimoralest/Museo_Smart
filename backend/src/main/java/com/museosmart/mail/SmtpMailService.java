package com.museosmart.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Implementacion real de envio por SMTP (pensada para Gmail con contrasena de
 * aplicacion). Solo se activa cuando app.mail.habilitado=true, de modo que en
 * desarrollo/tests el bean por defecto sea LoggingMailService.
 *
 * Nunca registra el codigo ni credenciales. Si el proveedor rechaza el correo,
 * MailException se propaga para que la transaccion de recuperacion se revierta
 * (no se deja un codigo vigente inutilizable).
 */
@Service
@ConditionalOnProperty(name = "app.mail.habilitado", havingValue = "true")
public class SmtpMailService implements MailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailService.class);

    private final JavaMailSender mailSender;
    private final String remitente;

    public SmtpMailService(JavaMailSender mailSender,
                           @Value("${app.mail.from:smartmuseo@gmail.com}") String remitente) {
        this.mailSender = mailSender;
        this.remitente = remitente;
    }

    @Override
    public void enviarCodigoRecuperacion(String destinatario, String codigo) {
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject("Museo Smart - Código de recuperación de contraseña");
        mensaje.setText(construirCuerpo(codigo));
        try {
            mailSender.send(mensaje);
            log.info("Código de recuperación enviado por correo a un administrador.");
        } catch (MailException ex) {
            // No se registra el codigo ni credenciales. Se incluye el tipo y el mensaje
            // de la cadena de causas (p.ej. AuthenticationFailedException, ConnectException)
            // para diagnosticar el fallo real de Gmail SMTP.
            log.warn("No se pudo enviar el correo de recuperación (tipo={}, causaRaíz={}). Detalle={}",
                    ex.getClass().getSimpleName(),
                    MailErrorDiagnostics.causaRaiz(ex) != null
                            ? MailErrorDiagnostics.causaRaiz(ex).getClass().getSimpleName() : "n/a",
                    MailErrorDiagnostics.describir(ex));
            throw new MailSendException("No se pudo enviar el correo de recuperación", ex);
        }
    }

    private String construirCuerpo(String codigo) {
        return "Hola,\n\n"
                + "Recibimos una solicitud para restablecer tu contraseña en Museo Smart.\n"
                + "Tu código de verificación es: " + codigo + "\n\n"
                + "El código es válido durante 15 minutos y solo puede usarse una vez.\n"
                + "Si no solicitaste este cambio, ignora este mensaje.\n\n"
                + "Museo Smart";
    }
}
