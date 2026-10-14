package com.museosmart.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Implementacion simulada (por defecto): no envia correos reales ni configura SMTP.
 * Registra unicamente que se "enviaria" un codigo, sin exponer su valor.
 * Se usa cuando app.mail.habilitado no es true (desarrollo/tests).
 */
@Service
@ConditionalOnProperty(name = "app.mail.habilitado", havingValue = "false", matchIfMissing = true)
public class LoggingMailService implements MailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailService.class);

    @Override
    public void enviarCodigoRecuperacion(String destinatario, String codigo) {
        // No se registra el codigo ni datos sensibles.
        log.info("Correo de recuperación generado para un administrador (envío real pendiente de configurar SMTP).");
    }
}
