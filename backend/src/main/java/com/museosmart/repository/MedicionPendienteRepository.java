package com.museosmart.repository;

import com.museosmart.entity.MedicionPendiente;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface MedicionPendienteRepository extends JpaRepository<MedicionPendiente, Long> {

    List<MedicionPendiente> findByMensajeIotId(Long mensajeIotId);

    /**
     * Mediciones listas para drenar hacia InfluxDB: estado PENDIENTE y sin
     * proximo intento pendiente (o ya vencido). Incluye la metrica y el sensor
     * para no incurrir en N+1.
     */
    @Query("""
            SELECT m FROM MedicionPendiente m
            LEFT JOIN FETCH m.sensor
            LEFT JOIN FETCH m.mensajeIot
            WHERE m.estado = 'PENDIENTE'
              AND (m.proximoIntentoEn IS NULL OR m.proximoIntentoEn <= :ahora)
            ORDER BY m.id ASC
            """)
    List<MedicionPendiente> buscarPendientes(@Param("ahora") OffsetDateTime ahora, Pageable pageable);
}
