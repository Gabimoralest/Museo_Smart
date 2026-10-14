package com.museosmart.iot;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del consumidor MQTT.
 *
 * <p>Valores por defecto seguros para desarrollo (broker en localhost:1884 con
 * autenticacion). Las credenciales se cargan desde variables de entorno y no
 * deben codificarse ni versionarse.</p>
 */
@Component
@ConfigurationProperties(prefix = "app.iot.mqtt")
public class IotMqttProperties {

    /** Habilita o deshabilita el consumidor (util en pruebas). */
    private boolean enabled = true;

    /** URL del broker, p. ej. tcp://localhost:1884. */
    private String brokerUrl = "tcp://localhost:1884";

    /** Identificador de cliente MQTT (debe ser unico por conexion). */
    private String clientId = "museo-smart-backend";

    /** Usuario MQTT (vacio = sin autenticacion). */
    private String username = "";

    /** Contrasena MQTT (no versionar; se inyecta por entorno). */
    private String password = "";

    /** Topico de sensores ambientales. */
    private String topicoAmbiental = "museo/sensores/ambiental";

    /** Topico de sensores de presencia. */
    private String topicoPresencia = "museo/sensores/presencia";

    /** Nivel de calidad de servicio para la suscripcion. */
    private int qos = 1;

    /** Sesion limpia: no conserva suscripciones entre conexiones. */
    private boolean cleanSession = true;

    /** Keep-alive en segundos. */
    private int keepAliveSeconds = 60;

    /** Timeout de conexion en segundos. */
    private int connectionTimeoutSeconds = 10;

    /** Espera entre reintentos de conexion en milisegundos. */
    private long reconnectDelayMs = 5000;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBrokerUrl() {
        return brokerUrl;
    }

    public void setBrokerUrl(String brokerUrl) {
        this.brokerUrl = brokerUrl;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getTopicoAmbiental() {
        return topicoAmbiental;
    }

    public void setTopicoAmbiental(String topicoAmbiental) {
        this.topicoAmbiental = topicoAmbiental;
    }

    public String getTopicoPresencia() {
        return topicoPresencia;
    }

    public void setTopicoPresencia(String topicoPresencia) {
        this.topicoPresencia = topicoPresencia;
    }

    public int getQos() {
        return qos;
    }

    public void setQos(int qos) {
        this.qos = qos;
    }

    public boolean isCleanSession() {
        return cleanSession;
    }

    public void setCleanSession(boolean cleanSession) {
        this.cleanSession = cleanSession;
    }

    public int getKeepAliveSeconds() {
        return keepAliveSeconds;
    }

    public void setKeepAliveSeconds(int keepAliveSeconds) {
        this.keepAliveSeconds = keepAliveSeconds;
    }

    public int getConnectionTimeoutSeconds() {
        return connectionTimeoutSeconds;
    }

    public void setConnectionTimeoutSeconds(int connectionTimeoutSeconds) {
        this.connectionTimeoutSeconds = connectionTimeoutSeconds;
    }

    public long getReconnectDelayMs() {
        return reconnectDelayMs;
    }

    public void setReconnectDelayMs(long reconnectDelayMs) {
        this.reconnectDelayMs = reconnectDelayMs;
    }
}
