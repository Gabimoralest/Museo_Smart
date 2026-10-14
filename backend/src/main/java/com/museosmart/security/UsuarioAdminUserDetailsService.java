package com.museosmart.security;

import com.museosmart.entity.UsuarioAdmin;
import com.museosmart.repository.UsuarioAdminRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioAdminUserDetailsService implements UserDetailsService {

    private final UsuarioAdminRepository usuarioAdminRepository;

    public UsuarioAdminUserDetailsService(UsuarioAdminRepository usuarioAdminRepository) {
        this.usuarioAdminRepository = usuarioAdminRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String correo) throws UsernameNotFoundException {
        UsuarioAdmin usuario = usuarioAdminRepository.findByCorreoIgnoreCase(correo)
                .orElseThrow(() -> new UsernameNotFoundException("Credenciales inválidas"));
        return new UsuarioAdminPrincipal(usuario);
    }
}
