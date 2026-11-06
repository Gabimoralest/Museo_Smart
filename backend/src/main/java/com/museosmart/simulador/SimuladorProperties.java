package com.museosmart.simulador;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del simulador de demostracion.
 *
 * <p>Por defecto esta DESHABILITADO: los endpoints de escenarios solo existen
 * si {@code APP_SIMULADOR_HABILITADO=true}. Con el flag en false el controlador
 * no se registra y las rutas responden 404, de modo que una instalacion normal
 * no expone control alguno sobre la simulacion.</p>
 */
@Component
@ConfigurationProperties(prefix = "app.simulador")
public class SimuladorProperties {

    /** Habilita los endpoints de escenarios y el envio de ordenes MQTT. */
    private boolean habilitado = false;

    /** Topico MQTT de control de escenarios. */
    private String topicoControl = "museo/simulador/escenario";

    /** Topico MQTT del estado del simulador (retained). */
    private String topicoEstado = "museo/simulador/estado";

    /** Topico MQTT del horario de visita forzado. */
    private String topicoHorario = "museo/simulador/horario";

    public boolean isHabilitado() {
        return habilitado;
    }

    public void setHabilitado(boolean habilitado) {
        this.habilitado = habilitado;
    }

    public String getTopicoControl() {
        return topicoControl;
    }

    public void setTopicoControl(String topicoControl) {
        this.topicoControl = topicoControl;
    }

    public String getTopicoEstado() {
        return topicoEstado;
    }

    public void setTopicoEstado(String topicoEstado) {
        this.topicoEstado = topicoEstado;
    }

    public String getTopicoHorario() {
        return topicoHorario;
    }

    public void setTopicoHorario(String topicoHorario) {
        this.topicoHorario = topicoHorario;
    }
}
