package com.museosmart.service;

import com.museosmart.dto.monitoreo.HistoricoResponse;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.iot.influx.InfluxLector;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.MonitoreoRepository;
import com.museosmart.repository.redis.EstadoSensorRedisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Verifica que el histórico enriquezca cada serie con el NOMBRE DE LA SALA y
 * los limites ambientales (usados por la grafica para etiquetas y franja ideal).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MonitoreoHistoricoTest {

    @Mock
    private MonitoreoRepository monitoreoRepository;

    @Mock
    private InfluxLector influxLector;

    @Mock
    private EstadoSensorRedisRepository estadoSensorRedis;

    @Mock
    private ExhibicionRepository exhibicionRepository;

    private MonitoreoService servicio;

    @BeforeEach
    void setUp() {
        servicio = new MonitoreoService(monitoreoRepository, influxLector,
                estadoSensorRedis, exhibicionRepository);
        when(influxLector.habilitado()).thenReturn(true);
        when(influxLector.getBucket()).thenReturn("museo_smart_ambiental");
        when(influxLector.consultarSeries(anyString())).thenReturn(Map.of(
                "SENSOR-AMBIENTAL-005", List.of(
                        new InfluxLector.Punto(Instant.parse("2026-11-04T10:00:00Z"), 20.1),
                        new InfluxLector.Punto(Instant.parse("2026-11-04T11:00:00Z"), 21.4))));
    }

    private Sensor sensor(String codigo, Long salaId, String salaNombre) {
        Sala sala = new Sala();
        setId(sala, salaId);
        sala.setNombre(salaNombre);
        sala.setOrden((short) (salaId - 22));
        Sensor s = new Sensor();
        setId(s, 42L);
        s.setCodigo(codigo);
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        return s;
    }

    private Exhibicion conLimites(String tMin, String tMax, String hMin, String hMax, String luz) {
        Exhibicion e = new Exhibicion();
        e.setTempMinC(new java.math.BigDecimal(tMin));
        e.setTempMaxC(new java.math.BigDecimal(tMax));
        e.setHumedadMinPct(new java.math.BigDecimal(hMin));
        e.setHumedadMaxPct(new java.math.BigDecimal(hMax));
        e.setLuzMaxLux(new java.math.BigDecimal(luz));
        return e;
    }

    @Test
    @DisplayName("la serie incluye nombre de sala y limites de temperatura")
    void historico_enriqueceConSalaYLimites() {
        when(monitoreoRepository.listarSensoresConUbicacion())
                .thenReturn(List.of(sensor("SENSOR-AMBIENTAL-005", 23L, "Escultura y retratos")));
        // Dos exhibiciones de la sala: se toma el extremo mas permisivo.
        when(exhibicionRepository.findBySalaIdAndActiva(23L, true)).thenReturn(List.of(
                conLimites("18", "24", "40", "60", "200"),
                conLimites("17", "25", "45", "65", "180")));

        HistoricoResponse respuesta = servicio.historico("TEMPERATURA",
                OffsetDateTime.of(2026, 11, 4, 9, 0, 0, 0, ZoneOffset.UTC),
                OffsetDateTime.of(2026, 11, 4, 12, 0, 0, 0, ZoneOffset.UTC), null);

        assertThat(respuesta.series()).hasSize(1);
        HistoricoResponse.SerieSensor serie = respuesta.series().get(0);
        assertThat(serie.sensor()).isEqualTo("SENSOR-AMBIENTAL-005");
        assertThat(serie.salaId()).isEqualTo(23L);
        assertThat(serie.salaOrden()).isEqualTo(1);
        assertThat(serie.salaNombre()).isEqualTo("Escultura y retratos");
        assertThat(serie.limiteMin()).isEqualTo(17.0);
        assertThat(serie.limiteMax()).isEqualTo(25.0);
        assertThat(serie.puntos()).hasSize(2);
    }

    @Test
    @DisplayName("sin datos en el periodo, las salas ambientales se devuelven vacias")
    void historico_sinDatosInflux_devuelveSalasVacias() {
        when(influxLector.consultarSeries(anyString())).thenReturn(Map.of());
        when(monitoreoRepository.listarSensoresConUbicacion()).thenReturn(List.of(
                sensor("SENSOR-AMBIENTAL-005", 23L, "Escultura y retratos")));
        when(exhibicionRepository.findBySalaIdAndActiva(23L, true))
                .thenReturn(List.of(conLimites("18", "24", "40", "60", "200")));

        HistoricoResponse respuesta = servicio.historico("TEMPERATURA",
                OffsetDateTime.of(2026, 11, 4, 21, 0, 0, 0, ZoneOffset.UTC),
                OffsetDateTime.of(2026, 11, 5, 21, 0, 0, 0, ZoneOffset.UTC), null);

        assertThat(respuesta.series()).hasSize(1);
        HistoricoResponse.SerieSensor serie = respuesta.series().get(0);
        assertThat(serie.sensor()).isEqualTo("SENSOR-AMBIENTAL-005");
        assertThat(serie.salaNombre()).isEqualTo("Escultura y retratos");
        assertThat(serie.puntos()).isEmpty();
    }

    @Test
    @DisplayName("en LUZ solo hay limite maximo y la sala se conserva")
    void historico_luzSoloMaximo() {
        when(monitoreoRepository.listarSensoresConUbicacion())
                .thenReturn(List.of(sensor("SENSOR-AMBIENTAL-005", 23L, "Escultura y retratos")));
        when(exhibicionRepository.findBySalaIdAndActiva(23L, true))
                .thenReturn(List.of(conLimites("18", "24", "40", "60", "200")));

        HistoricoResponse respuesta = servicio.historico("LUZ",
                OffsetDateTime.of(2026, 11, 4, 9, 0, 0, 0, ZoneOffset.UTC),
                OffsetDateTime.of(2026, 11, 4, 12, 0, 0, 0, ZoneOffset.UTC), null);

        HistoricoResponse.SerieSensor serie = respuesta.series().get(0);
        assertThat(serie.limiteMin()).isNull();
        assertThat(serie.limiteMax()).isEqualTo(200.0);
    }

    @Test
    @DisplayName("un sensor desconocido no rompe: sala y limites quedan nulos")
    void historico_sensorSinMapeo_noRompe() {
        when(monitoreoRepository.listarSensoresConUbicacion()).thenReturn(List.of());

        HistoricoResponse respuesta = servicio.historico("HUMEDAD",
                OffsetDateTime.of(2026, 11, 4, 9, 0, 0, 0, ZoneOffset.UTC),
                OffsetDateTime.of(2026, 11, 4, 12, 0, 0, 0, ZoneOffset.UTC), null);

        HistoricoResponse.SerieSensor serie = respuesta.series().get(0);
        assertThat(serie.salaId()).isNull();
        assertThat(serie.salaNombre()).isNull();
        assertThat(serie.limiteMin()).isNull();
        assertThat(serie.limiteMax()).isNull();
    }

    @Test
    @DisplayName("el intervalo de agregacion depende del rango solicitado")
    void intervaloMinutos_porRango() {
        OffsetDateTime base = OffsetDateTime.of(2026, 11, 4, 0, 0, 0, 0, ZoneOffset.UTC);
        assertThat(MonitoreoService.intervaloMinutos(base, base.plusHours(1))).isEqualTo(1);
        assertThat(MonitoreoService.intervaloMinutos(base, base.plusHours(6))).isEqualTo(5);
        assertThat(MonitoreoService.intervaloMinutos(base, base.plusHours(24))).isEqualTo(15);
        assertThat(MonitoreoService.intervaloMinutos(base, base.plusHours(168))).isEqualTo(60);
    }

    @Test
    @DisplayName("la respuesta incluye el intervalo y la consulta usa aggregateWindow")
    void historico_agregaVentanasYDevuelveIntervalo() {
        when(monitoreoRepository.listarSensoresConUbicacion()).thenReturn(List.of());
        org.mockito.ArgumentCaptor<String> captor =
                org.mockito.ArgumentCaptor.forClass(String.class);

        HistoricoResponse respuesta = servicio.historico("TEMPERATURA",
                OffsetDateTime.of(2026, 11, 4, 9, 0, 0, 0, ZoneOffset.UTC),
                OffsetDateTime.of(2026, 11, 5, 9, 0, 0, 0, ZoneOffset.UTC), null);

        assertThat(respuesta.intervaloMinutos()).isEqualTo(15);
        org.mockito.Mockito.verify(influxLector).consultarSeries(captor.capture());
        String flux = captor.getValue();
        assertThat(flux).contains("aggregateWindow(every: 15m, fn: mean");
        assertThat(flux).contains("fn: min");
        assertThat(flux).contains("fn: max");
        assertThat(flux).contains("pivot(rowKey: [\"_time\", \"sensor\"]");
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
}
