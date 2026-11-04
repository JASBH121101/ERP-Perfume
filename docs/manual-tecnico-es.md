# Manual técnico — JB PARFUMS ERP

**Revisión:** 4 de noviembre de 2026  
**Rama de referencia:** `feat/erp-operational-modules`  
**Estado:** desarrollo / revisión; no autorizado como emisor fiscal.

## 1. Componentes

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Interfaz | HTML, CSS y JavaScript | Formularios, navegación, validación de entrada y representación de módulos |
| API | Cloudflare Worker | Autenticación de solicitudes, permisos, reglas de negocio y acceso a datos |
| Base de datos | Neon PostgreSQL | Usuarios/perfiles, datos operativos, configuración, historial y auditoría |
| Archivos | Cloudflare R2 privado | Soportes tributarios y otros archivos que el Worker gestione |
| Repositorio | GitHub privado | Código fuente, migraciones, pruebas y documentación |
| Validación | Node.js 22, pruebas unitarias y Playwright | Validación estática, de reglas y navegador |

El proyecto ERP utiliza Neon, no Supabase. El proyecto y sus datos deben mantenerse separados de otros productos del titular.

## 2. Entornos

- Repositorio: `JASBH121101/ERP-Perfume`.
- Rama de trabajo descrita: `feat/erp-operational-modules`.
- Base de datos de pruebas: Neon `erp_perfume`, rama `development`.
- Rama Neon `production`: fuera del alcance de este trabajo.
- Almacenamiento: bucket privado R2 `erp-perfume-assets`, binding del Worker `ERP_ASSETS`.
- No se deben copiar secretos, cadenas de conexión, claves o tokens al repositorio.
- Los cambios de esquema deben ser aditivos, versionados y validados primero en una rama temporal o en Development conforme al procedimiento de migraciones.

## 3. Autenticación y autorización

El Worker verifica el token y resuelve el perfil ERP antes de permitir la operación. Cada endpoint debe aplicar una lista de roles permitidos en el servidor; ocultar un botón en el navegador no constituye autorización.

Las operaciones que escriben datos deben:

- Validar tipo, rango y longitud de los campos.
- Usar consultas parametrizadas.
- Validar relaciones y estados en servidor.
- Registrar el actor, acción, entidad y referencia cuando corresponda.
- Devolver errores controlados sin revelar secretos, SQL ni datos privados.

Los cambios de configuración DGI están reservados al propietario/administración. Los documentos DGI se limitan a roles autorizados de propietario, administración o finanzas conforme al endpoint.

## 4. Almacenamiento de soportes DGI

La tabla `public.dgi_support_documents` almacena metadatos y referencias de los archivos. El contenido se guarda en R2 mediante claves aleatorias dentro del prefijo `dgi-documents/`. El Worker valida fecha, tipo, emisor, período, moneda, importe, MIME y tamaño antes de guardar.

Tipos de archivo admitidos actualmente: PDF, JPEG y PNG. Tamaño máximo: 5 MB por archivo. El acceso a archivos debe mantenerse privado, con autorización por perfil y cabeceras de no caché.

## 5. Configuración DGI

La configuración se almacena en `app_settings` con clave `dgi_compliance`. No guardar números de cédula, contraseñas ni identificadores privados innecesarios. Los campos de referencia sirven para enlazar los estados registrados con una constancia o respuesta documental.

Reglas del backend:

- Un régimen distinto de `not_confirmed` requiere RUC, fecha y referencia de constancia/resolución.
- `authorized` para facturación computarizada requiere RUC, fecha y número de autorización.
- `not_applicable_confirmed` requiere RUC, fecha y referencia de la respuesta escrita.
- La configuración por sí sola no crea una autorización, ni activa una numeración fiscal o un emisor fiscal.

## 6. Auditoría e integridad

El backend registra eventos de auditoría para operaciones protegidas y para la carga de soportes DGI. No debe existir una ruta genérica que permita editar o eliminar facturas, pagos, movimientos de inventario, caja o nómina pasando por alto sus flujos transaccionales.

Para una futura fase fiscal todavía se requiere diseñar y probar:
- Numeración fiscal consecutiva e inalterable, series por sucursal si aplica y protección frente a reutilización.
- Conservación del documento original anulado y su motivo.
- Nota de crédito para anulaciones/devoluciones posteriores cuando corresponda.
- Reversión consecutiva y trazable del inventario ligado a la nota de crédito.
- Registro y aprobación de cambios de versión antes de facturación.
- Formato de factura fiscal aprobado y número de autorización visible.

## 7. Respaldos y recuperación

La obligación de respaldo diario que aparece en la Disposición Técnica 09-2007 se refiere al sistema sometido a autorización para facturación computarizada.

Se añadió `.github/workflows/daily-db-backup.yml`, una tarea opcional que:
- Ejecuta diariamente a las 02:00 de Nicaragua (08:00 UTC).
- Realiza un `pg_dump` de Neon Development.
- Cifra el dump con GPG/AES-256 antes de transferirlo.
- Lo sube al prefijo privado `database-backups/erp_perfume/` del bucket R2 existente.
- Verifica el tamaño remoto y conserva los siete respaldos más recientes.

**La automatización está desactivada por defecto.** No corre hasta configurar los seis secretos documentados y establecer la variable `ERP_DAILY_BACKUP_ENABLED=true`. No se han configurado esas credenciales desde este cambio, ni se ha ejecutado un respaldo real. La tarea no se puede declarar operativa todavía.

El almacenamiento de soportes en R2 no es una copia de seguridad de PostgreSQL. El dump de PostgreSQL tampoco copia automáticamente los archivos adjuntos que ya están en R2. La guía `docs/backup-restore-es.md` documenta configuración, retención y restauración segura en una base aislada.

Antes de habilitar facturación fiscal debe completarse:
- Configuración de secretos y activación explícita del workflow.
- Ejecución manual y programada satisfactoria.
- Prueba de descifrado y restauración en una base/branch de prueba vacío.
- Registro de la fecha, hash, destino y resultado de la prueba de restauración.
- Inventario/recuperación separada para archivos R2.
- Procedimiento de contingencia de facturación aceptado por la DGI.

La automatización usa GitHub Actions y el bucket existente; no añade otro Worker ni un Cron Trigger de Cloudflare. Aun así, consume minutos de Actions y almacenamiento/operaciones R2, por lo que se mantiene apagada hasta que el titular verifique sus cuotas y decida activarla.

## 8. Calidad y publicación

Los cambios deben pasar:
1. Sintaxis del frontend y del Worker.
2. Pruebas unitarias.
3. Pruebas E2E de los flujos afectados.
4. Auditoría JB Expert QA, con reporte completo.
5. Revisión del consumo de Neon, Cloudflare Workers y R2.

El despliegue productivo y las migraciones de la rama Neon `production` requieren revisión y autorización separadas. La aprobación del CI no equivale a aprobación tributaria.
