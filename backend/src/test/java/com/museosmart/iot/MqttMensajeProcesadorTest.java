package com.museosmart.iot;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.iot.service.MensajeIotService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MqttMensajeProcesadorTest {

    private MensajeIotService service;
    private IotMqttProperties propiedades;
    private MqttMensajeProcesador procesador;

    private static final String TOPICO_AMB = "museo/sensores/ambiental";
    private static final String TOPICO_PRE = "museo/sensores/presencia";

    @BeforeEach
    void setUp() {
        service = mock(MensajeIotService.class);
        propiedades = new IotMqttProperties();
        procesador = new MqttMensajeProcesador(service, propiedades, new ObjectMapper());
    }

    private byte[] json(String uuid) {
        String payload = "{\"mensajeId\":\"" + uuid + "\",\"sensorCodigo\":\"S1\","
                + "\"salaId\":1,\"temperatura\":22.5,\"humedad\":50.0,"
                + "\"luminosidad\":300.0,\"timestamp\":\"2026-10-13T21:50:00Z\"}";
        return payload.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("mensaje nuevo se registra y se procesa")
    void mensajeNuevo_seProcesa() {
        UUID id = UUID.randomUUID();
        when(service.registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"))).thenReturn(10L);

        procesador.procesar(TOPICO_AMB, json(id.toString()));

        verify(service).registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"));
        verify(service).procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);
        verify(service, never()).marcarError(any(), any());
    }

    @Test
    @DisplayName("mensaje duplicado no se procesa ni genera efectos")
    void mensajeDuplicado_noProcesa() {
        UUID id = UUID.randomUUID();
        when(service.registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"))).thenReturn(null);

        procesador.procesar(TOPICO_AMB, json(id.toString()));

        verify(service).registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"));
        verify(service, never()).procesarContenido(any(), any(), any(), any());
        verify(service, never()).marcarError(any(), any());
    }

    @Test
    @DisplayName("payload sin mensajeId valido se descarta sin tocar la base")
    void payloadSinMensajeId_seDescarta() {
        String malo = "{\"sensorCodigo\":\"S1\"}";

        procesador.procesar(TOPICO_AMB, malo.getBytes(StandardCharsets.UTF_8));

        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("fallo de validacion marca ERROR y nunca PROCESADO")
    void falloValidacion_marcaError() {
        UUID id = UUID.randomUUID();
        when(service.registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"))).thenReturn(10L);
        doThrow(new MensajeInvalidoException("sensor desconocido: S1"))
                .when(service).procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);

        procesador.procesar(TOPICO_AMB, json(id.toString()));

        verify(service).marcarError(id, "sensor desconocido: S1");
    }

    @Test
    @DisplayName("error inesperado de persistencia marca ERROR sin marcar PROCESADO")
    void errorPersistencia_marcaError() {
        UUID id = UUID.randomUUID();
        when(service.registrarRecepcion(eq(id), eq(TOPICO_AMB), any(), eq("S1"))).thenReturn(10L);
        doThrow(new RuntimeException("fallo de base de datos"))
                .when(service).procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);

        procesador.procesar(TOPICO_AMB, json(id.toString()));

        verify(service).marcarError(eq(id), any());
    }
}
