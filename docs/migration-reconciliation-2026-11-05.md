# Conciliación de migraciones — Neon Development

**Fecha de inspección:** 5 de noviembre de 2026  
**Proyecto:** `erp-perfume`  
**Base:** `erp_perfume`  
**Rama inspeccionada:** `development`

## Resultado

La tabla `public.app_schema_migrations` de Neon Development contiene las versiones `0001` a `0009`. En el árbol de `main` están versionados los archivos `0001` a `0007`; las definiciones fuente de `0008` y `0009` no están presentes en el árbol actual.

| Versión | Archivo registrado en Neon | Checksum registrado | Aplicada (UTC) |
|---|---|---|---|
| 0008 | `0008_employee_account_link.sql` | `accb56146d1e5c707e7f7336eabc1e66dc50df1bf5e316387267b030fe392842` | 2026-11-04 23:11:37 |
| 0009 | `0009_supplier_invoices_payables.sql` | `e564f8a421bd7e828f664259ff15bdaf3ce983a76b84ea15b8963d5880b17ec4` | 2026-11-04 23:30:42 |

Las versiones anteriores también figuran en el registro de Neon. No se ejecutó ninguna migración durante esta inspección.

## Estructura 0008 observada en Development

- `app_users.employee_id UUID NULL`.
- Clave foránea hacia `employees(id)`, con `ON DELETE SET NULL`.
- Índice único parcial `app_users_employee_id_unique_idx` sobre `app_users(employee_id)`, limitado a filas donde `employee_id IS NOT NULL`.

**Advertencia de procedencia:** Git conserva un archivo histórico llamado `0008_employee_user_link.sql`, eliminado después en el commit `f466167` con el mensaje de que el cambio ya existía en Development. Ese archivo no coincide con el nombre, el checksum y el nombre de índice observados en el registro/esquema actual (`0008_employee_account_link.sql` y `app_users_employee_id_unique_idx`). No debe restaurarse ni ejecutarse como si fuera el artefacto exacto aplicado.

## Estructura 0009 observada en Development

La versión registrada creó las tablas siguientes:

### `supplier_invoices`

Columnas observadas:

- `id UUID` — clave primaria.
- `supplier_id UUID NOT NULL` — referencia a `suppliers(id)`.
- `purchase_order_id UUID NULL` — referencia a `purchase_orders(id)`, `ON DELETE SET NULL`.
- `invoice_number TEXT NOT NULL`.
- `invoice_date DATE NOT NULL`; `due_date DATE NULL`.
- `currency TEXT NOT NULL` — restringida a USD/NIO.
- `exchange_rate NUMERIC NOT NULL` — mayor que cero.
- `original_amount NUMERIC NOT NULL` y `amount_usd NUMERIC NOT NULL` — mayores que cero.
- `paid_amount_usd NUMERIC NOT NULL DEFAULT 0` — entre cero y `amount_usd`.
- `status TEXT NOT NULL DEFAULT 'Pendiente'` — Pendiente, Abono parcial, Pagada o Anulada.
- `notes TEXT NULL`, `created_by UUID NULL`, `created_at` y `updated_at`.

Índices observados: unicidad por proveedor/número de factura; búsqueda por proveedor/fecha; estado/vencimiento; y orden de compra.

### `supplier_invoice_payments`

Columnas observadas:

- `id UUID` — clave primaria.
- `supplier_invoice_id UUID NOT NULL` — referencia a `supplier_invoices(id)`.
- `account_id UUID NOT NULL` — referencia a `cash_accounts(id)`.
- `currency TEXT NOT NULL` — USD/NIO.
- `original_amount NUMERIC NOT NULL`, `exchange_rate NUMERIC NOT NULL`, `amount_usd NUMERIC NOT NULL`; importes mayores que cero y tipo de cambio mayor que cero.
- `payment_reference TEXT NULL`, `paid_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_by UUID NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

Índices observados: pagos por factura/fecha y por cuenta/fecha.

El Worker enlaza el pago con un egreso de caja mediante `cash_entries.source_type = 'supplier_invoice_payment'` y `source_id` apuntando al pago; la operación también escribe auditoría.

## Tratamiento requerido

1. Mantener intacta la rama Neon Production. No se aplicó ni se recomienda aplicar ningún cambio de esquema en Production en esta etapa.
2. No volver a ejecutar 0008/0009 en Development: ambas versiones están registradas como aplicadas y sus objetos existen.
3. Recuperar los archivos SQL originales exactos de 0008/0009, o aprobar una migración de reconciliación posterior (por ejemplo, 0010) cuyo checksum y propósito estén claramente documentados.
4. Antes de una eventual migración nueva, comparar columnas, índices, restricciones y claves foráneas en Development; después registrar y verificar el resultado sin modificar datos comerciales.

Este documento describe el esquema observado; **no es un archivo ejecutable de migración** y no sustituye los SQL originales ni autoriza una reejecución.


## Versión 0010 — código automático de órdenes de compra

**Archivo fuente:** `0010_purchase_order_number_sequence.sql`  
**Checksum SHA-256:** `c42f04bca7650985eb6a2c3809cca8551edc635b73c076f5a8692efdb93736eb`

La migración agrega `public.purchase_order_number_seq` y la inicializa por encima del mayor sufijo existente con formato `JB-OC-YYYY-NNNNNN`. No modifica órdenes, recepciones ni existencias existentes. La restricción `UNIQUE` existente en `purchase_orders.order_number` se mantiene como protección final.

El Worker genera `JB-OC-YYYY-NNNNNN` dentro de la sentencia que crea la orden. La secuencia PostgreSQL asigna el valor concurrentemente; no se acepta un número proporcionado por el navegador. Los saltos numéricos son normales ante intentos inválidos o transacciones revertidas y no comprometen unicidad.
