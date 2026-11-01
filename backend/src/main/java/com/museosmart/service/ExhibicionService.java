package com.museosmart.service;

import com.museosmart.dto.CambioEstadoRequest;
import com.museosmart.dto.EditarExhibicionRequest;
import com.museosmart.dto.ExhibicionHistorialItem;
import com.museosmart.entity.ContenidoMultimedia;
import com.museosmart.entity.Exhibicion;
import com.museosmart.entity.ExhibicionEdicionHistorial;
import com.museosmart.entity.ExhibicionEstadoHistorial;
import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.exception.ConflictoException;
import com.museosmart.exception.RecursoNoEncontradoException;
import com.museosmart.media.MediaStorageService;
import com.museosmart.repository.ContenidoMultimediaRepository;
import com.museosmart.repository.ExhibicionEdicionHistorialRepository;
import com.museosmart.repository.ExhibicionEstadoHistorialRepository;
import com.museosmart.repository.ExhibicionRepository;
import com.museosmart.repository.SalaRepository;
import com.museosmart.repository.UsuarioAdminRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Consulta, edicion y activacion/desactivacion de exhibiciones, y gestion de su
 * multimedia (V15).
 *
 * <p>Las exhibiciones NO se crean ni eliminan: solo se editan y se
 * activan/desactivan. El {@code codigo}, la sala, la categoria y la ubicacion 3D
 * son de solo lectura.</p>
 */
@Service
@Transactional(readOnly = true)
public class ExhibicionService {

    public static final String CAMPO_TITULO = "titulo";
    public static final String CAMPO_DESCRIPCION_CORTA = "descripcion_corta";
    public static final String CAMPO_DESCRIPCION = "descripcion";
    public static final String CAMPO_PERIODO = "periodo";
    public static final String CAMPO_MATERIAL = "material";
    public static final String CAMPO_CULTURA = "autor_cultura";
    public static final String CAMPO_DATO_CURIOSO = "dato_curioso";
    public static final String CAMPO_MULTIMEDIA = "multimedia";

    public static final String MENSAJE_SIN_IMAGEN =
            "Sube una imagen antes de activar la exhibición";
    public static final String MENSAJE_IMAGEN_NO_ELIMINABLE =
            "La imagen de una exhibición no se puede eliminar; solo reemplazar";

    private final ExhibicionRepository exhibicionRepository;
    private final SalaRepository salaRepository;
    private final ExhibicionEdicionHistorialRepository edicionHistorialRepository;
    private final ExhibicionEstadoHistorialRepository estadoHistorialRepository;
    private final UsuarioAdminRepository usuarioAdminRepository;
    private final ContenidoMultimediaRepository multimediaRepository;
    private final MediaStorageService mediaStorage;

    @PersistenceContext
    private EntityManager entityManager;

    public ExhibicionService(ExhibicionRepository exhibicionRepository,
                             SalaRepository salaRepository,
                             ExhibicionEdicionHistorialRepository edicionHistorialRepository,
                             ExhibicionEstadoHistorialRepository estadoHistorialRepository,
                             UsuarioAdminRepository usuarioAdminRepository,
                             ContenidoMultimediaRepository multimediaRepository,
                             MediaStorageService mediaStorage) {
        this.exhibicionRepository = exhibicionRepository;
        this.salaRepository = salaRepository;
        this.edicionHistorialRepository = edicionHistorialRepository;
        this.estadoHistorialRepository = estadoHistorialRepository;
        this.usuarioAdminRepository = usuarioAdminRepository;
        this.multimediaRepository = multimediaRepository;
        this.mediaStorage = mediaStorage;
    }

    /**
     * Exhibiciones destinadas al visitante: solo las activas de la sala indicada.
     * La exhibicion especial (sala NULL) NO se incluye aqui.
     */
    public List<Exhibicion> listarPorSala(Long salaId) {
        if (!salaRepository.existsById(salaId)) {
            throw new RecursoNoEncontradoException("No existe la sala con id " + salaId);
        }
        return exhibicionRepository.findBySalaIdAndActiva(salaId, true);
    }

    /** Todas las exhibiciones activas (catalogo publico), incluida la especial. */
    public List<Exhibicion> listarActivas() {
        return exhibicionRepository.findByActiva(true);
    }

    /** Todas las exhibiciones, incluidas inactivas y la especial. */
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

    // ------------------------------------------------------------------
    // Multimedia (lectura)
    // ------------------------------------------------------------------

