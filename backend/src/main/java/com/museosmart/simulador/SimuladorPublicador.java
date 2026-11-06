package com.museosmart.simulador;

import com.museosmart.iot.IotMqttProperties;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Publicador MQTT del simulador de demostracion.
 *
 * <p>Reutiliza los datos de conexion del consumidor existente
 * ({@link IotMqttProperties}: broker, usuario, contrasena) para publicar las
 * ordenes de escenario en el topico de control. El cliente es propio y
 * separado del consumidor: asi una publicacion lenta nunca bloquea la ingesta
 * de sensores.</p>
 *
 * <p>Solo se crea cuando {@code app.simulador.habilitado=true}; con el flag en
 * false el bean no existe y los endpoints responden 404.</p>
 */
@Component
@ConditionalOnProperty(name = "app.simulador.habilitado", havingValue = "true")
public class SimuladorPublicador {

    private static final Logger log = LoggerFactory.getLogger(SimuladorPublicador.class);

    private final IotMqttProperties propiedades;
    private MqttClient client;

    public SimuladorPublicador(IotMqttProperties propiedades) {
        this.propiedades = propiedades;
    }

    /**
     * Publica un JSON en el topico indicado con QoS 1.
     *
     * @throws SimuladorNoDisponibleException si no se puede conectar o publicar.
     */
    public synchronized void publicar(String topico, String json, boolean retain) {
        try {
            MqttClient c = cliente();
            c.publish(topico, json.getBytes(StandardCharsets.UTF_8), 1, retain);
            log.info("Simulador: orden publicada en {} -> {}", topico, json);
        } catch (MqttException ex) {
            try {
                cerrar();
            } catch (RuntimeException ignore) {
                // se reintenta en la proxima publicacion
            }
            throw new SimuladorNoDisponibleException(
                    "No se pudo enviar la orden al simulador (broker MQTT no disponible)", ex);
        }
    }

    private MqttClient cliente() throws MqttException {
        if (client != null && client.isConnected()) {
            return client;
        }
        cerrar();
        String clientId = "museo-simulador-" + UUID.randomUUID().toString().substring(0, 8);
        client = new MqttClient(propiedades.getBrokerUrl(), clientId, new MemoryPersistence());
        MqttConnectOptions opciones = new MqttConnectOptions();
        opciones.setAutomaticReconnect(false);
        opciones.setCleanSession(true);
        opciones.setConnectionTimeout(propiedades.getConnectionTimeoutSeconds());
        opciones.setKeepAliveInterval(propiedades.getKeepAliveSeconds());
        if (propiedades.getUsername() != null && !propiedades.getUsername().isBlank()) {
            opciones.setUserName(propiedades.getUsername());
            opciones.setPassword(propiedades.getPassword().toCharArray());
        }
        client.connect(opciones);
        log.info("Simulador: conectado al broker MQTT {}", propiedades.getBrokerUrl());
        return client;
    }

    @PreDestroy
    public synchronized void cerrar() {
        if (client == null) {
            return;
        }
        try {
            if (client.isConnected()) {
                client.disconnect();
            }
            client.close();
        } catch (MqttException ex) {
            log.warn("Simulador: error cerrando el cliente MQTT", ex);
        } finally {
            client = null;
        }
    }
}
