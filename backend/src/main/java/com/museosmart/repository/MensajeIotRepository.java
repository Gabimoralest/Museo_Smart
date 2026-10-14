package com.museosmart.repository;

import com.museosmart.entity.MensajeIot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MensajeIotRepository extends JpaRepository<MensajeIot, Long> {

    Optional<MensajeIot> findByMensajeId(UUID mensajeId);

    boolean existsByMensajeId(UUID mensajeId);

    /**
     * Inserta el mensaje crudo de forma idempotente.
     *
     * <p>Se apoya en la restriccion UNIQUE {@code uq_mensaje_iot_mensaje_id}:
     * si el UUID ya existe, PostgreSQL no inserta nada ({@code ON CONFLICT DO
     * NOTHING}). El valor devuelto es el numero de filas insertadas (1 la
     * primera vez, 0 si es duplicado), lo que permite decidir sin una consulta
     * previa y sin condiciones de carrera.</p>
     *
     * @return 1 si se inserto, 0 si ya existia (duplicado).
     */
    @Modifying
    @Query(value = """
            INSERT INTO mensaje_iot (mensaje_id, topico, payload, sensor_codigo, estado_procesamiento)
            VALUES (:mensajeId, :topico, CAST(:payload AS jsonb), :sensorCodigo, 'RECIBIDO')
            ON CONFLICT (mensaje_id) DO NOTHING
            """, nativeQuery = true)
    int insertarSiNoExiste(@Param("mensajeId") UUID mensajeId,
                           @Param("topico") String topico,
                           @Param("payload") String payload,
                           @Param("sensorCodigo") String sensorCodigo);
}
