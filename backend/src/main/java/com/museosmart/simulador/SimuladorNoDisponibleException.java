package com.museosmart.simulador;

/** Falla al comunicarse con el broker MQTT para el simulador. */
public class SimuladorNoDisponibleException extends RuntimeException {

    public SimuladorNoDisponibleException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}
