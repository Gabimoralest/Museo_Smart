package com.museosmart.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SmtpMailServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final SmtpMailService smtpMailService = new SmtpMailService(mailSender, "smartmuseo@gmail.com");

    @Test
    @DisplayName("envía el correo con remitente configurable y destinatario correcto")
    void enviaConRemitenteYDestinatario() {
        smtpMailService.enviarCodigoRecuperacion("admin@museo.com", "123456");

        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("el mensaje contiene el remitente oficial y no expone nada raro")
    void mensajeConRemitenteOficial() {
        org.mockito.ArgumentCaptor<SimpleMailMessage> captor =
                org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);

        smtpMailService.enviarCodigoRecuperacion("admin@museo.com", "654321");

        verify(mailSender).send(captor.capture());
        SimpleMailMessage msg = captor.getValue();
        assertThat(msg.getFrom()).isEqualTo("smartmuseo@gmail.com");
        assertThat(msg.getTo()).containsExactly("admin@museo.com");
        assertThat(msg.getSubject()).contains("Museo Smart");
    }

    @Test
    @DisplayName("si el proveedor rechaza el correo, se lanza MailSendException de dominio")
    void falloDelProveedorSePropaga() {
        doThrow(new org.springframework.mail.MailSendException("rechazado"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        assertThatThrownBy(() -> smtpMailService.enviarCodigoRecuperacion("admin@museo.com", "123456"))
                .isInstanceOf(MailSendException.class);
    }

    @Test
    @DisplayName("MailSendException conserva la causa original y el diagnóstico la incluye")
    void falloConservaCausaOriginal() {
        var causaRaiz = new java.net.ConnectException("Connection refused");
        var causaSpring = new org.springframework.mail.MailSendException("fallo de envío", causaRaiz);
        doThrow(causaSpring).when(mailSender).send(any(SimpleMailMessage.class));

        Throwable lanzada = org.assertj.core.api.Assertions.catchThrowable(
                () -> smtpMailService.enviarCodigoRecuperacion("admin@museo.com", "123456"));

        assertThat(lanzada).isInstanceOf(MailSendException.class);
        assertThat(lanzada.getCause()).isSameAs(causaSpring);
        assertThat(MailErrorDiagnostics.causaRaiz(lanzada)).isSameAs(causaRaiz);
        assertThat(MailErrorDiagnostics.describir(lanzada)).contains("Connection refused");
    }

    @Test
    @DisplayName("el diagnóstico no contiene el código de recuperación")
    void diagnosticoNoExponeElCodigo() {
        doThrow(new org.springframework.mail.MailSendException("boom"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        Throwable lanzada = org.assertj.core.api.Assertions.catchThrowable(
                () -> smtpMailService.enviarCodigoRecuperacion("admin@museo.com", "654321"));

        assertThat(MailErrorDiagnostics.describir(lanzada)).doesNotContain("654321");
    }
}
