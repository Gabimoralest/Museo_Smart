package com.museosmart.repository;

import com.museosmart.entity.Sensor;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SensorRepository extends JpaRepository<Sensor, Long> {

    Optional<Sensor> findByCodigo(String codigo);

    List<Sensor> findByCategoria(String categoria);

    List<Sensor> findBySalaId(Long salaId);

    List<Sensor> findByExhibicionId(Long exhibicionId);

    /**
     * Recupera un sensor por codigo bloqueando su fila (PESSIMISTIC_WRITE).
     *
     * <p>Se usa en la ingestion de presencia para serializar la lectura y
     * actualizacion de {@code presencia_actual}: dos mensajes concurrentes del
     * mismo sensor no pueden detectar a la vez un flanco de subida y
     * contabilizar dos visitas para un unico episodio.</p>
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Sensor s WHERE s.codigo = :codigo")
    Optional<Sensor> findByCodigoConBloqueo(@Param("codigo") String codigo);
}
