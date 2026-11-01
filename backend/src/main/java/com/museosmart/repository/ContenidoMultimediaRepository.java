package com.museosmart.repository;

import com.museosmart.entity.ContenidoMultimedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContenidoMultimediaRepository extends JpaRepository<ContenidoMultimedia, Long> {

    List<ContenidoMultimedia> findByExhibicionId(Long exhibicionId);

    Optional<ContenidoMultimedia> findByExhibicionIdAndTipo(Long exhibicionId, String tipo);

    List<ContenidoMultimedia> findByExhibicionIdIn(java.util.Collection<Long> exhibicionIds);

    boolean existsByExhibicionIdAndTipo(Long exhibicionId, String tipo);
}
