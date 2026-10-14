package com.museosmart.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;

class MailSenderConfigTest {

    @Test
    @DisplayName("normalizarPassword elimina solo espacios ASCII")
    void normalizaEspacios() {
        assertThat(MailSenderConfig.normalizarPassword("abcd efgh ijkl mnop"))
                .isEqualTo("abcdefghijklmnop");
    }

    @Test
    @DisplayName("normalizarPassword no altera una contraseña sin espacios")
    void sinEspaciosNoCambia() {
        assertThat(MailSenderConfig.normalizarPassword("abcdefghijklmnop"))
                .isEqualTo("abcdefghijklmnop");
    }

    @Test
    @DisplayName("normalizarPassword tolera null")
    void nullSeguro() {
        assertThat(MailSenderConfig.normalizarPassword(null)).isNull();
    }

    @Test
    @DisplayName("el JavaMailSender usa host, puerto y contraseña normalizada")
    void construyeSender() {
        MailSenderConfig config = new MailSenderConfig(
                "smtp.gmail.com", 587, "smartmuseo@gmail.com", "abcd efgh ijkl mnop");

        JavaMailSender sender = config.javaMailSender();

        assertThat(sender).isInstanceOf(org.springframework.mail.javamail.JavaMailSenderImpl.class);
        org.springframework.mail.javamail.JavaMailSenderImpl impl =
                (org.springframework.mail.javamail.JavaMailSenderImpl) sender;
        assertThat(impl.getHost()).isEqualTo("smtp.gmail.com");
        assertThat(impl.getPort()).isEqualTo(587);
        assertThat(impl.getUsername()).isEqualTo("smartmuseo@gmail.com");
        assertThat(impl.getPassword()).isEqualTo("abcdefghijklmnop");
        assertThat(impl.getJavaMailProperties().getProperty("mail.smtp.starttls.enable")).isEqualTo("true");
        assertThat(impl.getJavaMailProperties().getProperty("mail.smtp.auth")).isEqualTo("true");
    }
}
