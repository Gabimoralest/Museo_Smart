package com.museosmart.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.ConnectException;

import static org.assertj.core.api.Assertions.assertThat;

class MailErrorDiagnosticsTest {

    @Test
    @DisplayName("describe la cadena de causas incluyendo la causa raíz")
    void describeCadenaDeCausas() {
        Throwable raiz = new ConnectException("Connection refused");
        Throwable intermedia = new RuntimeException("No se pudo conectar al host", raiz);
        MailSendException error = new MailSendException("No se pudo enviar el correo de recuperación", intermedia);

        String descripcion = MailErrorDiagnostics.describir(error);

        assertThat(descripcion).contains("MailSendException");
        assertThat(descripcion).contains("Connection refused");
        assertThat(descripcion).contains("<-");
    }

    @Test
    @DisplayName("identifica la causa raíz real")
    void identificaCausaRaiz() {
        Throwable raiz = new ConnectException("timeout");
        MailSendException error = new MailSendException("fallo", new RuntimeException("capa media", raiz));

        assertThat(MailErrorDiagnostics.causaRaiz(error)).isSameAs(raiz);
    }

    @Test
    @DisplayName("describe null de forma segura")
    void describeNull() {
        assertThat(MailErrorDiagnostics.describir(null)).isEqualTo("sin causa");
        assertThat(MailErrorDiagnostics.causaRaiz(null)).isNull();
    }

    @Test
    @DisplayName("trunca mensajes muy largos y elimina saltos de línea")
    void truncaMensajesLargos() {
        String largo = "x".repeat(1000) + "\nlinea2";
        MailSendException error = new MailSendException("fallo", new RuntimeException(largo));

        String descripcion = MailErrorDiagnostics.describir(error);

        assertThat(descripcion).doesNotContain("\n");
        assertThat(descripcion.length()).isLessThan(700);
    }
}
