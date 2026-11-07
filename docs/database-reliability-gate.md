# Database Reliability Gate — JB PARFUMS ERP

**Objetivo:** bloquear cambios accidentales en los archivos SQL y conservar una fotografía verificable del estado de Neon Development antes de certificar Inventario.

## Alcance y seguridad

El control automático implementado en el repositorio es **offline y de solo lectura**:

- No abre conexiones a Neon.
- No ejecuta archivos SQL.
- No crea, elimina ni corrige filas en `app_schema_migrations`.
- No despliega Workers ni Pages.
- No accede a Neon Production ni modifica Production.
- No necesita secretos ni agrega consumo de Actions más allá del workflow de calidad que ya existe.

El control de GitHub Actions valida que cada archivo de migración sea trazable contra el manifiesto revisado. La verificación del estado vivo de Neon se hace por separado mediante el SQL de diagnóstico incluido en `db/diagnostics/development-readiness.sql`.

## Estado observado de Neon Development

Lectura directa de `erp-perfume / erp_perfume / development` el **7 de noviembre de 2026**:

| Comprobación | Resultado |
|---|---:|
| Filas en `app_schema_migrations` | 16 |
| Versiones distintas registradas | 16 |
| Versiones registradas | 0001–0011 y 0015–0019 |
| Versiones sin fila de registro | 0012, 0013 y 0014 |
| Objetos esperados de 0012–0014 | Presentes |
| Índices agregados por 0019 | 8 de 8 presentes |
| Claves foráneas sin validar | 0 |
| Índices inválidos o no listos | 0 |
| Restricciones PK/UNIQUE en el ledger | 1 |

La versión **0019 sí está aplicada** en Development. La fila observada tiene el checksum `de223be267e647d1e31a4d3bda1e3b5918a2c317de2f46ad18575409f727e474` y fecha `2026-11-06 21:31:03 UTC`; coincide con el SHA-256 de los bytes actuales de `0019_foreign_key_supporting_indexes.sql`. Los ocho índices esperados también están presentes. La sección anterior del informe de auditoría que la llamaba pendiente era una fotografía anterior y queda corregida por esta verificación posterior.

## Hallazgos históricos que siguen abiertos

Estos casos no se deben “reparar” ejecutando otra vez los SQL ni inventando filas en el ledger:

1. **0001–0007:** sus checksums registrados son de 40 caracteres y no existe una especificación histórica única del algoritmo/procedencia. Se conservan exactamente como evidencia; no se recalculan ni reemplazan.
2. **0008 y 0009:** los archivos del repositorio son reconstrucciones equivalentes al esquema observado, no se afirma que sean los SQL originales byte por byte. Los checksums registrados en Neon son distintos.
3. **0012–0014:** sus tablas, secuencia, trigger e índices esperados están presentes en Development, pero faltan las tres filas correspondientes en `app_schema_migrations`. No se deben volver a aplicar.
4. **0017:** el SHA-256 de la fuente actual no coincide con el checksum de la fila aplicada. La procedencia del SQL original aún requiere conciliación.
5. **0018:** el archivo actual es una reconstrucción equivalente al esquema observado; el checksum registrado corresponde a otra fuente. No se debe volver a aplicar ni sobrescribir el checksum.

Los 20 archivos SQL existentes tienen hashes SHA-256 fijados en `db/migration-integrity.json`. Ese manifiesto protege la fuente que está en Git; no convierte por sí solo las excepciones históricas en verificadas.

## Qué valida el gate

Ejecuta `npm run check:db`. El script:

- exige nombres `NNNN_descripcion.sql`;
- detecta versiones duplicadas o huecos en la secuencia de archivos;
- exige correspondencia exacta entre los archivos SQL y el manifiesto;
- calcula SHA-256 sobre los bytes exactos de cada archivo, sin normalizar finales de línea;
- comprueba que cada excepción histórica tenga estado y evidencia explícitos;
- exige que las versiones registradas y las no registradas coincidan con la fotografía documentada;
- comprueba que la siguiente etiqueta de archivo calculada sea `0021`; la migración `0020` sigue pendiente de promoción a Development.

Este control **no certifica una conexión viva con Neon** y no autoriza aplicar la versión 0020 en Development. La ejecución de una nueva migración queda bloqueada operativamente hasta que se concilien 0012–0014, 0017 y la procedencia histórica de los checksums.

## Flujo de trabajo obligatorio para migraciones futuras

1. Crear una nueva migración con el siguiente número disponible; no modificar ni renombrar archivos ya aplicados.
2. Revisar SQL, efectos sobre datos, claves foráneas, restricciones, índices y compatibilidad con la versión actual.
3. Actualizar el manifiesto con el SHA-256 exacto y la revisión correspondiente.
4. Pasar el gate estático y las pruebas unitarias.
5. Antes de aplicar, obtener respaldo verificable y usar exclusivamente Development.
6. Aplicar con exclusión mutua y transacción: el SQL y la inserción del ledger deben confirmarse juntos; si falla uno, debe revertirse la transacción.
7. Verificar esquema, datos, constraints, índices y checksum desde una nueva conexión.
8. Mantener Production fuera del proceso hasta contar con una autorización y un procedimiento de promoción independiente.

Un rollback de DDL no sustituye un respaldo y no se debe improvisar para migraciones destructivas. Las reconciliaciones de historial necesitan una decisión explícita basada en la evidencia del esquema, no una inserción automática.

## Comandos

```bash
npm run check:db
npm run test:unit
npm run build
```

Para repetir la inspección viva, abrir el SQL de diagnóstico y ejecutarlo en Neon SQL Editor, verificando primero que el selector indique la rama **development** y la base `erp_perfume`. El archivo contiene únicamente consultas `SELECT`.


