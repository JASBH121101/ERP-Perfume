# Database Reliability Gate — JB PARFUMS ERP

**Objetivo:** bloquear cambios accidentales en los archivos SQL y conservar una fotografía verificable del estado de Neon Development antes de certificar Inventario.

## Alcance y seguridad

El control automático implementado en el repositorio es **offline y de solo lectura**:

- No abre conexiones a Neon.
- No ejecuta archivos SQL.
- No crea, elimina ni corrige filas en `app_schema_migrations`.
- No despliega Workers ni Pages.
- Neon Production se consultó únicamente en modo lectura para confirmar que su esquema `public` tenía cero tablas de aplicación; no se ejecutó SQL ni se modificó Production.
- No necesita secretos ni agrega consumo de Actions más allá del workflow de calidad que ya existe.

El control de GitHub Actions valida que cada archivo de migración sea trazable contra el manifiesto revisado. La verificación del estado vivo de Neon se hace por separado mediante el SQL de diagnóstico incluido en `db/diagnostics/development-readiness.sql`.

## Estado observado de Neon Development

Lectura directa de `erp-perfume / erp_perfume / development` el **7 de noviembre de 2026**:

| Comprobación | Resultado |
|---|---:|
| Filas en `app_schema_migrations` | 16 |
| Versiones distintas registradas | 16 |
| Versiones registradas | 0001–0011 y 0015–0019 |
| Versiones sin fila de registro | 0012, 0013, 0014 y 0020 |
| Objetos esperados de 0012–0014 | Presentes |
| Efectos de esquema de 0020 en Development | 4 de 4 presentes con definición exacta |
| Índices agregados por 0019 | 8 de 8 presentes |
| Claves foráneas sin validar | 0 |
| Índices inválidos o no listos | 0 |
| Restricciones PK/UNIQUE en el ledger | 1 |

La versión **0019 sí está aplicada** en Development. La fila observada tiene el checksum `de223be267e647d1e31a4d3bda1e3b5918a2c317de2f46ad18575409f727e474` y fecha `2026-11-06 21:31:03 UTC`; coincide con el SHA-256 de los bytes actuales de `0019_foreign_key_supporting_indexes.sql`. Los ocho índices esperados también están presentes. La sección anterior del informe de auditoría que la llamaba pendiente era una fotografía anterior y queda corregida por esta verificación posterior.

## Hallazgos históricos que siguen abiertos

Estos casos no se deben “reparar” ejecutando otra vez los SQL ni inventando filas en el ledger:

1. **0001–0007:** `0001` y `0005` coinciden con el Git blob SHA-1 de sus fuentes actuales; `0002`, `0003` y `0004` tienen fuentes históricas exactas recuperadas de commits identificados, archivadas y verificadas contra el checksum del ledger; `0007` coincide con SHA-1 de los bytes exactos del SQL actual. **`0006` sigue bloqueada:** el artefacto histórico que coincide con el ledger contiene SQL malformado y no demuestra qué sentencia corregida llegó a ejecutarse. No se debe reejecutar ninguna de estas versiones.
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
- comprueba que la siguiente etiqueta de archivo calculada sea `0021`; `0020` está satisfecho en Development por auditoría de esquema, y sigue siendo obligatorio para instalaciones limpias.

El gate estático valida las fuentes y el manifiesto. El runner repite una auditoría viva de 55 objetos históricos, invariantes y cuatro definiciones de esquema correspondientes a 0020 antes de permitir un plan de Development. Development ya tiene esos cuatro efectos, pero no tiene una fila 0020; el runner los reconoce como satisfechos y no reejecuta la migración ni inventa una entrada de ledger. Las instalaciones limpias sí ejecutan 0020 en secuencia.

## Flujo de trabajo obligatorio para migraciones futuras

