# Prestaciones y comisiones de Recursos Humanos

## Alcance

Esta implementación está pensada para el uso interno de JB Parfums. No cambia la contabilidad de producción ni despliega el sistema. La migración `0011_hr_benefits_commissions.sql` debe aplicarse en Neon Development antes de desplegar los cambios de Worker y frontend.

## Antigüedad

Se obtiene desde `employees.hire_date` y se presenta como años, meses y días calendario. No se guarda un contador que pueda desincronizarse: el valor se recalcula con la fecha actual.

## Vacaciones

El saldo de gestión se calcula a razón de 2.5 días por mes de servicio (15 días por cada seis meses, equivalencia del artículo 76 del Código del Trabajo). Se descuentan solicitudes de vacaciones aprobadas cuando su fecha final ya transcurrió. Las solicitudes pendientes, rechazadas o futuras no consumen saldo. El saldo no se reinicia al pagar nómina.

La remuneración de vacaciones con salario variable exige una base distinta a la de salario fijo; el artículo 78 establece el promedio ordinario de los últimos seis meses para salario variable. El cálculo monetario de vacaciones no disfrutadas en una liquidación no se incluye aún en este cambio.

## Aguinaldo

El ERP presenta una provisión estimada y permite crear un período de nómina tipo `Aguinaldo`. El cálculo usa como ciclo de referencia del pago anual el 1 de diciembre al 30 de noviembre, prorratea según el tiempo computable y exige más de un mes de servicio. En salario fijo usa el último salario mensual registrado. Para empleados con remuneración por comisión usa el mayor salario ordinario mensual agregado entre las planillas pagadas de los seis meses anteriores; si no hay historial, muestra una estimación con el salario fijo registrado.

El período especial no aplica INSS ni deducciones ordinarias al decimotercer mes, conforme al artículo 97. El artículo 94 regula el salario variable y el 95 la fecha de pago.

La referencia 1 dic–30 nov es el ciclo operativo usado por esta implementación para preparar el pago en diciembre; debe validarse con el contador/asesor laboral cuando se configure el negocio.

## INSS

Se pueden seleccionar estas combinaciones publicadas por el INSS:

| Modalidad | Menos de 50 trabajadores | 50 o más trabajadores |
|---|---:|---:|
| Integral | Trabajador 7%, patronal 21.5% | Trabajador 7%, patronal 22.5% |
| IVM-RP | Trabajador 5%, patronal 15.5% | Trabajador 5%, patronal 16.5% |

El sistema almacena la modalidad, aplica las tasas a salario base + bonos + comisiones en nómina ordinaria, descuenta solo el componente laboral del neto y reporta el patronal como costo adicional del empleador. Los períodos ya pagados conservan los importes calculados en su momento.

La modalidad seleccionada debe coincidir con la afiliación real del empleador ante el INSS. No se incluyen IR, INATEC ni otros conceptos tributarios en este cambio.

## Comisiones

1. En la ficha del colaborador se activa `Gana comisión` y se define el porcentaje.
2. Al generar una factura se elige el vendedor responsable. La selección es opcional para ventas sin comisión.
3. Si hay vendedor comisionista, todos los productos de la factura deben tener costo unitario mayor que cero.
4. Se calcula por renglón: `max(0, venta neta después del descuento asignado - costo unitario × cantidad) × porcentaje`.
5. El descuento de factura se distribuye por renglón proporcionalmente al valor de venta. El cargo de entrega no forma parte de la base.
6. La comisión devengada se conserva en USD, igual que la venta y el costo. Se guarda una fotografía de costo, precio, descuento, utilidad, porcentaje y tipo de cambio de la venta en `employee_commissions`; cambios posteriores no alteran ventas históricas.

Al crear un período ordinario se define su tasa USD/NIO. Esa tasa queda congelada para todos los colaboradores del período. Las comisiones pendientes, almacenadas en USD, se convierten a córdobas con esa tasa y el renglón de nómina guarda tanto el monto original USD como el monto C$ y la tasa aplicada. El salario base y la nómina se pagan en córdobas. Las comisiones pendientes de cada vendedor se asignan una única vez a un período ordinario que abarque la fecha de venta. Al pagar el período pasan a `Pagada`; al anularlo regresan a `Pendiente`. El historial no se elimina ni se reinicia manualmente.

## Límites de esta entrega

- El cálculo de comisiones se dispara al crear la factura (también cuando el cobro es parcial o queda a crédito); no espera a que el cliente termine de pagar.
- No se recalculan comisiones de facturas históricas anteriores a la migración.
- El costo, la tasa de comisión y la tasa USD/NIO de la venta quedan congelados en el ledger. La conversión a C$ de nómina usa la tasa fijada al crear el período; para corregir una venta anterior se requerirá un flujo de reversión/auditoría, no edición manual del ledger.
- Las cifras son herramientas internas de control; el cálculo final de planillas y obligaciones debe revisarse con el contador o asesor laboral conforme al régimen real de JB Parfums.
