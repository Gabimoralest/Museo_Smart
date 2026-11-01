package com.museosmart.repository;

import com.museosmart.entity.UsuarioAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioAdminRepository extends JpaRepository<UsuarioAdmin, Long> {

    Optional<UsuarioAdmin> findByCorreoIgnoreCase(String correo);

    List<UsuarioAdmin> findByIdIn(java.util.Collection<Long> ids);

    boolean existsByCorreoIgnoreCase(String correo);

    List<UsuarioAdmin> findByRol(String rol);

    List<UsuarioAdmin> findByEstado(String estado);
}
