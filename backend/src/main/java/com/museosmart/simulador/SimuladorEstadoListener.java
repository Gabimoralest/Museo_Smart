package com.museosmart.simulador;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.iot.IotMqttProperties;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Escucha el estado retenido del simulador ({@code museo/simulador/estado}) y
 * guarda la ultima version en memoria. El backend no calcula ni inventa el
 * estado: lo reenvia tal cual lo publica Node-RED.
 */
@Component
@ConditionalOnProperty(name = "app.simulador.habilitado", havingValue = "true")
public class SimuladorEstadoListener {

    private static final Logger log = LoggerFactory.getLogger(SimuladorEstadoListener.class);

    private final IotMqttProperties propiedades;
    private final SimuladorProperties simuladorProperties;
    private final ObjectMapper objectMapper;

    private MqttClient client;
    private volatile SimuladorEstadoResponse ultimo = SimuladorEstadoResponse.vacio();

    public SimuladorEstadoListener(IotMqttProperties propiedades,
                                   SimuladorProperties simuladorProperties,
                                   ObjectMapper objectMapper) {
        this.propiedades = propiedades;
        this.simuladorProperties = simuladorProperties;
        this.objectMapper = objectMapper;
    }

    /** Ultimo estado conocido (vacio si aun no llego ningun mensaje). */
    public SimuladorEstadoResponse estado() {
        return ultimo;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void iniciar() {
        conectar();
    }

    private void conectar() {
        try {
            String clientId = "museo-simulador-estado-" + UUID.randomUUID().toString().substring(0, 8);
            client = new MqttClient(propiedades.getBrokerUrl(), clientId, new MemoryPersistence());
            client.setCallback(new CallbackInterno());

            MqttConnectOptions opciones = new MqttConnectOptions();
            opciones.setAutomaticReconnect(true);
            opciones.setCleanSession(true);
            opciones.setConnectionTimeout(propiedades.getConnectionTimeoutSeconds());
            opciones.setKeepAliveInterval(propiedades.getKeepAliveSeconds());
            if (propiedades.getUsername() != null && !propiedades.getUsername().isBlank()) {
                opciones.setUserName(propiedades.getUsername());
                opciones.setPassword(propiedades.getPassword().toCharArray());
            }
            client.connect(opciones);
            client.subscribe(simuladorProperties.getTopicoEstado(), 1);
            log.info("Simulador: escuchando estado en '{}'", simuladorProperties.getTopicoEstado());
        } catch (MqttException ex) {
            log.warn("Simulador: no se pudo suscribir al estado ({}). "
                    + "El listado de escenarios se reintentara al reconectar.", ex.getClass().getSimpleName());
        }
    }

    @PreDestroy
    public void detener() {
        if (client == null) {
            return;
        }
        try {
            if (client.isConnected()) {
                client.disconnect();
            }
            client.close();
        } catch (MqttException ex) {
            log.warn("Simulador: error cerrando el cliente de estado", ex);
        }
    }

    private final class CallbackInterno implements MqttCallbackExtended {

        @Override
        public void connectComplete(boolean reconnect, String serverURI) {
            try {
                client.subscribe(simuladorProperties.getTopicoEstado(), 1);
            } catch (MqttException ex) {
                log.warn("Simulador: no se pudo restaurar la suscripcion de estado", ex);
            }
        }

        @Override
        public void connectionLost(Throwable cause) {
            log.warn("Simulador: conexion de estado perdida; se reintentara");
        }

        @Override
        public void messageArrived(String topic, MqttMessage message) {
            try {
                String json = new String(message.getPayload(), StandardCharsets.UTF_8);
                ultimo = objectMapper.readValue(json, SimuladorEstadoResponse.class);
            } catch (Exception ex) {
                log.warn("Simulador: estado recibido ilegible ({})", ex.getClass().getSimpleName());
            }
        }

        @Override
        public void deliveryComplete(IMqttDeliveryToken token) {
            // Solo lectura.
        }
    }
}
