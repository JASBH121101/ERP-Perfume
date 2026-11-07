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

Los 19 archivos SQL existentes tienen hashes SHA-256 fijados en `db/migration-integrity.json`. Ese manifiesto protege la fuente que está en Git; no convierte por sí solo las excepciones históricas en verificadas.

## Qué valida el gate

Ejecuta `npm run check:db`. El script:

- exige nombres `NNNN_descripcion.sql`;
- detecta versiones duplicadas o huecos en la secuencia de archivos;
- exige correspondencia exacta entre los archivos SQL y el manifiesto;
- calcula SHA-256 sobre los bytes exactos de cada archivo, sin normalizar finales de línea;
- comprueba que cada excepción histórica tenga estado y evidencia explícitos;
- exige que las versiones registradas y las no registradas coincidan con la fotografía documentada;
- comprueba que la siguiente etiqueta de archivo calculada sea `0020`.

Este control **no certifica una conexión viva con Neon** y no autoriza aplicar la versión 0020. La ejecución de una nueva migración queda bloqueada operativamente hasta que se concilien 0012–0014, 0017 y la procedencia histórica de los checksums.

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
