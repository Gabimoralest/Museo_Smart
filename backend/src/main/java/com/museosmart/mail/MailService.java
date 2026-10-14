package com.museosmart.mail;

/**
 * Abstraccion de envio de correo. De momento solo existe una implementacion
 * simulada; el envio real por SMTP se incorporara en una fase posterior.
 */
public interface MailService {

    /**
     * Envia el codigo de recuperacion al destinatario.
     * La implementacion NUNCA debe registrar el codigo en logs.
     */
    void enviarCodigoRecuperacion(String destinatario, String codigo);
}
