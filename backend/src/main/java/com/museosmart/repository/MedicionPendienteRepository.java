package com.museosmart.repository;

import com.museosmart.entity.MedicionPendiente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MedicionPendienteRepository extends JpaRepository<MedicionPendiente, Long> {

    List<MedicionPendiente> findByMensajeIotId(Long mensajeIotId);
}
