# Respaldo y restauración — JB PARFUMS ERP

**Estado:** preparado en desarrollo; automatización desactivada por defecto.  
**Objetivo:** obtener una copia lógica diaria, cifrada, de Neon Development y conservar siete copias verificadas en el bucket privado R2 ya existente.

## 1. Diseño y consumo

- La tarea utiliza GitHub Actions con horario diario a las **02:00 de Nicaragua (08:00 UTC)**.
- La tarea ejecuta `pg_dump` para crear un respaldo PostgreSQL en formato custom, cifra el archivo con GPG/AES-256 y lo sube al prefijo `database-backups/erp_perfume/` del bucket R2 existente.
- Después de verificar el tamaño del objeto remoto, conserva las siete copias más recientes.
- No crea un Worker, una base de datos, un bucket ni un servicio adicional.
- El job permanece omitido mientras la variable `ERP_DAILY_BACKUP_ENABLED` no esté configurada explícitamente en `true`. Un job omitido no reserva un runner.
- El archivo queda cifrado antes de salir del runner. El bucket debe permanecer privado; usa credenciales R2 limitadas a ese bucket y a las operaciones necesarias (listar, escribir, leer/consultar y borrar únicamente bajo el prefijo de respaldos).
- No se suben dumps a los artefactos de GitHub Actions. Los registros del job contienen la ruta, tamaño y hash, no el contenido del dump ni la contraseña.

## 2. Secretos y activación manual

En GitHub → Settings → Secrets and variables → Actions, crea estos **Repository secrets**:

| Nombre | Valor |
|---|---|
| `ERP_BACKUP_DATABASE_URL` | URI PostgreSQL de la rama Neon **Development**, con SSL habilitado |
| `ERP_BACKUP_R2_ACCOUNT_ID` | ID de cuenta Cloudflare (32 caracteres hexadecimales) |
| `ERP_BACKUP_R2_BUCKET_NAME` | Nombre exacto del bucket privado existente |
| `ERP_BACKUP_R2_ACCESS_KEY_ID` | Access Key de R2 limitada al bucket de respaldos |
| `ERP_BACKUP_R2_SECRET_ACCESS_KEY` | Secret Key correspondiente |
| `ERP_BACKUP_ENCRYPTION_PASSPHRASE` | Frase aleatoria larga para cifrar/descifrar; guardar una copia offline segura |

En Settings → Secrets and variables → Actions → Variables, crea:

| Nombre | Valor inicial |
|---|---|
| `ERP_DAILY_BACKUP_ENABLED` | `false` |

**No activar el valor `true` hasta haber verificado que el URI apunta a Neon Development y que las claves R2 son de mínimo privilegio.** No guardar secretos en el repositorio, archivos .env, capturas ni mensajes.

Cuando estén configurados, cambiar la variable a `true` y ejecutar manualmente el workflow “ERP daily encrypted database backup”. Confirmar que el objeto aparece en R2 y que el resumen contiene tamaño y SHA-256. Después confirmar que la ejecución programada del día siguiente se completa.

## 3. Restauración controlada

Nunca restaurar directamente sobre la base de datos de producción como primera prueba.

1. Descarga el archivo cifrado desde el prefijo privado `database-backups/erp_perfume/`.
2. Descifra en un equipo controlado, sin publicar la frase de cifrado:

```bash
gpg --decrypt --output erp_perfume.dump YYYY-MM-DDTHH-MM-SSZ.dump.gpg
```

3. Comprueba el archivo y prepara una base/branch aislada de prueba.
4. Restaura en el entorno vacío de prueba con una URI destino de prueba:

```bash
pg_restore --verbose --no-owner --no-acl \
  --dbname="$RESTORE_TEST_DATABASE_URL" erp_perfume.dump
```

5. Comprueba tablas, recuentos, restricciones, secuencias, índices, configuración, auditoría y relaciones. No muestres datos personales en logs.
6. Registra fecha, hash, backup elegido, destino de prueba, resultado, incidencias y responsable.
7. Borra el dump descifrado del equipo seguro después de completar el simulacro y confirmar que el destino de prueba queda aislado.

No ejecutar `--clean` ni restaurar sobre una base con datos que deban conservarse. La recuperación real requiere una base vacía o una rama aislada.

## 4. Alcance y límites

- Este respaldo cubre PostgreSQL. Los archivos adjuntos ya almacenados en R2 requieren un control separado de inventario/recuperación del bucket; copiar la base no copia automáticamente los objetos.
- La verificación de tamaño/hash demuestra que el archivo cifrado se subió, **no** que pueda restaurarse. Solo una prueba de descifrado y `pg_restore` en una base aislada demuestra recuperabilidad.
- La restauración de historial de Neon Free tiene una ventana de 6 horas según su documentación. Estas copias diarias son una segunda vía de recuperación, no sustituyen PITR.
- R2 Standard ofrece un tramo gratuito mensual de almacenamiento/operaciones. El tamaño del respaldo crece con los datos. Vigilar el uso real de R2 y borrar solo respaldos bajo el prefijo dedicado.
- GitHub Actions usa minutos de cómputo del plan del repositorio privado. Una ejecución diaria agrega consumo. Revisar el panel de facturación/uso antes de habilitar el cron; mantener la variable en `false` si el presupuesto no lo permite.
- El job usa el URI de Neon Development únicamente. No cambiar a Production sin procedimiento de autorización, prueba, copia y verificación independiente.

## 5. Criterio para declarar cumplimiento

El respaldo diario puede declararse operativo solo cuando:
- secretos y variable se hayan configurado;
- haya al menos una ejecución manual exitosa y una ejecución programada exitosa;
- el archivo esté en el bucket privado bajo el prefijo esperado;
- se haya realizado una restauración de prueba sin errores;
- se haya documentado la retención, el acceso al secreto de cifrado y el procedimiento de recuperación;
- se haya confirmado con la DGI si requiere algún detalle adicional para el expediente de autorización.
