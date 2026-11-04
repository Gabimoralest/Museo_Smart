package com.museosmart.iot;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.MedicionPendiente;
import com.museosmart.entity.MensajeIot;
import com.museosmart.entity.Sala;
import com.museosmart.entity.Sensor;
import com.museosmart.entity.Visita;
import com.museosmart.iot.service.MensajeIotService;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.MedicionPendienteRepository;
import com.museosmart.repository.MensajeIotRepository;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.SensorRepository;
import com.museosmart.repository.VisitaRepository;
import com.museosmart.service.PopularidadService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pruebas de INTEGRACION REAL del registro idempotente contra la base aislada
 * {@code museo_smart_test} (nunca la base de desarrollo).
 *
 * <p>Deshabilitan el consumidor MQTT para no conectar al broker durante las
 * pruebas. NO son @Transactional: el servicio usa transacciones REQUIRES_NEW,
 * que necesitan ver datos ya confirmados. Por eso cada prueba limpia
 * explicitamente los registros que crea (UUID/codigos aleatorios unicos).</p>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_DB_IT", matches = "true")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/museo_smart_test",
        "spring.datasource.username=postgres",
        "spring.datasource.password=${DB_PASSWORD:}",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "app.mail.habilitado=false",
        "app.iot.mqtt.enabled=false",
        "app.security.jwt.secret=clave-de-prueba-integracion-suficientemente-larga-1234567890"
})
class MensajeIotIntegracionTest {

    private static final String TOPICO_AMB = "museo/sensores/ambiental";
    private static final String TOPICO_PRE = "museo/sensores/presencia";

    @Autowired
    private MensajeIotService service;

    @Autowired
    private MensajeIotRepository mensajeIotRepository;

    @Autowired
    private MedicionPendienteRepository medicionPendienteRepository;

    @Autowired
    private SensorRepository sensorRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private ExhibicionRepository exhibicionRepository;

    @Autowired
    private PopularidadService popularidadService;

    @Autowired
    private VisitaRepository visitaRepository;

    private final List<UUID> mensajesCreados = new ArrayList<>();
    private final List<Long> sensoresCreados = new ArrayList<>();
    private final Set<UUID> visitasSesionesCreadas = new LinkedHashSet<>();

    @AfterEach
    void limpiar() {
        for (UUID id : mensajesCreados) {
            mensajeIotRepository.findByMensajeId(id).ifPresent(mensaje -> {
                for (MedicionPendiente m : medicionPendienteRepository.findByMensajeIotId(mensaje.getId())) {
                    medicionPendienteRepository.delete(m);
                }
                mensajeIotRepository.delete(mensaje);
            });
        }
        mensajesCreados.clear();
        visitasSesionesCreadas.forEach(visitaRepository::deleteBySesionAnonimaId);
        visitasSesionesCreadas.clear();
        sensoresCreados.forEach(sensorRepository::deleteById);
        sensoresCreados.clear();
    }

    private Sala sala() {
        return salaRepository.findAllByOrderByOrdenAsc().get(0);
    }

    private Exhibicion exhibicion() {
        List<Exhibicion> todas = exhibicionRepository.findAll();
        assertThat(todas).isNotEmpty();
        return todas.get(0);
    }

    private Sensor sensorAmbiental(Sala sala, String codigo) {
        Sensor s = new Sensor();
        s.setCodigo(codigo);
        s.setTipo("MULTI");
        s.setCategoria("AMBIENTAL");
        s.setSala(sala);
        Sensor guardado = sensorRepository.saveAndFlush(s);
        sensoresCreados.add(guardado.getId());
        return guardado;
    }

    private Sensor sensorPresencia(Exhibicion ex, String codigo) {
        Sensor s = new Sensor();
        s.setCodigo(codigo);
        s.setTipo("PRESENCIA");
        s.setCategoria("PRESENCIA");
        s.setExhibicion(ex);
        Sensor guardado = sensorRepository.saveAndFlush(s);
        sensoresCreados.add(guardado.getId());
        return guardado;
    }

    private UUID nuevoMensaje() {
        UUID id = UUID.randomUUID();
        mensajesCreados.add(id);
        return id;
    }