1. Crear una nueva migración con el siguiente número disponible; no modificar ni renombrar archivos ya aplicados.
2. Revisar SQL, efectos sobre datos, claves foráneas, restricciones, índices y compatibilidad con la versión actual.
3. Actualizar el manifiesto con el SHA-256 exacto y la revisión correspondiente.
4. Pasar el gate estático, la auditoría viva específica de Development y las pruebas unitarias.
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

Migration `0020_align_clean_install_schema.sql` is a forward-only correction for four differences in the clean-install schema. A fresh read-only inspection of Development confirms that all four target definitions already exist there without a 0020 ledger row. The Development runner therefore audits and skips 0020 on that exact branch; it must not be replayed or assigned a fabricated ledger row. Fresh-install branches still execute 0020 after 0001–0019. It has not been applied to Production. Its SQL was separately tested against the disposable clean-install branch.

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

También se ejecutaron las sentencias CTE equivalentes a las rutas del Worker:
- `createProduct` creó un producto con stock inicial 4 y escribió el movimiento inicial y la auditoría en la misma sentencia;
- una salida de 2 unidades cambió 4 → 2; un ajuste de inventario fijó el saldo en 5 (2 → 5); las tres operaciones mantuvieron tres movimientos y tres registros de auditoría;
- una salida superior al stock y un ajuste que no cambiaba existencias no produjeron filas ni modificaron el saldo;
- una línea de factura guardó `unit_cost_usd = 2.3456`; un costo negativo fue rechazado por la restricción;
- una orden de compra conservó `exchange_rate = 36.666666` sin perder precisión;
- una orden rechazada con actor, fecha y motivo válido fue aceptada; la variante sin actor/fecha fue rechazada;
- una notificación con destino `billing` fue aceptada por la restricción actualizada.

La comparación posterior de esquemas ya no mostró diferencias en las tablas, columnas, índices o restricciones de la aplicación entre las dos ramas QA. Las diferencias restantes son de provisión del entorno: el clon de Development contiene el esquema administrado `neon_auth`, ausente en la rama creada desde Production, y conserva permisos SQL del rol runtime que el clon limpio no recibe automáticamente. No se deben convertir esos objetos de identidad/permisos administrados en migraciones de aplicación.

Los registros sintéticos permanecen dentro de las ramas QA aisladas para que el resultado sea auditable. No se han borrado ramas ni se ha limpiado ningún entorno mediante operaciones destructivas.


## Additional certification finding — branch provisioning

The clean migration chain and the authenticated runtime are separate capabilities. A clean Neon QA branch reached schema parity for application tables, columns, indexes and constraints after 0020, but did not inherit the Development branch's managed Auth configuration or runtime role. Read-only checks confirmed:
- Development: Neon Auth present; runtime role present; 88 public table grants, 1,036 public column grants, 2 public sequence grants.
- Fresh-migration QA clone: Neon Auth absent; runtime role absent; no runtime grants.
- Development-derived QA clone: Neon Auth and runtime role present; its public application schema compared equal to Development after 0020.

The installation checklist must therefore include Neon Managed Auth provisioning and least-privilege runtime role setup as a separate branch-level step. `db/diagnostics/runtime-provisioning.sql` checks that branch even before application migrations are present. Do not put managed Auth's internal schema into application migration files and do not give the Worker an owner/admin credential. The diagnostic SQL now reports these prerequisites alongside the database integrity checks.


## Additional inventory/runtime verification — 2026-11-07

### Worker-style stock sequence on the Development-derived QA branch

On `qa-db-reliability-2026-11-07`, a single transaction exercised the inventory row-lock and movement/audit rules with a synthetic SKU:
- opening stock 4;
- entry +3 produced 7;
- sale -2 produced 5;
- absolute adjustment to 8 produced 8;
- oversell by 9 produced no update;
- adjustment to the already-current balance produced no movement;
- an inactive product could not be selected for another movement.

The assertions inside the transaction required final stock 8, exactly four valid movement rows (opening + three valid operations), and four matching audit rows. A deliberate division-by-zero statement then aborted the same transaction (SQLSTATE `22012`). A separate query found zero remaining rows for the synthetic SKU, its movement notes, and its product-creation audit. This was a rollback test, not persistent QA data.

