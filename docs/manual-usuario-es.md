# Manual de usuario — JB PARFUMS ERP

**Versión documental:** 4 de noviembre de 2026  
**Entorno descrito:** rama de desarrollo conectada a Neon Development; no representa autorización tributaria ni despliegue productivo.

## 1. Acceso y seguridad

1. Abre el entorno de JB PARFUMS ERP y autentícate con tu cuenta.
2. El Worker valida la sesión y el perfil antes de permitir operaciones.
3. Utiliza tu propia cuenta. No compartas contraseñas ni dejes una sesión abierta en un equipo compartido.
4. Los permisos dependen del rol asignado. Si una pantalla no está disponible, solicita al propietario que revise tu rol; no intentes acceder mediante otra cuenta.

## 2. Uso de módulos

El menú incluye gestión de productos, inventario, pedidos, clientes, facturación interna, compras, proveedores, caja/finanzas, cuentas por cobrar/pagar, RR. HH., informes y control DGI. La disponibilidad de una pantalla no significa por sí sola que esté habilitada para uso fiscal o que todos sus procesos hayan sido certificados.

Registra primero los maestros necesarios (productos, clientes y proveedores). Para inventario, utiliza el flujo de movimientos y no sustituyas el historial con cambios manuales del saldo. Verifica cantidades, costos, descuentos, moneda y tipo de cambio antes de confirmar una operación.

## 3. Comprobantes internos

Los documentos que actualmente genera el módulo de facturación son **comprobantes comerciales internos, no fiscales**. La pantalla y la impresión deben conservar esta advertencia. No los entregues como factura fiscal ni cambies su leyenda.

Hasta que la DGI confirme el mecanismo aplicable, emite el comprobante fiscal o simplificado mediante el procedimiento oficial que corresponda a tu régimen.

## 4. Centro de control DGI

El área DGI permite:

- Guardar datos del contribuyente y el régimen que haya sido confirmado por la DGI.
- Registrar el número o referencia de la constancia que respalda un régimen.
- Guardar el estado de consulta/solicitud de facturación computarizada y la referencia de la respuesta.
- Archivar soportes documentales en formato PDF, JPG o PNG. El archivo se conserva en el bucket privado R2 y sus datos descriptivos en Neon.
- Exportar un libro auxiliar CSV con los movimientos disponibles para revisión.
- Vigilar ingresos registrados e inventario al costo mediante avisos informativos.

### Reglas para capturar datos DGI

- Deja el régimen en **Pendiente de confirmación** mientras no tengas constancia oficial.
- No marques **Autorización recibida** sin el número de autorización de la DGI y su fecha.
- No marques **DGI confirmó que no aplica** sin referencia de una respuesta escrita.
- Sube el respaldo correspondiente al archivo DGI e introduce su folio o número de referencia en la configuración.
- No uses el CSV como declaración tributaria. Concílialo contra facturas originales, recibos, compras, movimientos de caja y los registros que la DGI exija.

### Umbrales

Los avisos de C$100,000 y C$500,000 son controles preventivos. No bloquean ventas ni cambian automáticamente el régimen. Los cobros vinculados a facturas y los ingresos de caja sin vínculo documental se incluyen en el indicador de ingresos; estos últimos aparecen señalados para conciliación. Si un movimiento está incompleto, duplicado o mal clasificado, corrígelo en el flujo original antes de utilizar el informe.

## 5. Archivo de documentos tributarios

Para guardar un soporte:

1. Selecciona el tipo de documento.
2. Indica fecha, emisor, referencia, período y moneda.
3. Introduce el importe que aparece en el documento.
4. Adjunta un PDF, JPG o PNG de hasta 5 MB.
5. Guarda y verifica que el documento aparezca en el listado.
6. Utiliza la acción de descarga para comprobar que el archivo se recupera correctamente.

Conserva los originales fuera del ERP según los plazos y obligaciones aplicables. El archivo privado en R2 no sustituye la conservación del documento original cuando sea exigida.

## 6. Recursos Humanos

RR. HH. permanece disponible para preparar la futura administración del personal. No registres trabajadores ficticios ni calcules nómina legal hasta que existan empleados y se hayan configurado los datos, deducciones, prestaciones e inscripciones requeridas.

## 7. Errores y soporte

Si una operación falla, conserva el mensaje, fecha, módulo y referencia del registro. No repitas varias veces un pago, una compra o una factura sin comprobar primero si el primer intento se guardó. Notifica al administrador para revisar el registro y la auditoría.

## 8. Advertencia de entorno

Los datos de esta etapa pertenecen a Neon Development y al Preview de la rama de desarrollo. No introduzcas datos reales de clientes o empleados hasta que se confirme la configuración de producción, copias de seguridad, permisos y recuperación.
