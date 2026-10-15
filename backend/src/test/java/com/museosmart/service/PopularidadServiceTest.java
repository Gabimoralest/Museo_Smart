package com.museosmart.service;

import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.Visita;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.exception.ReglaNegocioException;
import com.museosmart.repository.RankingExhibicionView;
import com.museosmart.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PopularidadServiceTest {

    @Mock
    private VisitaRepository visitaRepository;

    @Mock
    private ExhibicionService exhibicionService;

    private PopularidadService popularidadService;

    @BeforeEach
    void setUp() {
        popularidadService = new PopularidadService(visitaRepository, exhibicionService);
    }

    private Exhibicion exhibicion(Long id) {
        Exhibicion e = new Exhibicion();
        try {
            var f = Exhibicion.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(e, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
        e.setCodigo("pintura-historica-01");
        e.setTitulo("[PROVISIONAL] pintura-historica-01");
        e.setActiva(true);
        return e;
    }

    // ---------- Registro valido ----------

    @Test
    @DisplayName("registra una visita valida y la persiste como valida=true")
    void registrarVisita_valida() {
        Exhibicion e = exhibicion(1L);
        UUID sesion = UUID.randomUUID();
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(e);
        when(visitaRepository.registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(1);

        boolean contabilizada = popularidadService.registrarVisita(1L, sesion.toString(), Visita.FUENTE_CURSOR);

        assertThat(contabilizada).isTrue();
        ArgumentCaptor<Boolean> validaCaptor = ArgumentCaptor.forClass(Boolean.class);
        verify(visitaRepository).registrarConDeduplicacion(
                eq(1L), eq(sesion), eq(Visita.FUENTE_CURSOR), validaCaptor.capture(), any(OffsetDateTime.class));
        assertThat(validaCaptor.getValue()).isTrue();
    }

    @Test
    @DisplayName("la fuente se normaliza a mayusculas antes de persistir")
    void registrarVisita_normalizaFuente() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));
        when(visitaRepository.registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(1);

        popularidadService.registrarVisita(1L, null, "cursor");

        verify(visitaRepository).registrarConDeduplicacion(
                eq(1L), any(UUID.class), eq(Visita.FUENTE_CURSOR), eq(true), any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("si no llega sesion anonima, el backend genera un UUID")
    void registrarVisita_generaSesionSiNoLlega() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));
        when(visitaRepository.registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(1);

        popularidadService.registrarVisita(1L, null, Visita.FUENTE_QR);

        ArgumentCaptor<UUID> sesionCaptor = ArgumentCaptor.forClass(UUID.class);
        verify(visitaRepository).registrarConDeduplicacion(
                eq(1L), sesionCaptor.capture(), eq(Visita.FUENTE_QR), eq(true), any(OffsetDateTime.class));
        assertThat(sesionCaptor.getValue()).isNotNull();
    }

    @Test
    @DisplayName("un duplicado en la misma ventana devuelve false sin lanzar error")
    void registrarVisita_duplicadaDevuelveFalse() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));
        when(visitaRepository.registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(0);

        boolean contabilizada = popularidadService.registrarVisita(
                1L, UUID.randomUUID().toString(), Visita.FUENTE_CURSOR);

        assertThat(contabilizada).isFalse();
    }

    // ---------- Validacion de exhibicion ----------

    @Test
    @DisplayName("exhibicion inexistente o inactiva propaga RecursoNoEncontradoException y no persiste")
    void registrarVisita_exhibicionNoActiva() {
        when(exhibicionService.obtenerActivaPorId(99L))
                .thenThrow(new RecursoNoEncontradoException("No existe la exhibición con id 99"));

        assertThatThrownBy(() -> popularidadService.registrarVisita(99L, null, Visita.FUENTE_CURSOR))
                .isInstanceOf(RecursoNoEncontradoException.class);

        verify(visitaRepository, never()).registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any());
    }

    // ---------- Validacion de fuente ----------

    @Test
    @DisplayName("fuente nula es rechazada")
    void registrarVisita_fuenteNula() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));

        assertThatThrownBy(() -> popularidadService.registrarVisita(1L, null, null))
                .isInstanceOf(ReglaNegocioException.class);

        verify(visitaRepository, never()).registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any());
    }

    @Test
    @DisplayName("fuente no permitida es rechazada")
    void registrarVisita_fuenteInvalida() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));

        assertThatThrownBy(() -> popularidadService.registrarVisita(1L, null, "HACK"))
                .isInstanceOf(ReglaNegocioException.class);

        verify(visitaRepository, never()).registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any());
    }

    // ---------- Validacion de sesion anonima ----------

    @Test
    @DisplayName("sesion anonima con formato invalido es rechazada")
    void registrarVisita_sesionInvalida() {
        when(exhibicionService.obtenerActivaPorId(1L)).thenReturn(exhibicion(1L));

        assertThatThrownBy(() -> popularidadService.registrarVisita(1L, "no-es-un-uuid", Visita.FUENTE_CURSOR))
                .isInstanceOf(ReglaNegocioException.class);

        verify(visitaRepository, never()).registrarConDeduplicacion(anyLong(), any(), anyString(), anyBoolean(), any());
    }

    // ---------- Ranking ----------

    @Test
    @DisplayName("ranking limitado con limite <= 0 es rechazado")
    void rankingLimitado_limiteInvalido() {
        assertThatThrownBy(() -> popularidadService.rankingLimitado(0))
                .isInstanceOf(ReglaNegocioException.class);
        verify(visitaRepository, never()).findRankingLimitado(anyInt());
    }

    @Test
    @DisplayName("ranking limitado valido delega en el repositorio")
    void rankingLimitado_delega() {
        List<RankingExhibicionView> esperado = List.of();
        when(visitaRepository.findRankingLimitado(5)).thenReturn(esperado);

        assertThat(popularidadService.rankingLimitado(5)).isEqualTo(esperado);
        verify(visitaRepository).findRankingLimitado(5);
    }

    @Test
    @DisplayName("ranking completo delega en el repositorio")
    void rankingCompleto_delega() {
        when(visitaRepository.findRankingCompleto()).thenReturn(List.of());
        popularidadService.rankingCompleto();
        verify(visitaRepository).findRankingCompleto();
    }
}