## Clean-install execution and schema parity — 2026-11-07

A disposable Neon branch named `qa-db-clean-install-2026-11-07` was created from the empty Production schema. Production itself was not modified. The current repository migrations `0001`–`0019` all executed successfully on that isolated branch, each migration file in its own transaction. The resulting schema contained 38 public application tables, 68 foreign keys, 133 indexes, zero unvalidated foreign keys and zero invalid/unready indexes.

Synthetic checks on that branch confirmed:
- Product insert and unique-SKU enforcement.
- Inventory entry (+5) and exit (-2), with a final stock of 3 and two kardex rows.
- Employee insert created three history entries through the hire, compensation and contract triggers.
- Negative product stock, duplicate SKU, nonexistent product foreign key and zero movement quantity were rejected by PostgreSQL constraints.
- A multi-statement transaction that inserted a test product and then failed on an invalid foreign key rolled back completely; the first insert remained absent.

The fresh-install schema comparison identified real drift that the original 19 files did not reproduce:
- `invoice_items.unit_cost_usd NUMERIC(14,4)` existed in Development but was absent from a clean install, although the Worker references it.
- `purchase_orders.exchange_rate` was `NUMERIC(14,6)` in Development but `NUMERIC(14,4)` after the original clean migration chain.
- Development allows `billing` as an `erp_notifications.target_view`, while a clean install did not.
- Development enforces the full rejected-order audit rule (status, actor, timestamp and 5–300 character reason). A clean install retained the weaker pair-only check created by 0017 because 0018 used `IF NOT EXISTS` and did not replace the earlier constraint.

Migration `0020_align_clean_install_schema.sql` is added as a forward-only correction for those four differences. It is pinned as **pending**; it has not been executed on Development or Production. Its SQL was separately tested against the disposable clean-install branch after the 0001–0019 baseline.

The Neon managed `neon_auth` schema, its identities, the runtime role grants and the pre-existing migration ledger are environment provisioning concerns rather than app SQL migrations. The migration runner below creates the ledger only for a genuinely empty public application schema; it refuses to fabricate a baseline when app tables already exist.

## Controlled migration runner

`npm run migrate:db` is a connection preflight/check only. It performs no schema changes. Applying requires both:

- command `npm run migrate:db:apply`;
- explicit environment approval `ERP_MIGRATIONS_APPROVED=YES`.

It also requires `ERP_ENVIRONMENT=development`, `ERP_MIGRATION_BRANCH=development`, a direct (non-`-pooler`) Neon URL in `MIGRATION_DATABASE_URL`, an exact matching `ERP_EXPECTED_NEON_ENDPOINT_HOST`, database `erp_perfume`, and DDL owner role `erp_owner`.

The runner:
- takes a PostgreSQL advisory lock to serialize concurrent migration processes;
- validates source SHA-256 against the manifest before opening the database connection;
- refuses an existing Development database while historical ledger/source exceptions remain unresolved;
- refuses a non-empty app schema with a missing or empty migration ledger;
- applies each SQL file and inserts its checksum/filename/version ledger row inside the same transaction;
- rolls back the entire migration file if any statement or ledger write fails;
- never targets Production and never runs as part of the Worker deployment workflow.

A clean install can apply the canonical current source files on an empty database branch. That does not prove the historical SQL byte sequence that originally ran on Development. Development remains blocked until its historical discrepancies are reconciled with evidence.


## Live database verification — 2026-11-07

La migración `0020_align_clean_install_schema.sql` se aplicó en dos ramas Neon aisladas, nunca en Development ni Production:

- `qa-db-fresh-migrations-2026-11-07`: rama QA creada desde la rama vacía de Production; contiene la secuencia limpia 0001–0020.
- `qa-db-reliability-2026-11-07`: clon aislado de Development; conserva las filas históricas existentes y recibe únicamente 0020.

Ambas ramas verificaron el tipo `invoice_items.unit_cost_usd NUMERIC(14,4) NOT NULL`, `purchase_orders.exchange_rate NUMERIC(14,6)`, el destino de notificación `billing`, la regla completa de rechazo y la fila 0020 con su SHA-256 exacto. Tras la migración: 20 filas de ledger en la rama limpia y 17 en el clon de Development; cero claves foráneas sin validar y cero índices inválidos/no listos en ambos.

Las pruebas de datos sintéticos ejecutadas exclusivamente en la rama limpia confirmaron:
- producto QA creado con SKU único;
- entrada de inventario +5 y salida -2: existencias finales 3 y dos movimientos de kardex;
- el índice único rechazó un segundo producto con el mismo SKU;
- las restricciones rechazaron stock negativo, movimiento con cantidad cero y una referencia a producto inexistente;
- la restricción de rechazo rechazó una orden marcada como rechazada sin actor y fecha;
- la transacción que insertó un producto y luego falló por una FK dejó cero filas del producto temporal (rollback confirmado);
- un empleado sintético disparó tres eventos de historial: alta, compensación y contrato.

La comparación posterior de esquemas ya no mostró diferencias en las tablas, columnas, índices o restricciones de la aplicación entre las dos ramas QA. Las diferencias restantes son de provisión del entorno: el clon de Development contiene el esquema administrado `neon_auth`, ausente en la rama creada desde Production, y conserva permisos SQL del rol runtime que el clon limpio no recibe automáticamente. No se deben convertir esos objetos de identidad/permisos administrados en migraciones de aplicación.

Los registros sintéticos permanecen dentro de las ramas QA aisladas para que el resultado sea auditable. No se han borrado ramas ni se ha limpiado ningún entorno mediante operaciones destructivas.
