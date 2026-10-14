package com.museosmart.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.autoconfigure.mail.MailSenderValidatorAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class MailServiceSelectionTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    MailSenderAutoConfiguration.class,
                    MailSenderValidatorAutoConfiguration.class))
            .withUserConfiguration(LoggingMailService.class, SmtpMailService.class);

    @Test
    @DisplayName("con SMTP deshabilitado se usa LoggingMailService")
    void deshabilitado_usaLogging() {
        runner.withPropertyValues("app.mail.habilitado=false")
                .run(context -> {
                    assertThat(context).hasSingleBean(MailService.class);
                    assertThat(context.getBean(MailService.class)).isInstanceOf(LoggingMailService.class);
                });
    }

    @Test
    @DisplayName("sin la propiedad, el bean por defecto es LoggingMailService")
    void sinPropiedad_usaLoggingPorDefecto() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(MailService.class);
            assertThat(context.getBean(MailService.class)).isInstanceOf(LoggingMailService.class);
        });
    }

    @Test
    @DisplayName("con SMTP habilitado se usa SmtpMailService")
    void habilitado_usaSmtp() {
        runner.withPropertyValues(
                        "app.mail.habilitado=true",
                        "spring.mail.host=smtp.gmail.com",
                        "spring.mail.port=587",
                        "spring.mail.username=smartmuseo@gmail.com",
                        "spring.mail.password=clave-de-prueba",
                        "app.mail.from=smartmuseo@gmail.com")
                .run(context -> {
                    assertThat(context).hasSingleBean(MailService.class);
                    assertThat(context.getBean(MailService.class)).isInstanceOf(SmtpMailService.class);
                });
    }
}
