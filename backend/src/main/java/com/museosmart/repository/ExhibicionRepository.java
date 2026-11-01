package com.museosmart.repository;

import com.museosmart.entity.Exhibicion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExhibicionRepository extends JpaRepository<Exhibicion, Long> {

    /**
     * findById de JpaRepository se redefine para traer la sala y la ubicacion 3D
     * de forma anticipada (evita LazyInitializationException al mapear a DTO
     * fuera de la transaccion, ya que open-in-view esta deshabilitado).
     */
    @Override
    @EntityGraph(attributePaths = {"sala", "ubicacion3d", "actualizadoPor"})
    Optional<Exhibicion> findById(Long id);

    @EntityGraph(attributePaths = {"sala", "ubicacion3d"})
    List<Exhibicion> findByActiva(boolean activa);

    @EntityGraph(attributePaths = {"sala", "ubicacion3d"})
    List<Exhibicion> findBySalaIdAndActiva(Long salaId, boolean activa);

    /**
     * findAll de JpaRepository se redefine para traer la sala, la ubicacion 3D y
     * el ultimo editor de forma anticipada. Lo usa el listado administrativo
     * (incluye exhibiciones inactivas).
     */
    @Override
    @EntityGraph(attributePaths = {"sala", "ubicacion3d", "actualizadoPor"})
    List<Exhibicion> findAll();
}