    /** Multimedia de una exhibicion indexado por tipo (IMAGEN / VIDEO). */
    public Map<String, ContenidoMultimedia> multimediaPorTipo(Long exhibicionId) {
        Map<String, ContenidoMultimedia> mapa = new HashMap<>();
        for (ContenidoMultimedia m : multimediaRepository.findByExhibicionId(exhibicionId)) {
            mapa.put(m.getTipo(), m);
        }
        return mapa;
    }

    /**
     * Multimedia agrupado por exhibicion (mapa exhibicionId -> juego de tipo).
     * Evita N+1 en el listado.
     */
    public Map<Long, Map<String, ContenidoMultimedia>> multimediaPorExhibicion(List<Exhibicion> exhibiciones) {
        Set<Long> ids = exhibiciones.stream().map(Exhibicion::getId).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Map<String, ContenidoMultimedia>> mapa = new HashMap<>();
        for (ContenidoMultimedia m : multimediaRepository.findByExhibicionIdIn(ids)) {
            mapa.computeIfAbsent(m.getExhibicion().getId(), k -> new HashMap<>())
                    .put(m.getTipo(), m);
        }
        return mapa;
    }

    public boolean tieneImagen(Long exhibicionId) {
        return multimediaRepository.existsByExhibicionIdAndTipo(
                exhibicionId, ContenidoMultimedia.TIPO_IMAGEN);
    }

    // ------------------------------------------------------------------
    // Edicion
    // ------------------------------------------------------------------

    @Transactional
    public Exhibicion editar(Long id, EditarExhibicionRequest request, Long usuarioId) {
        Exhibicion exhibicion = obtenerPorId(id);

        if (!Objects.equals(exhibicion.getVersion(), request.version())) {
            throw new ConflictoException(
                    "Otro administrador modificó esta exhibición; recarga para ver los cambios");
        }

        String nuevoTitulo = request.titulo() == null ? null : request.titulo().trim();
        String nuevaDescripcionCorta = request.descripcionCorta() == null
                ? null : request.descripcionCorta().trim();
        String nuevaDescripcion = normalizarTexto(request.descripcion());
        String nuevoPeriodo = normalizarTexto(request.periodo());
        String nuevoMaterial = normalizarTexto(request.material());
        String nuevaCultura = normalizarTexto(request.culturaProcedencia());
        String nuevoDato = normalizarTexto(request.datoCurioso());

        List<ExhibicionEdicionHistorial> cambios = new ArrayList<>();
        registrarCambio(cambios, exhibicion, CAMPO_TITULO, exhibicion.getTitulo(), nuevoTitulo);
        registrarCambio(cambios, exhibicion, CAMPO_DESCRIPCION_CORTA,
                exhibicion.getDescripcionCorta(), nuevaDescripcionCorta);
        registrarCambio(cambios, exhibicion, CAMPO_DESCRIPCION, exhibicion.getDescripcion(), nuevaDescripcion);
        registrarCambio(cambios, exhibicion, CAMPO_PERIODO, exhibicion.getPeriodo(), nuevoPeriodo);
        registrarCambio(cambios, exhibicion, CAMPO_MATERIAL, exhibicion.getMaterial(), nuevoMaterial);
        registrarCambio(cambios, exhibicion, CAMPO_CULTURA, exhibicion.getAutorCultura(), nuevaCultura);
        registrarCambio(cambios, exhibicion, CAMPO_DATO_CURIOSO, exhibicion.getDatoCurioso(), nuevoDato);

        if (cambios.isEmpty()) {
            // Nada cambio: no se escribe historial y la version no sube.
            return exhibicion;
        }

        exhibicion.setTitulo(nuevoTitulo);
        exhibicion.setDescripcionCorta(nuevaDescripcionCorta);
        exhibicion.setDescripcion(nuevaDescripcion);
        exhibicion.setPeriodo(nuevoPeriodo);
        exhibicion.setMaterial(nuevoMaterial);
        exhibicion.setAutorCultura(nuevaCultura);
        exhibicion.setDatoCurioso(nuevoDato);
        UsuarioAdmin editor = usuarioAdminRepository.findById(usuarioId).orElse(null);
        exhibicion.setActualizadoPor(editor);

        Exhibicion guardada = exhibicionRepository.save(exhibicion);
        for (ExhibicionEdicionHistorial cambio : cambios) {
            cambio.setExhibicion(guardada);
            cambio.setEditadoPor(usuarioId);
            edicionHistorialRepository.save(cambio);
        }
        return guardada;
    }

