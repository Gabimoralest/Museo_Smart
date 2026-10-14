package com.museosmart.service;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.entity.Exhibicion;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Consulta y activacion/desactivacion de exhibiciones.
 *
 * Alcance actual: las exhibiciones NO se crean ni editan desde la API
 * administrativa; solo se activan o desactivan. La creacion y edicion quedan
 * como posible mejora futura.
 */
@Service
@Transactional(readOnly = true)
public class ExhibicionService {

    private final ExhibicionRepository exhibicionRepository;
    private final SalaRepository salaRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public ExhibicionService(ExhibicionRepository exhibicionRepository, SalaRepository salaRepository) {
        this.exhibicionRepository = exhibicionRepository;
        this.salaRepository = salaRepository;
    }

    /**
     * Exhibiciones destinadas al visitante: solo las activas de la sala indicada.
     * Las desactivadas se conservan en la base de datos pero no se exponen.
     */
    public List<Exhibicion> listarPorSala(Long salaId) {
        if (!salaRepository.existsById(salaId)) {
            throw new RecursoNoEncontradoException("No existe la sala con id " + salaId);
        }
        return exhibicionRepository.findBySalaIdAndActiva(salaId, true);
    }

    /** Todas las exhibiciones activas (catalogo publico). */
    public List<Exhibicion> listarActivas() {
        return exhibicionRepository.findByActiva(true);
    }

    /**
     * Todas las exhibiciones, incluidas las desactivadas. Uso administrativo:
     * permite gestionar el estado de las exhibiciones existentes.
     */
    public List<Exhibicion> listarTodas() {
        return exhibicionRepository.findAll();
    }

    public Exhibicion obtenerPorId(Long id) {
        return exhibicionRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe la exhibición con id " + id));
    }

    /**
     * Recupera una exhibición solo si está activa. Se usa para el acceso público:
     * las exhibiciones inactivas no se exponen y se tratan como no encontradas.
     */
    public Exhibicion obtenerActivaPorId(Long id) {
        Exhibicion exhibicion = obtenerPorId(id);
        if (!exhibicion.isActiva()) {
            throw new RecursoNoEncontradoException("No existe la exhibición con id " + id);
        }
        return exhibicion;
    }

    /**
     * Activa o desactiva una exhibicion existente. El historial de cambios se
     * registra automaticamente en la base de datos. No elimina la exhibicion.
     */
    @Transactional
    public Exhibicion cambiarEstado(Long id, CambioEstadoRequest request, Long usuarioId) {
        Exhibicion exhibicion = obtenerPorId(id);

        boolean nuevoEstado = Boolean.TRUE.equals(request.activa());
        if (exhibicion.isActiva() == nuevoEstado) {
            return exhibicion;
        }

        // Variables de sesion que el trigger trg_exhibicion_historial lee para
        // registrar quién cambió el estado y el motivo.
        entityManager.createNativeQuery("select set_config('museo_smart.usuario_admin_id', :uid, true)")
                .setParameter("uid", usuarioId != null ? usuarioId.toString() : "")
                .getSingleResult();
        entityManager.createNativeQuery("select set_config('museo_smart.motivo_estado', :motivo, true)")
                .setParameter("motivo", request.motivo() != null ? request.motivo() : "")
                .getSingleResult();

        exhibicion.setActiva(nuevoEstado);
        return exhibicionRepository.save(exhibicion);
    }
}
