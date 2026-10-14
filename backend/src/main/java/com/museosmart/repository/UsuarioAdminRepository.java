package com.museosmart.repository;

import com.museosmart.entity.UsuarioAdmin;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UsuarioAdminRepository extends JpaRepository<UsuarioAdmin, Long> {

    Optional<UsuarioAdmin> findByCorreoIgnoreCase(String correo);

    boolean existsByCorreoIgnoreCase(String correo);

    List<UsuarioAdmin> findByRol(String rol);

    List<UsuarioAdmin> findByEstado(String estado);

    /**
     * Recupera todos los administradores de un rol adquiriendo un bloqueo pesimista
     * de escritura (SELECT ... FOR UPDATE) sobre sus filas, en orden ascendente de id.
     *
     * Se usa para serializar las operaciones que pueden reducir el número de
     * SuperAdmin activos: al bloquear el conjunto completo de SuperAdmin, dos
     * transacciones concurrentes no pueden superar a la vez la comprobación del
     * "último SuperAdmin activo". El ORDER BY u.id fija el orden de adquisición de
     * los bloqueos a nivel de base de datos y evita deadlocks.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UsuarioAdmin u where u.rol = :rol order by u.id asc")
    List<UsuarioAdmin> findByRolForUpdate(@Param("rol") String rol);
}
