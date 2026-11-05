package com.museosmart.iot.influx;

import com.museosmart.entity.MedicionPendiente;
import com.museosmart.iot.IotInfluxProperties;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MedicionEnvioServiceTest {

    @Mock
    private MedicionPendienteRepository repository;

    @Mock
    private InfluxEscritor escritor;

    @Mock
    private EstadoSensorRedisRepository estadoSensorRedis;

    private MedicionEnvioService service;
    private IotInfluxProperties propiedades;

    @BeforeEach
    void setUp() {
        propiedades = new IotInfluxProperties();
        propiedades.setMaxIntentos(3);
        propiedades.setReintentoSegundos(30);
        service = new MedicionEnvioService(repository, escritor, propiedades, estadoSensorRedis);
    }

    private MedicionPendiente pendiente() {
        MedicionPendiente m = new MedicionPendiente();
        m.setMetrica("TEMPERATURA");
        m.setValor(BigDecimal.valueOf(22.5));
        m.setEstado("PENDIENTE");
        return m;
    }

    @Test
    @DisplayName("envío correcto marca ENVIADO y limpia error")
    void envioCorrecto_marcaEnviado() {
        MedicionPendiente m = pendiente();
        when(repository.findById(1L)).thenReturn(Optional.of(m));

        service.procesar(1L);

        assertThat(m.getEstado()).isEqualTo("ENVIADO");
        assertThat(m.getEnviadoEn()).isNotNull();
        assertThat(m.getProximoIntentoEn()).isNull();
    }

    @Test
    @DisplayName("fallo incrementa intentos y programa reintento")
    void fallo_programaReintento() {
        MedicionPendiente m = pendiente();
        when(repository.findById(1L)).thenReturn(Optional.of(m));
        doThrow(new RuntimeException("broker caido")).when(escritor).escribir(any());

        service.procesar(1L);

        assertThat(m.getEstado()).isEqualTo("PENDIENTE");
        assertThat(m.getIntentos()).isEqualTo(1);
        assertThat(m.getProximoIntentoEn()).isNotNull();
        assertThat(m.getUltimoError()).contains("broker caido");
    }

    @Test
    @DisplayName("superar maxIntentos deja la medición en ERROR")
    void superaMaxIntentos_marcaError() {
        MedicionPendiente m = pendiente();
        m.setIntentos(2); // el siguiente es el 3 => maxIntentos
        when(repository.findById(1L)).thenReturn(Optional.of(m));
        doThrow(new RuntimeException("sigue fallando")).when(escritor).escribir(any());

        service.procesar(1L);

        assertThat(m.getEstado()).isEqualTo("ERROR");
        assertThat(m.getIntentos()).isEqualTo(3);
        assertThat(m.getProximoIntentoEn()).isNull();
    }

    @Test
    @DisplayName("medición ya enviada no se reprocesa")
    void yaEnviada_noReprocesa() {
        MedicionPendiente m = pendiente();
        m.setEstado("ENVIADO");
        when(repository.findById(1L)).thenReturn(Optional.of(m));

        service.procesar(1L);

        verify(escritor, org.mockito.Mockito.never()).escribir(any());
    }
}
