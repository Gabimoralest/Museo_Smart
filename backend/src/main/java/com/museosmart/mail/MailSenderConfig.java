package com.museosmart.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

/**
 * Construye el JavaMailSender real cuando el envio por SMTP esta habilitado
 * (app.mail.habilitado=true). Spring Boot crea su propio JavaMailSender solo si
 * no existe uno (MailSenderAutoConfiguration es @ConditionalOnMissingBean), por
 * lo que este bean sustituye al automatico sin conflicto.
 *
 * Motivo: la contrasena de aplicacion de Gmail se muestra en la web como
 * "xxxx xxxx xxxx xxxx" (16 caracteres + espacios). Muchos usuarios la pegan
 * con espacios; Google exige los 16 caracteres sin espacios. Aqui se eliminan
 * UNICAMENTE los espacios ASCII (U+0020) al preparar el valor para SMTP; no se
 * altera ningun otro caracter y nunca se registra el valor.
 *
 * El resto de parametros (host, puerto, usuario, STARTTLS) se toman de la
 * configuracion efectiva, por lo que no se duplican.
 */
@Configuration
@ConditionalOnProperty(name = "app.mail.habilitado", havingValue = "true")
public class MailSenderConfig {

    private final String host;
    private final int port;
    private final String username;
    private final String password;

    public MailSenderConfig(
            @Value("${spring.mail.host:}") String host,
            @Value("${spring.mail.port:587}") int port,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
    }

    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setProtocol("smtp");
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(normalizarPassword(password));

        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.connectiontimeout", "15000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");
        return sender;
    }

    /**
     * Elimina solo espacios ASCII del valor. No toca el resto de caracteres.
     * Visible para pruebas.
     */
    static String normalizarPassword(String valor) {
        if (valor == null) {
            return null;
        }
        return valor.replace(" ", "");
    }
}
