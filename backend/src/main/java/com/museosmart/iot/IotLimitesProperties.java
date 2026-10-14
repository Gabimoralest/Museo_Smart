package com.museosmart.iot;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Limites configurables de validacion de los payloads ambientales.
 *
 * <p>Se rechazan valores no finitos (NaN/Infinity) y fuera de estos rangos.
 * Los valores deben ser coherentes fisicamente; nunca se recortan ni se
 * sustituyen por defecto.</p>
 */
@Component
@ConfigurationProperties(prefix = "app.iot.limites")
public class IotLimitesProperties {

    private Rango temperatura = new Rango(-100.0, 100.0);
    private Rango humedad = new Rango(0.0, 100.0);
    private Rango luminosidad = new Rango(0.0, 200000.0);

    public Rango getTemperatura() {
        return temperatura;
    }

    public void setTemperatura(Rango temperatura) {
        this.temperatura = temperatura;
    }

    public Rango getHumedad() {
        return humedad;
    }

    public void setHumedad(Rango humedad) {
        this.humedad = humedad;
    }

    public Rango getLuminosidad() {
        return luminosidad;
    }

    public void setLuminosidad(Rango luminosidad) {
        this.luminosidad = luminosidad;
    }

    /** Rango inclusivo [min, max]. */
    public static class Rango {
        private double min;
        private double max;

        public Rango() {
        }

        public Rango(double min, double max) {
            this.min = min;
            this.max = max;
        }

        public double getMin() {
            return min;
        }

        public void setMin(double min) {
            this.min = min;
        }

        public double getMax() {
            return max;
        }

        public void setMax(double max) {
            this.max = max;
        }

        public boolean contiene(double valor) {
            return valor >= min && valor <= max;
        }
    }
}
