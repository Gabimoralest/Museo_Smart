package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.groups.Default;

/**
 * Datos para crear o actualizar un ADMIN desde el panel.
 *
 * <p>El modelo es fijo: existe un unico SUPERADMIN creado desde el backend y
 * toda cuenta gestionada desde el panel es ADMIN. Por eso el rol no se puede
 * fijar: {@code rol} es opcional y solo se acepta (ignorandolo) si vale
 * {@code ADMIN}; cualquier otro valor, incluido {@code SUPERADMIN}, se rechaza
 * con 400.</p>
 */
@Schema(description = "Datos para crear o actualizar un administrador (siempre rol ADMIN)")
public record UsuarioAdminRequest(

        @Schema(description = "Nombre del administrador", example = "Gabs")
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
        String nombre,

        @Schema(description = "Correo electrónico único", example = "admin@museo.com")
        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 254, message = "El correo no puede superar 254 caracteres")
        String correo,

        @Schema(description = "Contraseña (solo en la creación; mínimo 8 caracteres)",
                example = "********")
        @NotBlank(groups = OnCreate.class, message = "La contraseña es obligatoria")
        @Size(min = 8, groups = OnCreate.class, message = "La contraseña debe tener al menos 8 caracteres")
        String contrasena,

        @Schema(description = "Campo obsoleto: el rol no es editable. "
                + "Si se envía, solo se acepta 'ADMIN'; las cuentas del panel son siempre ADMIN.",
                example = "ADMIN", deprecated = true)
        String rol
) {

    /** Grupo aplicado al crear: exige contraseña. Incluye el grupo Default. */
    public interface OnCreate extends Default {
    }

    /** Grupo aplicado al actualizar: la contraseña no se envía ni se valida. Incluye el grupo Default. */
    public interface OnUpdate extends Default {
    }
}
