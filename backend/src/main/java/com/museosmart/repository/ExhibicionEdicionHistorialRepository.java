package com.museosmart.repository;

import com.museosmart.entity.ExhibicionEdicionHistorial;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExhibicionEdicionHistorialRepository
        extends JpaRepository<ExhibicionEdicionHistorial, Long> {

    List<ExhibicionEdicionHistorial> findByExhibicionIdOrderByEditadoEnDesc(Long exhibicionId);
}