### Concurrent stock-out test

A second isolated fixture started with stock 10. Two independent Neon transactions were launched concurrently; each selected the same product `FOR UPDATE` and attempted to issue 6 units. Both transactions completed, but PostgreSQL row locking serialized the calculation: one movement was accepted, the second saw the new balance and did not write. Observed result: final stock 4, one accepted concurrent movement, one opening movement. A cleanup transaction deleted the fixture; a follow-up query confirmed zero rows for its SKU and both movement notes.

### Runtime role exercised directly

A read-only connection using the actual Development role `jb_erp_runtime_sql` confirmed:
- the connection authenticated as `jb_erp_runtime_sql`;
- SELECT/INSERT/UPDATE on `products` are available;
- DELETE on `products` is denied;
- DELETE on `user_permission_overrides` and `role_template_permissions` is allowed;
- required SELECT column privileges on `app_users` and `neon_auth."user"` are present;
- SELECT on `app_schema_migrations` is denied.

This matches the intended runtime least-privilege boundary. No write statement was run through the Development runtime role.

### Automated repository validation

GitHub Actions run [42385634657](https://github.com/JASBH121101/ERP-Perfume/actions/runs/42385634657) completed successfully on the database reliability branch:
- 140/140 Node unit tests passed;
- 32/32 Playwright browser tests passed;
- build, static checks, Worker syntax and the offline migration source-integrity gate passed.

The eight historical cases are now covered by an explicit Development-only baseline attestation. The offline gate reports `READY_WITH_APPROVED_BASELINE_EXCEPTIONS`; the live migration runner still requires all 55 object checks and zero integrity invariants to pass before planning. This does not certify the live authenticated Worker end to end.


## Approved Development baseline reconciliation — 2026-11-07

The repository owner explicitly authorized a Development-only baseline reconciliation. This does not rewrite historical SQL checksums or create ledger rows for 0012–0014. The attestation accepts five ledger-backed historical provenance exceptions (0006, 0008, 0009, 0017, 0018) and three schema-satisfied versions without ledger rows (0012–0014), preserving their exact observed state.

The live historical object audit now covers **55 named objects across 11 migration versions**, including all eight supporting indexes from 0019. Before every normal migration preflight against the approved Development snapshot, the runner re-executes that read-only audit and requires all objects, constraints, indexes and employee-history invariants to pass. It then skips 0012–0014 because their schema effects are already present; it never inserts synthetic ledger rows or replays those SQL files.

The approved exception set is scoped to the exact Neon Development branch ID and database in the manifest. It does not apply to clean-install branches or Production. Fresh installs continue to execute every pinned migration in numeric order, including 0012–0014. Production remains blocked by the runner and must receive the same reviewed migration files through its separate release process.

Readiness is reported as `READY_WITH_APPROVED_BASELINE_EXCEPTIONS`, not as byte-for-byte historical source verification. The eight exceptions remain visible in the manifest and audit report.


## Development schema alignment for 0020 — 2026-11-07

A newer read-only inspection of the pinned Development branch confirmed all four effects represented by migration 0020 are already present: `invoice_items.unit_cost_usd` is `NUMERIC(14,4) NOT NULL DEFAULT 0` with its nonnegative check; `purchase_orders.exchange_rate` is `NUMERIC(14,6)`; `erp_notifications_target_view_check` includes `billing`; and `purchase_orders_rejection_audit_check` enforces the rejected status actor/timestamp and a trimmed reason of 5–300 characters. The `app_schema_migrations` ledger still has 16 rows and no `0020` row. The migration is therefore schema-satisfied but unregistered on Development. The baseline attestation and live audit record this separately; the runner skips it only on the pinned Development branch after all four exact checks pass. Clean installs do not inherit this exception and must execute the pinned 0020 SQL.
