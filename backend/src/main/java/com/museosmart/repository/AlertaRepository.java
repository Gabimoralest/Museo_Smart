package com.museosmart.repository;

import com.museosmart.entity.Alerta;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertaRepository extends JpaRepository<Alerta, Long> {

    List<Alerta> findByEstadoInOrderByIniciadaEnDesc(List<String> estados);

    List<Alerta> findAllByOrderByIniciadaEnDesc();

    Optional<Alerta> findBySensorIdAndCondicionClaveAndEstadoIn(
            Long sensorId, String condicionClave, List<String> estados);

    long countByEstado(String estado);
}
