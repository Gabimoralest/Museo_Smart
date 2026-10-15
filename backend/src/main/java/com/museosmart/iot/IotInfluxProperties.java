package com.museosmart.iot;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion de la integracion con InfluxDB 2.x.
 *
 * <p>El token y la URL se cargan del entorno; no se versionan valores reales.
 * Si no hay token configurado, el drenado del outbox queda inactivo y las
 * mediciones permanecen en {@code medicion_pendiente} (nunca se pierden).</p>
 */
@Component
@ConfigurationProperties(prefix = "app.iot.influx")
public class IotInfluxProperties {

    /** Habilita el drenado hacia InfluxDB. */
    private boolean enabled = true;

    /** URL base de InfluxDB (p. ej. http://localhost:8087). */
    private String url = "http://localhost:8087";

    /** Token de API (vacio = integracion deshabilitada en la practica). */
    private String token = "";

    /** Organizacion destino. */
    private String org = "museo_smart";

    /** Bucket destino. */
    private String bucket = "museo_smart_ambiental";

    /** Numero maximo de mediciones a drenar por ciclo. */
    private int lote = 100;

    /** Segundos de espera antes de reintentar una medicion fallida. */
    private long reintentoSegundos = 30;

    /** Intentos maximos antes de dejar la medicion en estado ERROR. */
    private int maxIntentos = 10;

    /** Intervalo (ms) del barrido del outbox. */
    private long intervaloMs = 15000;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getOrg() {
        return org;
    }

    public void setOrg(String org) {
        this.org = org;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public int getLote() {
        return lote;
    }

    public void setLote(int lote) {
        this.lote = lote;
    }

    public long getReintentoSegundos() {
        return reintentoSegundos;
    }

    public void setReintentoSegundos(long reintentoSegundos) {
        this.reintentoSegundos = reintentoSegundos;
    }

    public int getMaxIntentos() {
        return maxIntentos;
    }

    public void setMaxIntentos(int maxIntentos) {
        this.maxIntentos = maxIntentos;
    }

    public long getIntervaloMs() {
        return intervaloMs;
    }

    public void setIntervaloMs(long intervaloMs) {
        this.intervaloMs = intervaloMs;
    }

    /** Indica si hay configuracion suficiente para intentar escribir. */
    public boolean configurado() {
        return enabled && token != null && !token.isBlank()
                && url != null && !url.isBlank()
                && org != null && !org.isBlank()
                && bucket != null && !bucket.isBlank();
    }
}