    private String payloadAmbiental(UUID id, String codigo, Long salaId) {
        String idJson = salaId == null ? "" : "\"salaId\":" + salaId + ",";
        return "{\"mensajeId\":\"" + id + "\",\"sensorCodigo\":\"" + codigo + "\","
                + idJson + "\"temperatura\":22.5,\"humedad\":50.0,"
                + "\"luminosidad\":300.0,\"timestamp\":\"2026-10-13T21:50:00Z\"}";
    }

    private String payloadPresencia(UUID id, String codigo, Long exId, boolean presencia) {
        String idJson = exId == null ? "" : "\"exhibicionId\":" + exId + ",";
        return "{\"mensajeId\":\"" + id + "\",\"sensorCodigo\":\"" + codigo + "\","
                + idJson + "\"presencia\":" + presencia + ","
                + "\"timestamp\":\"2026-10-13T21:50:00Z\"}";
    }

    @Test
    @DisplayName("mensaje ambiental valido se registra, procesa y genera 3 mediciones")
    void ambientalValido_generaMediciones() {
        Sala sala = sala();
        String codigo = "IT-AMB-" + UUID.randomUUID();
        sensorAmbiental(sala, codigo);
        UUID id = nuevoMensaje();

        Long registroId = service.registrarRecepcion(id, TOPICO_AMB,
                payloadAmbiental(id, codigo, sala.getId()), codigo);
        assertThat(registroId).isNotNull();
        service.procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(mensaje.getEstadoProcesamiento()).isEqualTo("PROCESADO");
        assertThat(mensaje.getProcesadoEn()).isNotNull();

        List<MedicionPendiente> mediciones = medicionPendienteRepository.findByMensajeIotId(mensaje.getId());
        assertThat(mediciones).extracting(MedicionPendiente::getMetrica)
                .containsExactlyInAnyOrder("TEMPERATURA", "HUMEDAD", "LUZ");
    }

    @Test
    @DisplayName("mensaje de presencia valido genera 1 medicion PRESENCIA")
    void presenciaValida_generaMedicion() {
        Exhibicion ex = exhibicion();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(ex, codigo);
        UUID id = nuevoMensaje();
        recordarSesion(id);

        service.registrarRecepcion(id, TOPICO_PRE, payloadPresencia(id, codigo, ex.getId(), true), codigo);
        service.procesarContenido(id, TOPICO_PRE, TOPICO_AMB, TOPICO_PRE);

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        List<MedicionPendiente> mediciones = medicionPendienteRepository.findByMensajeIotId(mensaje.getId());
        assertThat(mediciones).hasSize(1);
        assertThat(mediciones.get(0).getMetrica()).isEqualTo("PRESENCIA");
    }

    @Test
    @DisplayName("mensaje ambiental sin salaId se procesa usando la sala del sensor")
    void ambientalSinSalaId_seProcesa() {
        Sala sala = sala();
        String codigo = "IT-AMB-" + UUID.randomUUID();
        sensorAmbiental(sala, codigo);
        UUID id = nuevoMensaje();

        service.registrarRecepcion(id, TOPICO_AMB, payloadAmbiental(id, codigo, null), codigo);
        service.procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(mensaje.getEstadoProcesamiento()).isEqualTo("PROCESADO");
        assertThat(medicionPendienteRepository.findByMensajeIotId(mensaje.getId())).hasSize(3);
    }

