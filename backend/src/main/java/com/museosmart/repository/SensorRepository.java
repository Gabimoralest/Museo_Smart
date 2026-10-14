package com.museosmart.repository;

import com.museosmart.entity.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SensorRepository extends JpaRepository<Sensor, Long> {

    Optional<Sensor> findByCodigo(String codigo);

    List<Sensor> findByCategoria(String categoria);

    List<Sensor> findBySalaId(Long salaId);

    List<Sensor> findByExhibicionId(Long exhibicionId);
}
