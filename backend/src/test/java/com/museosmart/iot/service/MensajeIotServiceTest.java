package com.museosmart.iot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.MensajeIot;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.entity.Visita;
import com.museosmart.iot.MensajeInvalidoException;
import com.museosmart.iot.MensajeIotValidador;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.MensajeIotRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import com.museosmart.service.AlertaService;
import com.museosmart.service.PopularidadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pruebas unitarias de la deteccion de flanco de presencia en la ingestion MQTT.
 *
 * <p>Verifica que una visita simulada se contabiliza UNA sola vez por episodio:
 * solo en la transicion a presencia activa (false/null -> true), y nunca en las
 * lecturas periodicas que repiten {@code true} ni en las bajadas a {@code false}.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MensajeIotServiceTest {

    private static final String TOPICO_AMB = "museo/sensores/ambiental";
    private static final String TOPICO_PRE = "museo/sensores/presencia";
    private static final String CODIGO = "SENSOR-PRESENCIA-001";

    @Mock
    private MensajeIotRepository mensajeIotRepository;

    @Mock
    private MedicionPendienteRepository medicionPendienteRepository;

    @Mock
    private SensorRepository sensorRepository;

    @Mock
    private MensajeIotValidador validador;

    @Mock
    private AlertaService alertaService;

    @Mock
    private PopularidadService popularidadService;

    @Mock
    private EstadoSensorRedisRepository estadoSensorRedis;

    private MensajeIotService service;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        service = new MensajeIotService(mensajeIotRepository, medicionPendienteRepository,
                sensorRepository, validador, alertaService, popularidadService, estadoSensorRedis, objectMapper);
    }

    private Exhibicion exhibicion(Long id, boolean activa) {
        Exhibicion e = new Exhibicion();
        setId(e, id);
        e.setCodigo("pintura-historica-01");
        e.setTitulo("[PROVISIONAL] pintura-historica-01");
        e.setActiva(activa);
        return e;
    }

    private Sensor sensor(Long id, Exhibicion ex, Boolean presenciaActual) {
        Sensor s = new Sensor();
        setId(s, id);
        s.setCodigo(CODIGO);
        s.setTipo("PRESENCIA");
        s.setCategoria("PRESENCIA");
        s.setExhibicion(ex);
        s.setPresenciaActual(presenciaActual);
        return s;
    }

    private static void setId(Object entidad, Long id) {
        try {
            var f = entidad.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entidad, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private MensajeIot mensajePresencia(Long exhibicionId, boolean presencia) {
        UUID mensajeId = UUID.randomUUID();
        MensajeIot mensaje = new MensajeIot();
        mensaje.setMensajeId(mensajeId);
        mensaje.setTopico(TOPICO_PRE);
        mensaje.setSensorCodigo(CODIGO);
        String idJson = exhibicionId == null ? "" : "\"exhibicionId\":" + exhibicionId + ",";
        mensaje.setPayload("{\"mensajeId\":\"" + mensajeId + "\",\"sensorCodigo\":\"" + CODIGO + "\","
                + idJson + "\"presencia\":" + presencia + ","
                + "\"timestamp\":\"2026-10-13T21:50:00Z\"}");
        return mensaje;
    }

    private MensajeIot mensajeAmbiental(Long salaId) {
        UUID mensajeId = UUID.randomUUID();
        MensajeIot mensaje = new MensajeIot();
        mensaje.setMensajeId(mensajeId);
        mensaje.setTopico(TOPICO_AMB);
        mensaje.setSensorCodigo(CODIGO);
        String idJson = salaId == null ? "" : "\"salaId\":" + salaId + ",";
        mensaje.setPayload("{\"mensajeId\":\"" + mensajeId + "\",\"sensorCodigo\":\"" + CODIGO + "\","
                + idJson + "\"temperatura\":22.5,\"humedad\":50.0,\"luminosidad\":300.0,"
                + "\"timestamp\":\"2026-10-13T21:50:00Z\"}");
        return mensaje;
    }

    private void procesar(Sensor sensor, MensajeIot mensaje) {
        when(mensajeIotRepository.findByMensajeId(mensaje.getMensajeId()))
                .thenReturn(Optional.of(mensaje));
        when(sensorRepository.findByCodigoConBloqueo(CODIGO))
                .thenReturn(Optional.of(sensor));
        service.procesarContenido(mensaje.getMensajeId(), TOPICO_PRE, TOPICO_AMB, TOPICO_PRE);
    }

    private Sala sala(Long id) {
        Sala s = new Sala();
        setId(s, id);
        s.setNombre("Sala " + id);
        s.setCodigo3d("SALA_" + id);
        return s;
    }

    private Sensor sensorAmbiental(Long id, Sala sala) {
        Sensor s = new Sensor();
        setId(s, id);
        s.setCodigo(CODIGO);
        s.setTipo("MULTI");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return s;
    }

    private void procesarAmbiental(Sensor sensor, MensajeIot mensaje) {
        when(mensajeIotRepository.findByMensajeId(mensaje.getMensajeId()))
                .thenReturn(Optional.of(mensaje));
        when(sensorRepository.findByCodigo(CODIGO))
                .thenReturn(Optional.of(sensor));
        service.procesarContenido(mensaje.getMensajeId(), TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);
    }

    @Test
    @DisplayName("presencia true desde estado desconocido (null) contabiliza una visita")
    void primeraPresencia_cuentaVisita() {
        Exhibicion ex = exhibicion(1L, true);
        Sensor s = sensor(10L, ex, null);

        procesar(s, mensajePresencia(1L, true));

        verify(popularidadService, times(1))
                .registrarVisita(eq(1L), anyString(), eq(Visita.FUENTE_SENSOR));
        verify(sensorRepository).save(s);
    }

    @Test
    @DisplayName("lectura periodica con presencia ya activa no vuelve a contar")
    void presenciaRepetida_noCuenta() {
        Exhibicion ex = exhibicion(1L, true);
        Sensor s = sensor(10L, ex, Boolean.TRUE);

        procesar(s, mensajePresencia(1L, true));

        verify(popularidadService, never()).registrarVisita(any(), anyString(), anyString());
        verify(sensorRepository).save(s);
    }

    @Test
    @DisplayName("la bajada a false no cuenta y actualiza el estado")
    void bajada_noCuenta() {
        Exhibicion ex = exhibicion(1L, true);
        Sensor s = sensor(10L, ex, Boolean.TRUE);

        procesar(s, mensajePresencia(1L, false));

        verify(popularidadService, never()).registrarVisita(any(), anyString(), anyString());
        verify(sensorRepository).save(s);
    }

    @Test
    @DisplayName("secuencia true -> true -> false -> true cuenta dos visitas (una por episodio)")
    void reingreso_cuentaDosVisitas() {
        Exhibicion ex = exhibicion(1L, true);
        Sensor s = sensor(10L, ex, null);

        procesar(s, mensajePresencia(1L, true));   // episodio 1 (flanco subida) -> cuenta
        procesar(s, mensajePresencia(1L, true));   // periodica repetida -> no cuenta
        procesar(s, mensajePresencia(1L, false));  // bajada -> no cuenta
        procesar(s, mensajePresencia(1L, true));   // episodio 2 (flanco subida) -> cuenta

        verify(popularidadService, times(2))
                .registrarVisita(eq(1L), anyString(), eq(Visita.FUENTE_SENSOR));
    }

    @Test
    @DisplayName("cada episodio usa una identidad de sesion distinta derivada de su mensaje")
    void episodiosDistintos_identidadesDistintas() {
        Exhibicion ex = exhibicion(1L, true);
        Sensor s = sensor(10L, ex, null);

        MensajeIot primerMensaje = mensajePresencia(1L, true);
        procesar(s, primerMensaje);
        MensajeIot bajada = mensajePresencia(1L, false);
        procesar(s, bajada);
        MensajeIot segundoMensaje = mensajePresencia(1L, true);
        procesar(s, segundoMensaje);

        ArgumentCaptor<String> sesionCaptor = ArgumentCaptor.forClass(String.class);
        verify(popularidadService, times(2))
                .registrarVisita(eq(1L), sesionCaptor.capture(), eq(Visita.FUENTE_SENSOR));

        List<String> sesiones = sesionCaptor.getAllValues();
        assertThat(sesiones).doesNotHaveDuplicates();
        assertThat(sesiones.get(0)).isEqualTo(sesionDe(primerMensaje));
        assertThat(sesiones.get(1)).isEqualTo(sesionDe(segundoMensaje));
    }

    @Test
    @DisplayName("reprocesar el mismo mensaje produce identidades de sesion iguales")
    void mismoMensaje_mismaIdentidad() {
        Exhibicion ex = exhibicion(1L, true);
        MensajeIot mensaje = mensajePresencia(1L, true);
        Sensor s = sensor(10L, ex, null);

        // Primer procesamiento: flanco desde null.
        procesar(s, mensaje);
        // El mismo mensaje reaparece (por ejemplo, reproceso): el estado ya es true,
        // por lo que no vuelve a contar, pero la identidad seria la misma.
        procesar(s, mensaje);

        ArgumentCaptor<String> sesionCaptor = ArgumentCaptor.forClass(String.class);
        verify(popularidadService, times(1))
                .registrarVisita(eq(1L), sesionCaptor.capture(), eq(Visita.FUENTE_SENSOR));
        assertThat(sesionCaptor.getValue()).isEqualTo(sesionDeMensaje(mensaje.getMensajeId()));
    }

    private String sesionDe(MensajeIot mensaje) {
        return sesionDeMensaje(mensaje.getMensajeId());
    }

    private String sesionDeMensaje(UUID mensajeId) {
        return UUID.nameUUIDFromBytes(
                ("sensor-episodio:" + mensajeId).getBytes(StandardCharsets.UTF_8)).toString();
    }

    @Test
    @DisplayName("una exhibicion inactiva no registra visita pero procesa la presencia")
    void exhibicionInactiva_noRegistraVisita() {
        Exhibicion ex = exhibicion(1L, false);
        Sensor s = sensor(10L, ex, null);

        procesar(s, mensajePresencia(1L, true));

        verify(popularidadService, never()).registrarVisita(any(), anyString(), anyString());
        verify(medicionPendienteRepository).save(any());
        verify(sensorRepository).save(s);
    }

    @Test
    @DisplayName("presencia sin exhibicionId se procesa usando la exhibicion del sensor")
    void presenciaSinExhibicionId_seProcesa() {
        Exhibicion ex = exhibicion(7L, true);
        Sensor s = sensor(10L, ex, null);

        procesar(s, mensajePresencia(null, true));

        verify(popularidadService, times(1))
                .registrarVisita(eq(7L), anyString(), eq(Visita.FUENTE_SENSOR));
        verify(medicionPendienteRepository).save(any());
        verify(sensorRepository).save(s);
    }

    @Test
    @DisplayName("presencia con exhibicionId incorrecto se rechaza")
    void presenciaConExhibicionIdIncorrecto_seRechaza() {
        Exhibicion ex = exhibicion(7L, true);
        Sensor s = sensor(10L, ex, null);
        MensajeIot mensaje = mensajePresencia(999L, true);
        when(mensajeIotRepository.findByMensajeId(mensaje.getMensajeId()))
                .thenReturn(Optional.of(mensaje));
        when(sensorRepository.findByCodigoConBloqueo(CODIGO))
                .thenReturn(Optional.of(s));

        assertThatThrownBy(() -> service.procesarContenido(
                mensaje.getMensajeId(), TOPICO_PRE, TOPICO_AMB, TOPICO_PRE))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("no corresponde a la exhibicion");

        verify(popularidadService, never()).registrarVisita(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("ambiental sin salaId se procesa usando la sala del sensor")
    void ambientalSinSalaId_seProcesa() {
        Sala sala = sala(23L);
        Sensor s = sensorAmbiental(10L, sala);

        procesarAmbiental(s, mensajeAmbiental(null));

        verify(medicionPendienteRepository, times(3)).save(any());
    }

    @Test
    @DisplayName("ambiental con salaId correcto se procesa")
    void ambientalConSalaIdCorrecto_seProcesa() {
        Sala sala = sala(23L);
        Sensor s = sensorAmbiental(10L, sala);

        procesarAmbiental(s, mensajeAmbiental(23L));

        verify(medicionPendienteRepository, times(3)).save(any());
    }

    @Test
    @DisplayName("ambiental con salaId incorrecto se rechaza")
    void ambientalConSalaIdIncorrecto_seRechaza() {
        Sala sala = sala(23L);
        Sensor s = sensorAmbiental(10L, sala);
        MensajeIot mensaje = mensajeAmbiental(1L);
        when(mensajeIotRepository.findByMensajeId(mensaje.getMensajeId()))
                .thenReturn(Optional.of(mensaje));
        when(sensorRepository.findByCodigo(CODIGO))
                .thenReturn(Optional.of(s));

        assertThatThrownBy(() -> service.procesarContenido(
                mensaje.getMensajeId(), TOPICO_AMB, TOPICO_AMB, TOPICO_PRE))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("no corresponde a la sala");

        verify(medicionPendienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("sensor desconocido se rechaza")
    void sensorDesconocido_seRechaza() {
        MensajeIot mensaje = mensajeAmbiental(null);
        when(mensajeIotRepository.findByMensajeId(mensaje.getMensajeId()))
                .thenReturn(Optional.of(mensaje));
        when(sensorRepository.findByCodigo(CODIGO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.procesarContenido(
                mensaje.getMensajeId(), TOPICO_AMB, TOPICO_AMB, TOPICO_PRE))
                .isInstanceOf(MensajeInvalidoException.class)
                .hasMessageContaining("sensor desconocido");
    }
}
