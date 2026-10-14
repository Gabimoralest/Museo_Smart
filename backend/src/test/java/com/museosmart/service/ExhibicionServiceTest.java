package com.museosmart.service;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.entity.Exhibicion;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExhibicionServiceTest {

    @Mock
    private ExhibicionRepository exhibicionRepository;

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private ExhibicionService exhibicionService;

    @BeforeEach
    void setUp() {
        exhibicionService = new ExhibicionService(exhibicionRepository, salaRepository);
        setEntityManager(exhibicionService, entityManager);
        lenient().when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        lenient().when(query.setParameter(anyString(), any())).thenReturn(query);
    }

    // ---------- Consultas publicas ----------

    @Test
    @DisplayName("listarPorSala devuelve solo exhibiciones activas de una sala existente")
    void listarPorSala_devuelveActivasDeSalaExistente() {
        List<Exhibicion> activas = List.of(exhibicion("pintura-historica-01"), exhibicion("pintura-historica-02"));
        when(salaRepository.existsById(1L)).thenReturn(true);
        when(exhibicionRepository.findBySalaIdAndActiva(1L, true)).thenReturn(activas);

        List<Exhibicion> resultado = exhibicionService.listarPorSala(1L);

        assertThat(resultado).isEqualTo(activas);
        verify(exhibicionRepository).findBySalaIdAndActiva(1L, true);
    }

    @Test
    @DisplayName("listarPorSala comprueba primero si la sala existe")
    void listarPorSala_compruebaSalaAntesDeConsultarExhibiciones() {
        when(salaRepository.existsById(1L)).thenReturn(true);
        when(exhibicionRepository.findBySalaIdAndActiva(1L, true)).thenReturn(List.of());

        exhibicionService.listarPorSala(1L);

        verify(salaRepository).existsById(1L);
        verify(exhibicionRepository).findBySalaIdAndActiva(1L, true);
    }

    @Test
    @DisplayName("listarPorSala lanza excepción y no consulta exhibiciones si la sala no existe")
    void listarPorSala_lanzaExcepcionYNoConsultaExhibiciones() {
        when(salaRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> exhibicionService.listarPorSala(99L))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessageContaining("99");

        verify(exhibicionRepository, never()).findBySalaIdAndActiva(anyLong(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    @DisplayName("listarPorSala no realiza consultas innecesarias al repositorio de exhibiciones")
    void listarPorSala_soloInteractuaConLosRepositoriosEsperados() {
        when(salaRepository.existsById(2L)).thenReturn(true);
        when(exhibicionRepository.findBySalaIdAndActiva(2L, true)).thenReturn(List.of());

        exhibicionService.listarPorSala(2L);

        verify(salaRepository).existsById(2L);
        verify(exhibicionRepository).findBySalaIdAndActiva(2L, true);
        verifyNoMoreInteractions(salaRepository, exhibicionRepository);
    }

    @Test
    @DisplayName("listarActivas devuelve el resultado del repositorio para activa=true")
    void listarActivas_devuelveResultadoDelRepositorio() {
        List<Exhibicion> activas = List.of(exhibicion("historia-natural-01"));
        when(exhibicionRepository.findByActiva(true)).thenReturn(activas);

        List<Exhibicion> resultado = exhibicionService.listarActivas();

        assertThat(resultado).isEqualTo(activas);
        verify(exhibicionRepository).findByActiva(true);
    }

    // ---------- Consulta administrativa ----------

    @Test
    @DisplayName("listarTodas devuelve todas las exhibiciones, incluidas las desactivadas")
    void listarTodas_devuelveTodas() {
        Exhibicion activa = exhibicion("pintura-historica-01");
        activa.setActiva(true);
        Exhibicion inactiva = exhibicion("pintura-historica-02");
        inactiva.setActiva(false);
        when(exhibicionRepository.findAll()).thenReturn(List.of(activa, inactiva));

        List<Exhibicion> resultado = exhibicionService.listarTodas();

        assertThat(resultado).hasSize(2);
        assertThat(resultado).extracting(Exhibicion::isActiva).containsExactly(true, false);
        verify(exhibicionRepository).findAll();
    }

    @Test
    @DisplayName("obtenerPorId devuelve la exhibición cuando existe")
    void obtenerPorId_devuelveExhibicionCuandoExiste() {
        Exhibicion esperada = exhibicion("ceramica-artesania-01");
        when(exhibicionRepository.findById(7L)).thenReturn(Optional.of(esperada));

        Exhibicion resultado = exhibicionService.obtenerPorId(7L);

        assertThat(resultado).isSameAs(esperada);
        verify(exhibicionRepository).findById(7L);
    }

    @Test
    @DisplayName("obtenerPorId lanza RecursoNoEncontradoException cuando no existe")
    void obtenerPorId_lanzaExcepcionCuandoNoExiste() {
        when(exhibicionRepository.findById(123L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exhibicionService.obtenerPorId(123L))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessageContaining("123");
    }

    @Test
    @DisplayName("obtenerActivaPorId devuelve la exhibición cuando existe y está activa")
    void obtenerActivaPorId_devuelveCuandoActiva() {
        Exhibicion activa = exhibicion("pintura-historica-01");
        activa.setActiva(true);
        when(exhibicionRepository.findById(7L)).thenReturn(Optional.of(activa));

        Exhibicion resultado = exhibicionService.obtenerActivaPorId(7L);

        assertThat(resultado).isSameAs(activa);
    }

    @Test
    @DisplayName("obtenerActivaPorId trata una exhibición inactiva como no encontrada")
    void obtenerActivaPorId_inactivaLanzaExcepcion() {
        Exhibicion inactiva = exhibicion("pintura-historica-02");
        inactiva.setActiva(false);
        when(exhibicionRepository.findById(8L)).thenReturn(Optional.of(inactiva));

        assertThatThrownBy(() -> exhibicionService.obtenerActivaPorId(8L))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessageContaining("8");
    }

    // ---------- Cambiar estado ----------

    @Test
    @DisplayName("cambiarEstado a inactiva actualiza la exhibición y registra historial")
    void cambiarEstado_desactivar() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setActiva(true);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));
        when(exhibicionRepository.save(any(Exhibicion.class))).thenAnswer(inv -> inv.getArgument(0));

        Exhibicion resultado = exhibicionService.cambiarEstado(5L, new CambioEstadoRequest(false, "Mantenimiento"), 9L);

        assertThat(resultado.isActiva()).isFalse();
        verify(entityManager, org.mockito.Mockito.times(2)).createNativeQuery(anyString());
    }

    @Test
    @DisplayName("cambiarEstado sin cambio real no modifica la exhibición")
    void cambiarEstado_sinCambioNoHaceNada() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setActiva(true);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));

        Exhibicion resultado = exhibicionService.cambiarEstado(5L, new CambioEstadoRequest(true, null), 9L);

        assertThat(resultado.isActiva()).isTrue();
        verify(exhibicionRepository, never()).save(any(Exhibicion.class));
    }

    private Exhibicion exhibicion(String codigo) {
        Exhibicion e = new Exhibicion();
        e.setCodigo(codigo);
        e.setTitulo("[PROVISIONAL] " + codigo);
        return e;
    }

    private void setEntityManager(Object target, EntityManager em) {
        try {
            java.lang.reflect.Field field = ExhibicionService.class.getDeclaredField("entityManager");
            field.setAccessible(true);
            field.set(target, em);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