    private void registrarCambio(List<ExhibicionEdicionHistorial> cambios, Exhibicion exhibicion,
                                 String campo, String anterior, String nuevo) {
        if (Objects.equals(anterior, nuevo)) {
            return;
        }
        ExhibicionEdicionHistorial fila = new ExhibicionEdicionHistorial();
        fila.setExhibicion(exhibicion);
        fila.setCampo(campo);
        fila.setValorAnterior(anterior);
        fila.setValorNuevo(nuevo);
        cambios.add(fila);
    }

    private String normalizarTexto(String valor) {
        if (valor == null) return null;
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    /**
     * Historial combinado (ediciones + cambios de estado + multimedia) del mas
     * reciente al mas antiguo.
     */
    public List<ExhibicionHistorialItem> historial(Long id) {
        obtenerPorId(id);

        List<ExhibicionEdicionHistorial> ediciones =
                edicionHistorialRepository.findByExhibicionIdOrderByEditadoEnDesc(id);
        List<ExhibicionEstadoHistorial> estados =
                estadoHistorialRepository.findByExhibicionIdOrderByCambiadoEnDesc(id);

        Set<Long> idsUsuarios = new HashSet<>();
        ediciones.forEach(e -> { if (e.getEditadoPor() != null) idsUsuarios.add(e.getEditadoPor()); });
        estados.forEach(e -> { if (e.getCambiadoPor() != null) idsUsuarios.add(e.getCambiadoPor()); });

        Map<Long, String> nombres = new HashMap<>();
        if (!idsUsuarios.isEmpty()) {
            for (UsuarioAdmin u : usuarioAdminRepository.findByIdIn(idsUsuarios)) {
                nombres.put(u.getId(), u.getNombre());
            }
        }

        List<ExhibicionHistorialItem> items = new ArrayList<>();
        for (ExhibicionEdicionHistorial e : ediciones) {
            items.add(new ExhibicionHistorialItem(
                    "EDICION", e.getEditadoEn(),
                    e.getEditadoPor() != null ? nombres.get(e.getEditadoPor()) : null,
                    e.getCampo(), e.getValorAnterior(), e.getValorNuevo(), null));
        }
        for (ExhibicionEstadoHistorial e : estados) {
            items.add(new ExhibicionHistorialItem(
                    "ESTADO", e.getCambiadoEn(),
                    e.getCambiadoPor() != null ? nombres.get(e.getCambiadoPor()) : null,
                    "activa",
                    String.valueOf(e.isEstadoAnterior()),
                    String.valueOf(e.isEstadoNuevo()),
                    e.getMotivo()));
        }
        items.sort(Comparator.comparing(ExhibicionHistorialItem::fecha,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return items;
    }

    /** Nombres de los administradores que editaron, indexados por exhibicion. */
    public Map<Long, String> nombresActualizador(List<Exhibicion> exhibiciones) {
        Set<Long> ids = exhibiciones.stream()
                .map(Exhibicion::getActualizadoPor)
                .filter(Objects::nonNull)
                .map(UsuarioAdmin::getId)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> nombres = new HashMap<>();
        for (UsuarioAdmin u : usuarioAdminRepository.findByIdIn(ids)) {
            nombres.put(u.getId(), u.getNombre());
        }
        return nombres;
    }

    // ------------------------------------------------------------------
    // Activacion / desactivacion
    // ------------------------------------------------------------------

    /**
     * Activa o desactiva una exhibicion. No permite ACTIVAR una exhibicion sin
     * imagen (409). Desactivar siempre esta permitido.
     */
    @Transactional
    public Exhibicion cambiarEstado(Long id, CambioEstadoRequest request, Long usuarioId) {
        Exhibicion exhibicion = obtenerPorId(id);

        boolean nuevoEstado = Boolean.TRUE.equals(request.activa());
        if (exhibicion.isActiva() == nuevoEstado) {
            return exhibicion;
        }

        if (nuevoEstado && !tieneImagen(id)) {
            throw new ConflictoException(MENSAJE_SIN_IMAGEN);
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
        if (usuarioId != null) {
            usuarioAdminRepository.findById(usuarioId).ifPresent(exhibicion::setActualizadoPor);
        }
        return exhibicionRepository.save(exhibicion);
    }

    // ------------------------------------------------------------------
    // Multimedia (escritura)
    // ------------------------------------------------------------------

    /**
     * Sube o reemplaza la imagen. El archivo nuevo se escribe antes de tocar la
     * BD; el anterior se borra SOLO tras el commit. Si la BD falla, se borra el
     * archivo nuevo.
     */
    @Transactional
    public ContenidoMultimedia subirImagen(Long exhibicionId, MultipartFile archivo, Long usuarioId) {
        return reemplazarMultimedia(exhibicionId, archivo, ContenidoMultimedia.TIPO_IMAGEN, usuarioId);
    }

    /** Sube o reemplaza el video (misma estrategia que la imagen). */
    @Transactional
    public ContenidoMultimedia subirVideo(Long exhibicionId, MultipartFile archivo, Long usuarioId) {
        return reemplazarMultimedia(exhibicionId, archivo, ContenidoMultimedia.TIPO_VIDEO, usuarioId);
    }

    private ContenidoMultimedia reemplazarMultimedia(Long exhibicionId, MultipartFile archivo,
                                                     String tipo, Long usuarioId) {
        Exhibicion exhibicion = obtenerPorId(exhibicionId);

        boolean esImagen = ContenidoMultimedia.TIPO_IMAGEN.equals(tipo);
        MediaStorageService.ArchivoGuardado guardado = esImagen
                ? mediaStorage.guardarImagen(exhibicionId, archivo)
                : mediaStorage.guardarVideo(exhibicionId, archivo);

        String claveAnterior = null;
        try {
            ContenidoMultimedia existente = multimediaRepository
                    .findByExhibicionIdAndTipo(exhibicionId, tipo).orElse(null);

            ContenidoMultimedia fila;
            if (existente != null) {
                fila = existente;
                claveAnterior = existente.getArchivoClave();
            } else {
                fila = new ContenidoMultimedia();
                fila.setExhibicion(exhibicion);
                fila.setTipo(tipo);
            }
            fila.setArchivoClave(guardado.clave());
            fila.setNombreOriginal(guardado.nombreOriginal());
            fila.setMimeType(guardado.mimeType());
            fila.setTamanoBytes(guardado.tamanoBytes());
            fila.setSubidoPor(usuarioId);
            fila.setUrl("/media/" + guardado.clave());
            ContenidoMultimedia resultado = multimediaRepository.save(fila);
            multimediaRepository.flush();

            registrarMultimedia(exhibicion, usuarioId,
                    existente != null ? "reemplazó " + tipo.toLowerCase() : "subió " + tipo.toLowerCase(),
                    claveAnterior, guardado.clave());

            // El archivo viejo se borra solo si la transaccion confirma.
            programarBorradoTrasCommit(claveAnterior);
            return resultado;
        } catch (RuntimeException ex) {
            // Fallo de BD: no dejar el archivo nuevo huerfano.
            mediaStorage.borrar(guardado.clave());
            throw ex;
        }
    }

    /** Elimina el video. La imagen NO se puede eliminar (409). */
    @Transactional
    public void eliminarVideo(Long exhibicionId, Long usuarioId) {
        Exhibicion exhibicion = obtenerPorId(exhibicionId);
        ContenidoMultimedia video = multimediaRepository
                .findByExhibicionIdAndTipo(exhibicionId, ContenidoMultimedia.TIPO_VIDEO)
                .orElse(null);
        if (video == null) {
            return;
        }
        String clave = video.getArchivoClave();
        multimediaRepository.delete(video);
        multimediaRepository.flush();
        registrarMultimedia(exhibicion, usuarioId, "eliminó video", clave, null);
        programarBorradoTrasCommit(clave);
    }

    /** Intento de eliminar imagen: siempre 409. */
    public void eliminarImagenNoPermitido(Long exhibicionId) {
        obtenerPorId(exhibicionId);
        throw new ConflictoException(MENSAJE_IMAGEN_NO_ELIMINABLE);
    }

    private void registrarMultimedia(Exhibicion exhibicion, Long usuarioId,
                                     String detalle, String anterior, String nuevo) {
        ExhibicionEdicionHistorial fila = new ExhibicionEdicionHistorial();
        fila.setExhibicion(exhibicion);
        fila.setCampo(CAMPO_MULTIMEDIA);
        fila.setValorAnterior(anterior);
        fila.setValorNuevo(detalle + (nuevo != null ? " (" + nuevo + ")" : ""));
        fila.setEditadoPor(usuarioId);
        edicionHistorialRepository.save(fila);
    }

    private void programarBorradoTrasCommit(String clave) {
        if (clave == null || clave.isBlank()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    mediaStorage.borrar(clave);
                }
            });
        } else {
            mediaStorage.borrar(clave);
        }
    }
}
