package com.museosmart.iot;

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
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Consumidor MQTT administrado por Spring.
 *
 * <p>Conecta al broker al arrancar, se suscribe a los topicos ambiental y de
 * presencia con el QoS configurado y se reconecta automaticamente con una
 * espera controlada. El cliente es un unico bean singleton, de modo que el
 * contexto no crea consumidores duplicados. En {@link PreDestroy} se
 * desconecta y cierra limpiamente.</p>
 */
@Component
public class MqttConsumidor {

    private static final Logger log = LoggerFactory.getLogger(MqttConsumidor.class);

    private final IotMqttProperties propiedades;
    private final MqttMensajeProcesador procesador;

    private MqttClient client;

    public MqttConsumidor(IotMqttProperties propiedades, MqttMensajeProcesador procesador) {
        this.propiedades = propiedades;
        this.procesador = procesador;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void iniciar() {
        if (!propiedades.isEnabled()) {
            log.info("Consumidor MQTT deshabilitado (app.iot.mqtt.enabled=false)");
            return;
        }
        if (client != null && client.isConnected()) {
            log.debug("Consumidor MQTT ya conectado; no se crea otro");
            return;
        }
        conectar();
    }

    private void conectar() {
        try {
            String clientId = propiedades.getClientId() + "-" + UUID.randomUUID().toString().substring(0, 8);
            client = new MqttClient(propiedades.getBrokerUrl(), clientId, new MemoryPersistence());
            client.setCallback(new CallbackInterno());

            MqttConnectOptions opciones = new MqttConnectOptions();
            opciones.setAutomaticReconnect(true);
            opciones.setCleanSession(propiedades.isCleanSession());
            opciones.setConnectionTimeout(propiedades.getConnectionTimeoutSeconds());
            opciones.setKeepAliveInterval(propiedades.getKeepAliveSeconds());
            opciones.setMaxReconnectDelay((int) propiedades.getReconnectDelayMs());
            if (propiedades.getUsername() != null && !propiedades.getUsername().isBlank()) {
                opciones.setUserName(propiedades.getUsername());
                opciones.setPassword(propiedades.getPassword().toCharArray());
            }

            client.connect(opciones);
            log.info("Conectado al broker MQTT {} como {}", propiedades.getBrokerUrl(), clientId);
        } catch (MqttException ex) {
            log.error("No se pudo conectar al broker MQTT {}. Se reintentara al reconectar.",
                    propiedades.getBrokerUrl(), ex);
        }
    }

    private void suscribir() throws MqttException {
        client.subscribe(propiedades.getTopicoAmbiental(), propiedades.getQos());
        client.subscribe(propiedades.getTopicoPresencia(), propiedades.getQos());
        log.info("Suscrito a '{}' y '{}' (QoS {})",
                propiedades.getTopicoAmbiental(), propiedades.getTopicoPresencia(), propiedades.getQos());
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
            log.info("Consumidor MQTT detenido");
        } catch (MqttException ex) {
            log.warn("Error al cerrar el cliente MQTT", ex);
        }
    }

    /** Callback que reaplica las suscripciones tras cada reconexion. */
    private final class CallbackInterno implements MqttCallbackExtended {

        @Override
        public void connectComplete(boolean reconnect, String serverURI) {
            try {
                suscribir();
            } catch (MqttException ex) {
                log.error("No se pudieron restaurar las suscripciones MQTT", ex);
            }
        }

        @Override
        public void connectionLost(Throwable cause) {
            log.warn("Conexion MQTT perdida; el cliente intentara reconectar automaticamente", cause);
        }

        @Override
        public void messageArrived(String topic, MqttMessage message) {
            try {
                byte[] payload = message.getPayload();
                log.debug("MQTT [{}] recibido ({} bytes)", topic, payload.length);
                procesador.procesar(topic, payload);
            } catch (RuntimeException ex) {
                log.error("Error inesperado procesando mensaje MQTT en [{}]", topic, ex);
            }
        }

        @Override
        public void deliveryComplete(IMqttDeliveryToken token) {
            // No publicamos mensajes; no aplica.
        }
    }
}
