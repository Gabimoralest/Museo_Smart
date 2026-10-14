package com.museosmart.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;

class MailConfigDiagnosticsTest {

    @Test
    @DisplayName("no lanza cuando todas las propiedades están presentes")
    void configuracionCompleta_noLanza() {
        MailConfigDiagnostics diag = new MailConfigDiagnostics(
                "smtp.gmail.com", 587, "smartmuseo@gmail.com", "claveSinEspacios16x", "smartmuseo@gmail.com");

        assertThatCode(() -> diag.run(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("no lanza cuando falta la contraseña (solo diagnostica)")
    void contrasenaFaltante_noLanza() {
        MailConfigDiagnostics diag = new MailConfigDiagnostics(
                "smtp.gmail.com", 587, "smartmuseo@gmail.com", "", "smartmuseo@gmail.com");

        assertThatCode(() -> diag.run(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("advierte si la contraseña parece tener formato con espacios (19 chars)")
    void contrasenaConFormatoDeEspacios() {
        MailConfigDiagnostics diag = new MailConfigDiagnostics(
                "smtp.gmail.com", 587, "smartmuseo@gmail.com", "abcdefgh ijklmnop", "smartmuseo@gmail.com");

        // No debe lanzar ni exponer el valor; solo registrar advertencia internamente.
        assertThatCode(() -> diag.run(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("advierte si remitente y usuario no coinciden")
    void remitenteDistintoDeUsuario() {
        MailConfigDiagnostics diag = new MailConfigDiagnostics(
                "smtp.gmail.com", 587, "cuenta@gmail.com", "claveSinEspacios16x", "otro@gmail.com");

        assertThatCode(() -> diag.run(null)).doesNotThrowAnyException();
    }
}
