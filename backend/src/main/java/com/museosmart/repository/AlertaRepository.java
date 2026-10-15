package com.museosmart.repository;

import com.museosmart.entity.Alerta;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertaRepository extends JpaRepository<Alerta, Long> {

    // Las consultas de listado traen el sensor de forma anticipada: el mapeo a
    // AlertaResponse (que accede a sensor.codigo) ocurre fuera de la transaccion
    // (open-in-view=false), por lo que sin el EntityGraph se producia
    // LazyInitializationException.

    @EntityGraph(attributePaths = "sensor")
    List<Alerta> findByEstadoInOrderByIniciadaEnDesc(List<String> estados);

    @EntityGraph(attributePaths = "sensor")
    List<Alerta> findAllByOrderByIniciadaEnDesc();

    @EntityGraph(attributePaths = "sensor")
    Optional<Alerta> findById(Long id);

    Optional<Alerta> findBySensorIdAndCondicionClaveAndEstadoIn(
            Long sensorId, String condicionClave, List<String> estados);

    long countByEstado(String estado);
}
