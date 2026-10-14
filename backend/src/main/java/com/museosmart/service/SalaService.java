package com.museosmart.service;

import com.museosmart.entity.Sala;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.repository.SalaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SalaService {

    private final SalaRepository salaRepository;

    public SalaService(SalaRepository salaRepository) {
        this.salaRepository = salaRepository;
    }

    public List<Sala> listarTodas() {
        return salaRepository.findAllByOrderByOrdenAsc();
    }

    public Sala obtenerPorId(Long id) {
        return salaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe la sala con id " + id));
    }
}