    @Test
    @DisplayName("mensaje de presencia sin exhibicionId se procesa usando la del sensor")
    void presenciaSinExhibicionId_seProcesa() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);
        UUID id = nuevoMensaje();
        recordarSesion(id);

        service.registrarRecepcion(id, TOPICO_PRE, payloadPresencia(id, codigo, null, true), codigo);
        service.procesarContenido(id, TOPICO_PRE, TOPICO_AMB, TOPICO_PRE);

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(mensaje.getEstadoProcesamiento()).isEqualTo("PROCESADO");
        assertThat(medicionPendienteRepository.findByMensajeIotId(mensaje.getId())).hasSize(1);
    }
    // ------------------------------------------------------------
    // Visitas simuladas por IoT -> popularidad
    // ------------------------------------------------------------

    /** Identidad de sesion que la ingestion deriva de la transicion (mensajeId). */
    private UUID sesionDeMensaje(UUID mensajeId) {
        return UUID.nameUUIDFromBytes(
                ("sensor-episodio:" + mensajeId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private void recordarSesion(UUID mensajeId) {
        visitasSesionesCreadas.add(sesionDeMensaje(mensajeId));
    }

    /** Procesa un mensaje de presencia completo y registra la sesion para limpieza. */
    private void procesarPresencia(String codigo, Exhibicion ex, boolean presencia) {
        UUID id = nuevoMensaje();
        // La sesion se registra ANTES de procesar: la identidad es determinista a
        // partir del mensajeId, de modo que aunque el procesamiento falle a mitad,
        // la limpieza posterior sigue pudiendo borrar la visita si llego a crearse.
        recordarSesion(id);
        service.registrarRecepcion(id, TOPICO_PRE, payloadPresencia(id, codigo, ex.getId(), presencia), codigo);
        service.procesarContenido(id, TOPICO_PRE, TOPICO_AMB, TOPICO_PRE);
    }

    private long visitasValidasDe(Long exhibicionId) {
        return visitaRepository.countByExhibicionIdAndValidaTrue(exhibicionId);
    }

    private long totalSala(Long salaId) {
        return visitaRepository.findRankingCompleto().stream()
                .filter(r -> java.util.Objects.equals(r.getSalaId(), salaId))
                .mapToLong(RankingExhibicionView::getTotalVisitasValidas)
                .sum();
    }

    @Test
    @DisplayName("presencia simulada valida incrementa el ranking de su exhibicion")
    void presencia_incrementaRankingExhibicion() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long antes = visitasValidasDe(fresco.getId());
        procesarPresencia(codigo, fresco, true);

        assertThat(visitasValidasDe(fresco.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("una visita simulada eleva el total agregado de su sala")
    void presencia_incrementaTotalSala() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        Long salaId = fresco.getSala().getId();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long antes = totalSala(salaId);
        procesarPresencia(codigo, fresco, true);

        assertThat(totalSala(salaId)).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("las lecturas periodicas con presencia activa no vuelven a contar")
    void presenciaRepetida_noRecuenta() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long antes = visitasValidasDe(fresco.getId());
        procesarPresencia(codigo, fresco, true);
        procesarPresencia(codigo, fresco, true);
        procesarPresencia(codigo, fresco, true);

        assertThat(visitasValidasDe(fresco.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("la transicion true -> false no registra visita")
    void bajada_noRegistra() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long antes = visitasValidasDe(fresco.getId());
        procesarPresencia(codigo, fresco, true);
        long trasPrimerEpisodio = visitasValidasDe(fresco.getId());
        procesarPresencia(codigo, fresco, false);

        assertThat(trasPrimerEpisodio).isEqualTo(antes + 1);
        assertThat(visitasValidasDe(fresco.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("un nuevo episodio false -> true cuenta otra vez y eleva la sala")
    void reingreso_cuentaSegundaVisita() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        Long salaId = fresco.getSala().getId();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long visitasAntes = visitasValidasDe(fresco.getId());
        long salaAntes = totalSala(salaId);

        procesarPresencia(codigo, fresco, true);   // episodio 1
        procesarPresencia(codigo, fresco, false);  // ausencia
        procesarPresencia(codigo, fresco, true);   // episodio 2 (mismo minuto)

        assertThat(visitasValidasDe(fresco.getId())).isEqualTo(visitasAntes + 2);
        assertThat(totalSala(salaId)).isEqualTo(salaAntes + 2);
    }

    @Test
    @DisplayName("un mensaje MQTT duplicado (mismo mensajeId) no cuenta dos veces")
    void mensajeDuplicado_noCuentaDosVeces() {
        Exhibicion ex = exhibicion();
        Exhibicion fresco = exhibicionRepository.findById(ex.getId()).orElseThrow();
        String codigo = "IT-PRE-" + UUID.randomUUID();
        sensorPresencia(fresco, codigo);

        long antes = visitasValidasDe(fresco.getId());
        UUID id = nuevoMensaje();
        recordarSesion(id);
        String payload = payloadPresencia(id, codigo, fresco.getId(), true);

        // Flujo real: una primera recepcion (nueva) se procesa; el mismo mensaje
        // vuelve a llegar (duplicado), la BD lo rechaza por uq_mensaje_iot_mensaje_id
        // y el procesador NO vuelve a invocar procesarContenido.
        Long primero = service.registrarRecepcion(id, TOPICO_PRE, payload, codigo);
        Long segundo = service.registrarRecepcion(id, TOPICO_PRE, payload, codigo);
        service.procesarContenido(id, TOPICO_PRE, TOPICO_AMB, TOPICO_PRE);

        assertThat(primero).isNotNull();
        assertThat(segundo).isNull();
        assertThat(visitasValidasDe(fresco.getId())).isEqualTo(antes + 1);
    }

    @Test
    @DisplayName("UUID duplicado no inserta segunda fila (idempotencia a nivel de BD)")
    void duplicado_noInserta() {
        UUID id = nuevoMensaje();
        String payload = payloadPresencia(id, "X", 1L, false);

        Long primero = service.registrarRecepcion(id, TOPICO_PRE, payload, "X");
        Long segundo = service.registrarRecepcion(id, TOPICO_PRE, payload, "X");

        assertThat(primero).isNotNull();
        assertThat(segundo).isNull();
    }

    @Test
    @DisplayName("sensor desconocido marca ERROR y no crea sensor")
    void sensorDesconocido_marcaError() {
        UUID id = nuevoMensaje();
        String codigo = "NO-EXISTE-" + UUID.randomUUID();
        long sensoresAntes = sensorRepository.count();

        service.registrarRecepcion(id, TOPICO_AMB, payloadAmbiental(id, codigo, 1L), codigo);
        try {
            service.procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);
        } catch (MensajeInvalidoException ex) {
            service.marcarError(id, ex.getMessage());
        }

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(mensaje.getEstadoProcesamiento()).isEqualTo("ERROR");
        assertThat(mensaje.getError()).contains("desconocido");
        assertThat(sensorRepository.count()).isEqualTo(sensoresAntes);
    }

    @Test
    @DisplayName("sensor ambiental con sala incorrecta marca ERROR")
    void salaIncorrecta_marcaError() {
        Sala sala = sala();
        String codigo = "IT-AMB-" + UUID.randomUUID();
        sensorAmbiental(sala, codigo);
        UUID id = nuevoMensaje();
        long salaIncorrecta = sala.getId() + 9999;

        service.registrarRecepcion(id, TOPICO_AMB, payloadAmbiental(id, codigo, salaIncorrecta), codigo);
        try {
            service.procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);
        } catch (MensajeInvalidoException ex) {
            service.marcarError(id, ex.getMessage());
        }

        MensajeIot mensaje = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(mensaje.getEstadoProcesamiento()).isEqualTo("ERROR");
        assertThat(mensaje.getError()).contains("no corresponde a la sala");
    }

    @Test
    @DisplayName("procesamiento fallido no marca PROCESADO (el estado permanece RECIBIDO)")
    void fallo_noMarcaProcesado() {
        UUID id = nuevoMensaje();
        String codigo = "NO-EXISTE-" + UUID.randomUUID();

        service.registrarRecepcion(id, TOPICO_AMB, payloadAmbiental(id, codigo, 1L), codigo);

        MensajeIot antes = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(antes.getEstadoProcesamiento()).isEqualTo("RECIBIDO");

        try {
            service.procesarContenido(id, TOPICO_AMB, TOPICO_AMB, TOPICO_PRE);
        } catch (MensajeInvalidoException ignored) {
            // La transaccion de procesamiento se revierte; el estado sigue RECIBIDO.
        }

        MensajeIot despues = mensajeIotRepository.findByMensajeId(id).orElseThrow();
        assertThat(despues.getEstadoProcesamiento()).isEqualTo("RECIBIDO");
        assertThat(despues.getProcesadoEn()).isNull();
    }
}
