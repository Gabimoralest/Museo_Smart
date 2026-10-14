package com.museosmart.service;

import com.museosmart.entity.Sala;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.repository.SalaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalaServiceTest {

    @Mock
    private SalaRepository salaRepository;

    @InjectMocks
    private SalaService salaService;

    @Test
    @DisplayName("listarTodas devuelve la lista proporcionada por el repositorio")
    void listarTodas_devuelveListaDelRepositorio() {
        List<Sala> esperadas = List.of(sala("Pintura histórica", (short) 1),
                sala("Cerámica y artesanía", (short) 2));
        when(salaRepository.findAllByOrderByOrdenAsc()).thenReturn(esperadas);

        List<Sala> resultado = salaService.listarTodas();

        assertThat(resultado).isEqualTo(esperadas);
    }

    @Test
    @DisplayName("listarTodas utiliza el método findAllByOrderByOrdenAsc del repositorio")
    void listarTodas_utilizaFindAllByOrderByOrdenAsc() {
        when(salaRepository.findAllByOrderByOrdenAsc()).thenReturn(List.of());

        salaService.listarTodas();

        verify(salaRepository).findAllByOrderByOrdenAsc();
        verifyNoMoreInteractions(salaRepository);
    }

    @Test
    @DisplayName("obtenerPorId devuelve la sala cuando existe")
    void obtenerPorId_devuelveSalaCuandoExiste() {
        Sala esperada = sala("Patrimonio cultural", (short) 3);
        when(salaRepository.findById(5L)).thenReturn(Optional.of(esperada));

        Sala resultado = salaService.obtenerPorId(5L);

        assertThat(resultado).isSameAs(esperada);
        verify(salaRepository).findById(5L);
    }

    @Test
    @DisplayName("obtenerPorId lanza RecursoNoEncontradoException cuando no existe")
    void obtenerPorId_lanzaExcepcionCuandoNoExiste() {
        when(salaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> salaService.obtenerPorId(99L))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("la excepción de sala inexistente identifica el ID solicitado")
    void obtenerPorId_excepcionContieneElId() {
        when(salaRepository.findById(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> salaService.obtenerPorId(42L))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessageContaining("42");
    }

    private Sala sala(String nombre, Short orden) {
        Sala s = new Sala();
        s.setNombre(nombre);
        s.setOrden(orden);
        return s;
    }
}
