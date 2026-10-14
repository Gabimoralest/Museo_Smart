package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.groups.Default;

@Schema(description = "Datos para crear o actualizar un administrador")
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

        @Schema(description = "Rol del administrador", example = "ADMIN",
                allowableValues = {"SUPERADMIN", "ADMIN"})
        @NotBlank(message = "El rol es obligatorio")
        @Pattern(regexp = "SUPERADMIN|ADMIN",
                message = "El rol debe ser SUPERADMIN o ADMIN")
        String rol,

        @Schema(description = "Contraseña (solo en la creación; mínimo 8 caracteres)",
                example = "********")
        @NotBlank(groups = OnCreate.class, message = "La contraseña es obligatoria")
        @Size(min = 8, groups = OnCreate.class, message = "La contraseña debe tener al menos 8 caracteres")
        String contrasena
) {

    /** Grupo aplicado al crear: exige contraseña. Incluye el grupo Default. */
    public interface OnCreate extends Default {
    }

    /** Grupo aplicado al actualizar: la contraseña no se envía ni se valida. Incluye el grupo Default. */
    public interface OnUpdate extends Default {
    }
}
