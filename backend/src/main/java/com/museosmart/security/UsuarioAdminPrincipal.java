package com.museosmart.security;

import com.museosmart.entity.UsuarioAdmin;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Principal de Spring Security que envuelve a UsuarioAdmin y expone
 * el flag primerInicioSesion para la politica de cambio obligatorio.
 * No expone el hash de la contrasena.
 */
public class UsuarioAdminPrincipal implements UserDetails {

    private final Long id;
    private final String nombre;
    private final String correo;
    private final String hashContrasena;
    private final String rol;
    private final boolean primerInicioSesion;
    private final boolean cuentaHabilitada;

    public UsuarioAdminPrincipal(UsuarioAdmin usuario) {
        this.id = usuario.getId();
        this.nombre = usuario.getNombre();
        this.correo = usuario.getCorreo();
        this.hashContrasena = usuario.getHashContrasena();
        this.rol = usuario.getRol();
        this.primerInicioSesion = usuario.isPrimerInicioSesion();
        // Solo ACTIVO puede autenticarse; INACTIVO y BLOQUEADO quedan deshabilitados.
        this.cuentaHabilitada = "ACTIVO".equals(usuario.getEstado());
    }

    /**
     * Constructor para reconstruir el principal a partir de las claims de un JWT
     * ya validado. No carga el hash de contrasena.
     */
    public UsuarioAdminPrincipal(Long id, String nombre, String correo, String hashContrasena,
                                 String rol, boolean primerInicioSesion, boolean cuentaHabilitada) {
        this.id = id;
        this.nombre = nombre;
        this.correo = correo;
        this.hashContrasena = hashContrasena;
        this.rol = rol;
        this.primerInicioSesion = primerInicioSesion;
        this.cuentaHabilitada = cuentaHabilitada;
    }

    public Long getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public String getRol() {
        return rol;
    }

    public boolean isPrimerInicioSesion() {
        return primerInicioSesion;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + rol));
    }

    @Override
    public String getPassword() {
        return hashContrasena;
    }

    @Override
    public String getUsername() {
        return correo;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return cuentaHabilitada;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return cuentaHabilitada;
    }
}
