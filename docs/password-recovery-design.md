# Recuperación de acceso de colaboradores

## Decisiones funcionales aprobadas

- Cada ficha de colaborador puede registrar correo, celular o ambos; ninguno de los dos campos es obligatorio en la ficha laboral.
- El correo y el celular deben verificarse antes de utilizarlos para recuperar una cuenta.
- Si la cuenta tiene solo correo verificado, se ofrece recuperación por correo.
- Si tiene solo celular verificado, se ofrece recuperación por SMS.
- Si ambos están verificados, la pantalla pregunta dónde desea recibir el código.
- Si no hay ningún canal verificado, se informa que debe contactar al administrador y actualizar/verificar un medio de recuperación.

## Controles de seguridad acordados

- Recuperación por correo: enlace de un solo uso.
- Recuperación por SMS: OTP numérico de 6 dígitos, caducidad de 5 minutos y máximo 5 intentos.
- Almacenar únicamente HMAC/hash del secreto de recuperación, nunca el token/OTP en claro.
- Respuestas anti-enumeración: la pantalla no debe revelar si un correo, teléfono o cuenta existe.
- Rate limits por cuenta, destino e IP; invalidar códigos anteriores al emitir uno nuevo.
- Registrar eventos de solicitud, validación, expiración y cambio de contraseña sin incluir secretos ni OTP.
- Tras cambiar contraseña, revocar sesiones activas y exigir nueva autenticación.
- No guardar contraseñas en la ficha laboral.

## Arquitectura y bloqueos antes de activar el flujo

- Mantener adaptadores intercambiables de proveedor de correo y SMS; todavía no se ha seleccionado ni conectado un proveedor real.
- Requiere un secreto estable `JB_RECOVERY_SECRET` en Cloudflare Worker Development.
- Los desafíos y límites deben persistir de forma atómica y compartida entre instancias. No usar memoria local del Worker como almacenamiento de seguridad; elegir un almacenamiento compartido compatible antes de implementar el endpoint.
- La autenticación actual del ERP usa Neon Auth, exige identidad de usuario con correo verificado y vincula `app_users` por `auth_user_id` y correo. El aprovisionamiento de cuenta también exige una identidad Neon Auth por correo.
- Por lo anterior, registrar un celular en la ficha laboral no activa por sí solo la recuperación SMS ni permite cuentas sin correo. Para cubrir colaboradores sin correo se debe integrar un mecanismo de identidad/autenticación compatible con teléfono y resolver la vinculación segura con `app_users`, sin debilitar la verificación ni el aislamiento de permisos.

## Estado

La tabla `employees` ya dispone de `phone`; el formulario de RR. HH. ahora permite capturar ese dato y enviarlo al API. El flujo real de recuperación no debe mostrarse como habilitado hasta conectar proveedores, almacenamiento atómico, verificación de canales y el flujo de cambio de contraseña con Neon Auth.
