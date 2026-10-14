package com.museosmart.repository;

import com.museosmart.entity.Exhibicion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExhibicionRepository extends JpaRepository<Exhibicion, Long> {

    @EntityGraph(attributePaths = "sala")
    Optional<Exhibicion> findById(Long id);

    @EntityGraph(attributePaths = "sala")
    List<Exhibicion> findByActiva(boolean activa);

    @EntityGraph(attributePaths = "sala")
    List<Exhibicion> findBySalaIdAndActiva(Long salaId, boolean activa);
}
