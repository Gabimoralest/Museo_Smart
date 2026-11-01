package com.museosmart.repository;

import com.museosmart.entity.ExhibicionEstadoHistorial;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExhibicionEstadoHistorialRepository
        extends JpaRepository<ExhibicionEstadoHistorial, Long> {

    List<ExhibicionEstadoHistorial> findByExhibicionIdOrderByCambiadoEnDesc(Long exhibicionId);
}
