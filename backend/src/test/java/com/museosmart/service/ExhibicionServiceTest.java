package com.museosmart.service;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.dto.EditarExhibicionRequest;
import com.museosmart.entity.Exhibicion;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.repository.ExhibicionEdicionHistorialRepository;
import com.museosmart.repository.ExhibicionEstadoHistorialRepository;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.ContenidoMultimediaRepository;
import com.museosmart.repository.UsuarioAdminRepository;
import com.museosmart.media.MediaStorageService;
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
    private ExhibicionEdicionHistorialRepository edicionHistorialRepository;

    @Mock
    private ExhibicionEstadoHistorialRepository estadoHistorialRepository;

    @Mock
    private UsuarioAdminRepository usuarioAdminRepository;

    @Mock
    private ContenidoMultimediaRepository multimediaRepository;

    @Mock
    private MediaStorageService mediaStorage;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private ExhibicionService exhibicionService;

    @BeforeEach
    void setUp() {
        exhibicionService = new ExhibicionService(exhibicionRepository, salaRepository,
                edicionHistorialRepository, estadoHistorialRepository, usuarioAdminRepository,
                multimediaRepository, mediaStorage);
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

    // ---------- Edicion ----------

    @Test
    @DisplayName("editar actualiza los campos y registra una fila por campo cambiado")
    void editar_registraHistorialPorCampo() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setVersion(2);
        existente.setDescripcionCorta("corta vieja");
        existente.setDescripcion("vieja");
        existente.setAutorCultura("Anonimo");
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));
        when(exhibicionRepository.save(any(Exhibicion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(usuarioAdminRepository.findById(9L)).thenReturn(Optional.empty());

        Exhibicion resultado = exhibicionService.editar(5L,
                new EditarExhibicionRequest("Nuevo titulo", "corta nueva", "desc nueva",
                        "1851", "Oleo", "EEUU", "dato", 2), 9L);

        assertThat(resultado.getTitulo()).isEqualTo("Nuevo titulo");
        assertThat(resultado.getDescripcionCorta()).isEqualTo("corta nueva");
        assertThat(resultado.getDescripcion()).isEqualTo("desc nueva");
        assertThat(resultado.getPeriodo()).isEqualTo("1851");
        assertThat(resultado.getMaterial()).isEqualTo("Oleo");
        assertThat(resultado.getAutorCultura()).isEqualTo("EEUU");
        assertThat(resultado.getDatoCurioso()).isEqualTo("dato");
        verify(edicionHistorialRepository, org.mockito.Mockito.times(7)).save(any());
    }

    @Test
    @DisplayName("editar sin cambios reales no escribe historial ni guarda")
    void editar_sinCambiosNoHaceNada() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setVersion(1);
        existente.setDescripcionCorta("corta");
        existente.setDescripcion("igual");
        existente.setAutorCultura("Anonimo");
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));

        exhibicionService.editar(5L,
                new EditarExhibicionRequest("[PROVISIONAL] pintura-historica-01", "corta",
                        "igual", null, null, "Anonimo", null, 1), 9L);

        verify(exhibicionRepository, never()).save(any(Exhibicion.class));
        verify(edicionHistorialRepository, never()).save(any());
    }

    @Test
    @DisplayName("editar con version obsoleta lanza ConflictoException (409)")
    void editar_versionObsoleta_lanzaConflicto() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setVersion(5);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));

        assertThatThrownBy(() -> exhibicionService.editar(5L,
                new EditarExhibicionRequest("Otro", "corta", null, null, null, null, null, 3), 9L))
                .isInstanceOf(com.museosmart.exception.ConflictoException.class)
                .hasMessageContaining("Otro administrador");
    }

    @Test
    @DisplayName("editar de una exhibicion inexistente lanza RecursoNoEncontradoException (404)")
    void editar_inexistente_lanza404() {
        when(exhibicionRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exhibicionService.editar(99L,
                new EditarExhibicionRequest("X", "corta", null, null, null, null, null, 0), 9L))
                .isInstanceOf(RecursoNoEncontradoException.class);
    }

    @Test
    @DisplayName("editar ignora intentos de cambiar el codigo: el campo no se toca")
    void editar_noCambiaCodigo() {
        Exhibicion existente = exhibicion("pintura-historica-01");
        existente.setVersion(0);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(existente));
        when(exhibicionRepository.save(any(Exhibicion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(usuarioAdminRepository.findById(9L)).thenReturn(Optional.empty());

        Exhibicion resultado = exhibicionService.editar(5L,
                new EditarExhibicionRequest("Nuevo", "corta", null, null, null, null, null, 0), 9L);

        assertThat(resultado.getCodigo()).isEqualTo("pintura-historica-01");
    }
    // ---------- Regla de imagen ----------

    @Test
    @DisplayName("activar sin imagen lanza ConflictoException (409)")
    void cambiarEstado_activarSinImagen_409() {
        Exhibicion inactiva = exhibicion("pintura-historica-01");
        inactiva.setActiva(false);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(inactiva));
        when(multimediaRepository.existsByExhibicionIdAndTipo(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> exhibicionService.cambiarEstado(5L,
                new CambioEstadoRequest(true, null), 9L))
                .isInstanceOf(com.museosmart.exception.ConflictoException.class)
                .hasMessageContaining("Sube una imagen");

        verify(exhibicionRepository, never()).save(any(Exhibicion.class));
    }

    @Test
    @DisplayName("activar con imagen funciona")
    void cambiarEstado_activarConImagen_ok() {
        Exhibicion inactiva = exhibicion("pintura-historica-01");
        inactiva.setActiva(false);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(inactiva));
        when(multimediaRepository.existsByExhibicionIdAndTipo(any(), any())).thenReturn(true);
        when(exhibicionRepository.save(any(Exhibicion.class))).thenAnswer(inv -> inv.getArgument(0));

        Exhibicion resultado = exhibicionService.cambiarEstado(5L,
                new CambioEstadoRequest(true, null), 9L);

        assertThat(resultado.isActiva()).isTrue();
    }

    @Test
    @DisplayName("desactivar sin imagen esta permitido")
    void cambiarEstado_desactivarSinImagen_ok() {
        Exhibicion activa = exhibicion("pintura-historica-01");
        activa.setActiva(true);
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(activa));
        when(exhibicionRepository.save(any(Exhibicion.class))).thenAnswer(inv -> inv.getArgument(0));

        Exhibicion resultado = exhibicionService.cambiarEstado(5L,
                new CambioEstadoRequest(false, "mantenimiento"), 9L);

        assertThat(resultado.isActiva()).isFalse();
    }

    @Test
    @DisplayName("eliminar imagen siempre lanza ConflictoException (409)")
    void eliminarImagen_noPermitido() {
        Exhibicion ex = exhibicion("pintura-historica-01");
        when(exhibicionRepository.findById(5L)).thenReturn(Optional.of(ex));

        assertThatThrownBy(() -> exhibicionService.eliminarImagenNoPermitido(5L))
                .isInstanceOf(com.museosmart.exception.ConflictoException.class)
                .hasMessageContaining("no se puede eliminar");
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
