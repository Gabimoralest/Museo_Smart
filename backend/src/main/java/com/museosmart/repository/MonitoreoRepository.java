package com.museosmart.repository;

import com.museosmart.entity.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Consultas de SOLO LECTURA para el módulo de Monitoreo IoT.
 *
 * <p>Fuentes: {@code sensor} (estado/ubicación del dispositivo) y
 * {@code medicion_pendiente} (outbox persistente; se conserva sin purga, por lo
 * que es la fuente de las lecturas recientes). Ninguna consulta modifica,
 * elimina ni cambia el estado de los registros del outbox.</p>
 *
 * <p>La "última lectura" por (sensor, métrica) se obtiene con
 * {@code DISTINCT ON}, ordenando por {@code medido_en} descendente y desempatando
 * por {@code id} descendente para que el resultado sea determinista.</p>
 */
public interface MonitoreoRepository extends JpaRepository<Sensor, Long> {

    /** Todos los sensores con su sala/exhibición, ordenados por categoría y código. */
    @Query("""
            SELECT s FROM Sensor s
            LEFT JOIN FETCH s.sala
            LEFT JOIN FETCH s.exhibicion
            ORDER BY s.categoria ASC, s.codigo ASC
            """)
    List<Sensor> listarSensoresConUbicacion();

    /**
     * Última lectura conocida por (sensor, métrica).
     */
    @Query(value = """
            SELECT DISTINCT ON (m.sensor_id, m.metrica)
                   m.sensor_id AS sensorId,
                   m.metrica   AS metrica,
                   m.valor     AS valor,
                   m.unidad    AS unidad,
                   m.medido_en AS medidoEn,
                   m.estado    AS estado
            FROM medicion_pendiente m
            WHERE m.sensor_id IS NOT NULL
            ORDER BY m.sensor_id, m.metrica, m.medido_en DESC, m.id DESC
            """, nativeQuery = true)
    List<UltimaLecturaView> ultimasLecturasPorSensor();

    /**
     * Promedio por métrica en una ventana temporal, contando solo lecturas
     * cuya métrica sea TEMPERATURA, HUMEDAD o LUZ (ambientales). La ventana
     * acota "válidas recientes" para evitar que lecturas antiguas distorsionen
     * el promedio.
     */
    @Query(value = """
            SELECT m.metrica    AS metrica,
                   AVG(m.valor) AS promedio,
                   MIN(m.unidad) AS unidad,
                   COUNT(*)     AS total
            FROM medicion_pendiente m
            WHERE m.metrica IN ('TEMPERATURA', 'HUMEDAD', 'LUZ')
              AND m.medido_en >= :desde
            GROUP BY m.metrica
            """, nativeQuery = true)
    List<PromedioMetricaView> promediosAmbientalesDesde(@Param("desde") OffsetDateTime desde);

    /**
     * Última presencia registrada por exhibición (la presencia es la métrica
     * booleana 1/0 del sensor de categoría PRESENCIA), tomando la medición más
     * reciente de cada sensor de presencia.
     */
    @Query(value = """
            SELECT DISTINCT ON (m.sensor_id)
                   m.sensor_id AS sensorId,
                   m.valor     AS valor,
                   m.medido_en AS medidoEn
            FROM medicion_pendiente m
            JOIN sensor s ON s.id = m.sensor_id
            WHERE s.categoria = 'PRESENCIA'
              AND m.metrica = 'PRESENCIA'
            ORDER BY m.sensor_id, m.medido_en DESC, m.id DESC
            """, nativeQuery = true)
    List<UltimaPresenciaView> ultimaPresenciaPorSensor();

    /**
     * Conteo de mediciones del outbox agrupadas por estado. Solo lectura; no
     * altera el drenado. Los estados posibles son PENDIENTE/ENVIANDO/ENVIADO/ERROR.
     */
    @Query(value = """
            SELECT m.estado AS estado, COUNT(*) AS total
            FROM medicion_pendiente m
            GROUP BY m.estado
            """, nativeQuery = true)
    List<ConteoEstadoView> contarPorEstado();

    /**
     * Agregados de reintentos y errores (solo lectura): total de mediciones con
     * reintentos, máximo de intentos y cuántas están en ERROR.
     */
    @Query(value = """
            SELECT
                COALESCE(SUM(m.intentos), 0)                              AS intentosTotales,
                COALESCE(MAX(m.intentos), 0)                              AS maxIntentos,
                COUNT(*) FILTER (WHERE m.estado = 'ERROR')               AS totalError,
                COUNT(*) FILTER (WHERE m.proximo_intento_en IS NOT NULL)  AS conReintentoProgramado
            FROM medicion_pendiente m
            """, nativeQuery = true)
    AgregadosOutboxView agregadosOutbox();
}
