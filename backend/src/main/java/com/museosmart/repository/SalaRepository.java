package com.museosmart.repository;

import com.museosmart.entity.Sala;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SalaRepository extends JpaRepository<Sala, Long> {

    Optional<Sala> findByNombre(String nombre);

    List<Sala> findByEstado(String estado);

    List<Sala> findAllByOrderByOrdenAsc();
}
