package com.museosmart.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Diagnostico de configuracion SMTP al arrancar. Solo se ejecuta cuando
 * app.mail.habilitado=true (evita ruido en desarrollo/tests).
 *
 * Nunca registra valores sensibles: solo indica si una propiedad esta definida
 * y, en el caso del usuario, su longitud. Ayuda a detectar variables de entorno
 * no visibles para el proceso (p.ej. definidas despues de abrir la terminal).
 */
@Component
@ConditionalOnProperty(name = "app.mail.habilitado", havingValue = "true")
public class MailConfigDiagnostics implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MailConfigDiagnostics.class);

    private final String host;
    private final int port;
    private final String username;
    private final String password;
    private final String from;

    public MailConfigDiagnostics(
            @Value("${spring.mail.host:}") String host,
            @Value("${spring.mail.port:0}") int port,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password,
            @Value("${app.mail.from:}") String from) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.from = from;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> faltantes = new ArrayList<>();
        if (esVacio(host)) {
            faltantes.add("MAIL_HOST / spring.mail.host");
        }
        if (port <= 0) {
            faltantes.add("MAIL_PORT / spring.mail.port");
        }
        if (esVacio(username)) {
            faltantes.add("MAIL_USERNAME / spring.mail.username");
        }
        if (esVacio(password)) {
            faltantes.add("MAIL_PASSWORD / spring.mail.password");
        }
        if (esVacio(from)) {
            faltantes.add("APP_MAIL_FROM / app.mail.from");
        }

        if (!faltantes.isEmpty()) {
            log.error("SMTP habilitado pero faltan propiedades requeridas: {}. "
                    + "Defina las variables de entorno y reinicie el proceso (las variables de Windows "
                    + "solo se cargan en procesos nuevos).", faltantes);
            return;
        }

        log.info("SMTP habilitado. host={}, puerto={}, usuario definido (longitud={}), "
                + "contraseña definida (longitud={}), remitente={}.",
                host, port, username.length(), password.length(), from);

        if (!username.equalsIgnoreCase(from)) {
            log.warn("MAIL_USERNAME y APP_MAIL_FROM no coinciden. Gmail exige que el remitente "
                    + "coincida con la cuenta autenticada; de lo contrario el envío puede fallar.");
        }
        if (password.length() == 19 || password.contains(" ")) {
            log.warn("La contraseña de aplicación de Gmail contiene espacios (formato 'xxxx xxxx xxxx xxxx'). "
                    + "Se recomienda guardarla sin espacios en MAIL_PASSWORD.");
        }
    }

    private boolean esVacio(String valor) {
        return valor == null || valor.isBlank();
    }
}
