package com.museosmart.mail;

/**
 * Error de envio de correo. Permite al dominio reaccionar ante un fallo del
 * proveedor sin acoplarse a las excepciones concretas de Spring Mail.
 */
public class MailSendException extends RuntimeException {

    public MailSendException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}
