# JB PARFUMS ERP — expediente de cumplimiento DGI (Nicaragua)

**Fecha de revisión:** 4 de noviembre de 2026  
**Alcance:** uso interno del ERP de JB PARFUMS y preparación para una eventual autorización de facturación computarizada. Este documento no constituye dictamen legal ni autorización de la DGI.

## 1. Decisión de diseño

El ERP debe mantener separados tres conceptos:

1. **Registro operativo interno:** catálogo, compras, inventario, clientes, pedidos, cobros, gastos y reportes de gestión.
2. **Comprobante comercial interno:** impresión o consulta que documenta la operación dentro del ERP. Debe conservar de forma visible la leyenda **“COMPROBANTE INTERNO · NO FISCAL”** y no presentarse como factura fiscal.
3. **Factura computarizada fiscal:** solo se habilitará después de que JB PARFUMS confirme con la Administración de Rentas correspondiente si ese mecanismo aplica a su régimen y, cuando corresponda, obtenga la autorización previa de la DGI.

La Disposición Técnica 09-2007 regula el uso de sistemas computarizados para emitir facturas que soportan ventas y servicios. No debemos convertir automáticamente el módulo interno en emisor fiscal ni afirmar que la autorización ya existe.

## 2. Requisitos de la Disposición Técnica 09-2007

El texto consultado señala que el uso de medios electrónicos para emitir facturas requiere autorización previa de la DGI. Para el expediente del sistema enumera:

- Fecha prevista de inicio de uso.
- Nombre del sistema y lenguaje de desarrollo.
- Indicación de si el contribuyente posee los programas fuente.
- Módulos integrados y descripción de cada uno.
- Identificación del autor o proveedor: nombre, RUC o cédula cuando corresponda, domicilio, país, teléfono y correo electrónico.
- Controles de acceso por usuario y contraseña.
- Respaldo diario de la información.
- Manual técnico y manual de usuario en español.
- Comunicación previa a la DGI de los cambios del sistema y de la suspensión o cancelación de su uso, según el texto de la disposición.
- Numeración de facturas consecutiva e inalterable.
- Muestra de la factura y cumplimiento de las formalidades aplicables.

Para devoluciones o anulaciones efectuadas en días posteriores a la factura original, la disposición contempla nota de crédito. Cuando el sistema está integrado con inventario, la reversión debe quedar respaldada por un comprobante de movimiento consecutivo, fechado y con el concepto de la operación. Debe preservarse el rastro del documento original.

**Importante:** la disposición es de 2007. Antes de activar facturación fiscal se debe contrastar su aplicación práctica con la DGI y con las reformas tributarias posteriores. Este ERP todavía no tiene un módulo de facturación fiscal autorizado ni numeración fiscal aprobada.

## 3. Régimen de Cuota Fija: condiciones que el ERP debe vigilar

El texto de la Ley 822 consultado en La Gaceta del 17 de diciembre de 2012 contiene estas reglas. La Ley 1279, publicada el 9 de abril de 2026, reformó los artículos 126, 157, 167 y 171 y derogó una disposición relacionada con esos tributos indirectos; el texto consultado de esa reforma no modifica los artículos 251, 256, 258 ni 259 descritos abajo:

- **Artículo 251:** ingresos por ventas mensuales iguales o menores a C$100,000 **y** costo de inventario no mayor a C$500,000. El texto legal consultado usa ambos requisitos conjuntamente.
- **Artículo 256:** cuando durante seis meses, en promedio, los ingresos mensuales percibidos superen C$100,000, el contribuyente debe informarlo a la Administración Tributaria dentro de los 30 días calendario posteriores a la ocurrencia para el traslado al régimen general.

**Advertencia de interpretación:** una FAQ antigua alojada por la DGI resume la elegibilidad con un “o” entre ingresos e inventario, mientras que el texto del artículo 251 de la Ley 822 consultado utiliza “y”. No se debe basar la inscripción en esa FAQ desactualizada o inconsistente. La Administración de Rentas debe aclarar por escrito el criterio vigente que aplicará al caso de JB PARFUMS. Hasta recibir esa confirmación, el ERP mantiene el régimen como pendiente.
- **Artículo 258:** inscripción en RUC y Cuota Fija; factura simplificada a solicitud del comprador; registros simplificados de ingresos y gastos; inventario respaldado con facturas formales de proveedores inscritos; certificado de inscripción exhibido o disponible; conservación cronológica de facturas originales de compras/servicios, soportes de alquiler e impuestos municipales y comprobantes de pagos tributarios.
- **Artículo 259:** el texto consultado indica que el contribuyente de Cuota Fija no traslada IVA y no presenta las declaraciones ordinarias allí enumeradas, sin perjuicio de pagar su cuota.

El módulo de alertas del ERP no bloquea operaciones ni cambia el régimen automáticamente. La métrica de ingresos es un indicador preventivo formado por cobros registrados más ingresos de caja sin vínculo documental, sin duplicar cobros que ya estén asociados a una factura. Incluir movimientos sin clasificar reduce el riesgo de subestimar, pero también puede sobreestimar si alguno corresponde a aportes de capital, préstamos o transferencias que no son ventas. Por eso se muestran por separado y deben clasificarse y conciliarse antes de utilizar el valor para una decisión tributaria. La clasificación final, los ajustes y el criterio de cómputo deben confirmarse con la DGI o un contador.

### Datos del negocio que deben confirmarse

- JB PARFUMS opera como persona natural, según la información proporcionada por su titular.
- El inventario se compra a proveedores ubicados en Nicaragua y no mediante importación directa, según la información proporcionada.
- La ubicación prevista es un garaje dentro de una vivienda en Granada.
- No hay empleados por el momento.

La Ley 822 consultada excluye a importadores y exportadores y también menciona ubicaciones en centros comerciales, plazas de compras y localidades similares. Comprar a un proveedor nicaragüense no equivale, por sí solo, a importar directamente. Sin embargo, la DGI debe confirmar la elegibilidad concreta y la Alcaldía de Granada debe confirmar matrícula, uso de suelo y condiciones del establecimiento doméstico. No se presume que un garaje residencial esté aprobado ni excluido.

## 4. Preguntas que debe responder la Administración de Rentas de Granada

Antes de cerrar el diseño fiscal, solicitar respuesta escrita o constancia con fecha y referencia para estas preguntas:

1. Si JB PARFUMS utiliza el ERP únicamente para inventario, pedidos, compras, clientes, ingresos/gastos y reportes internos, mientras emite la factura simplificada por el mecanismo/documento que indique la DGI, ¿se requiere autorización bajo la Disposición Técnica 09-2007?
2. ¿Qué formato y procedimiento vigente debe utilizar JB PARFUMS para emitir la factura simplificada cuando la solicita el comprador?
3. ¿Qué registros simplificados de ingresos y gastos espera la DGI y qué período/columnas deben contener?
4. ¿Qué documentación exige para confirmar elegibilidad de una persona natural que revende perfumes comprados a proveedores nacionales desde un establecimiento en una vivienda?
5. ¿Qué procedimiento, formulario, canal y documentos vigentes se requieren para pedir autorización si en el futuro se decide emitir facturas computarizadas desde el ERP?
6. ¿Qué cambios de versión, módulos, numeración, formatos o infraestructura deben notificarse antes de aplicar una modificación autorizada?

**No registrar el estado como “Cuota Fija confirmada”, “facturación autorizada” o “no aplica” sin la referencia de la constancia o respuesta oficial.**

## 5. Regulación sanitaria de perfumes y productos cosméticos (MINSA / ANRS)

Los perfumes se encuentran dentro de la categoría regulatoria de productos cosméticos. La Dirección de Farmacia de la Autoridad Nacional de Regulación Sanitaria (ANRS/MINSA) publicó guías vigentes de 2026 para solicitudes de licencia sanitaria de establecimientos que realizan actividades con productos regulados, incluyendo cosméticos. La guía comprende establecimientos fabricantes, exportadores, importadores y distribuidores/comercializadores. También existe una guía específica para la inscripción sanitaria de productos cosméticos.

**No se puede concluir únicamente con esas guías que una tienda minorista pequeña que revende perfumes terminados comprados a distribuidores nicaragüenses deba obtener la misma licencia sanitaria de un distribuidor/importador mayorista.** El encuadre depende de la clasificación que ANRS asigne a la actividad y del tipo de establecimiento. Hay que pedir confirmación por escrito antes de abrir o ampliar la actividad desde el garaje residencial.

### Preguntas para ANRS / Dirección de Farmacia

1. Si JB PARFUMS solo vende al consumidor final perfumes terminados, sellados y con registro sanitario vigente, comprados a proveedores nacionales autorizados, sin importar, fabricar, reenvasar, rellenar ni distribuir al por mayor, ¿el punto de venta minorista se clasifica como “comercializador” sujeto a licencia sanitaria de establecimiento?
2. ¿La licencia requiere regente farmacéutico o responsable profesional para este modelo minorista, o ese requisito corresponde a distribuidores/importadores y otros establecimientos de mayor alcance?
3. ¿Se requiere inspección, condiciones físicas específicas, uso de suelo o documentación municipal adicional cuando el punto de venta está en el garaje de una vivienda?
4. ¿Qué documentos debe entregar el proveedor local para acreditar que cada perfume tiene inscripción/registro sanitario vigente en Nicaragua y que el proveedor está habilitado para comercializarlo?
5. ¿Cómo se verifica la vigencia del registro sanitario del producto en el sistema oficial Karplus/ANRS y qué debe hacerse si el proveedor no facilita el número?

### Controles operativos recomendados

- Solicitar y conservar factura formal del proveedor nacional, con nombre y RUC del proveedor, fecha, detalle del producto y referencia del documento.
- Pedir al proveedor el número de registro sanitario de cada producto y evidencia de vigencia/autorización para el mercado nicaragüense; verificarlo por los canales de ANRS.
- Conservar fotos de la etiqueta, fabricante, titular, país de origen, lote y presentación comercial, asociadas al SKU/lote cuando la información esté disponible.
- Vender el producto en su empaque original, sellado y etiquetado. No decantar, rellenar, reetiquetar, fraccionar ni usar marca propia hasta confirmar requisitos sanitarios específicos.
- No asumir que el registro del proveedor cubre automáticamente todos los productos o todas las presentaciones; comprobar cada producto y presentación relevante.

La guía de inscripción sanitaria de productos cosméticos enumera requisitos de expediente como titular, fabricante, distribuidor, responsable profesional, fórmula, especificaciones y muestras de etiqueta/empaque. Estos son requisitos del trámite de registro del producto y no deben trasladarse sin más a la tienda minorista: normalmente el registro de producto se gestiona por su titular/importador/fabricante, según el caso. JB PARFUMS debe exigir la prueba de registro al proveedor/titular, no solicitar un registro de producto por su cuenta sin confirmar su rol.

## 6. Registro de programa de cómputo en MIFIC

MIFIC informa que la protección de derecho de autor no depende del registro: nace cuando la obra original está creada y fijada en un medio material. El registro voluntario ante el RPI/ONDAX puede servir como medio probatorio.

El formulario DDADX6 solicita datos del autor, titular de derechos patrimoniales y obra, incluyendo título, año, descripción, plataforma y herramientas. La página de MIFIC consultada publica requisitos de formulario, copia de cédula, programa en formato digital/físico y pago; también muestra una tarifa publicada de US$100 para registro de programas de cómputo. **Confirmar tarifa y requisitos al momento del trámite.**

Este registro es una protección de propiedad intelectual, no sustituye la autorización fiscal de la DGI. No se ha presentado ninguna solicitud en nombre del titular.

## 7. Controles técnicos: estado y trabajo pendiente

| Control | Estado del ERP en la rama de desarrollo |
|---|---|
| Separación de comprobante interno y factura fiscal | Implementada en la interfaz: los comprobantes actuales se marcan “NO FISCAL” |
| Inicio de sesión y perfiles de acceso | Integrado en la arquitectura; validar usuarios y roles en el Preview |
| Auditoría de operaciones y documentos DGI | Existe tabla de auditoría y eventos para operaciones/documentos |
| Archivo de soportes de compras, servicios y tributos | Implementado con metadatos en Neon y archivo privado en R2 |
| Indicadores de ingresos e inventario | Implementados como alertas informativas; ingresos sin vínculo se incluyen para evitar subestimación |
| Bloqueo de confirmación de régimen sin referencia | Implementado en el backend de esta rama |
| Bloqueo de estado “autorizado” sin número DGI | Implementado en el backend de esta rama |
| Numeración fiscal consecutiva e inalterable | Pendiente; no activar emisión fiscal |
| Nota de crédito y reversión fiscal de inventario | Pendiente; no activar emisión fiscal |
| Manual de usuario y manual técnico en español | Incluidos en este repositorio; deben mantenerse sincronizados con cada versión |
| Respaldo diario de datos y prueba de restauración | Workflow opcional de backup cifrado preparado hacia R2 existente; desactivado por defecto. Falta configurar secretos, realizar una ejecución y probar restauración en una base aislada |
| Procedimiento de contingencia para facturación autorizada | Pendiente de aprobación y prueba con el procedimiento que indique la DGI |
| Muestra de factura fiscal y número de autorización | No disponible; solo preparar cuando la DGI confirme el mecanismo |

## 8. Fuentes consultadas

- DGI, Disposición Técnica 09-2007: https://nicaragua.justia.com/nacionales/normas-tecnicas/requisitos-para-uso-de-sistemas-de-facturacion-computarizadas-jul-16-2007/gdoc/
- DGI, preguntas frecuentes sobre sistemas de facturación computarizados (página antigua; confirmar vigencia): https://www.dgi.gob.ni/FAQ/otros_tramites.htm
- Ley 822, publicación en La Gaceta No. 241, 17-12-2012 (texto oficial alojado por INE): https://www.ine.gob.ni/DGE/digesto/leyes/Ley822.pdf
- Ley 1279, publicada en La Gaceta No. 61, 09-04-2026 (reforma de otros artículos de la Ley 822): https://ni.vlex.com/vid/ley-n-1279-ley-1116239578
- DGI, aviso sobre guía del Régimen de Cuota Fija y SACFI: https://www.dgi.gob.ni/ (localizar la guía vigente antes de operar)
- MINSA / ANRS, Dirección de Farmacia y guías regulatorias vigentes: https://www.minsa.gob.ni/publicaciones/direccion-general-de-regulacion-sanitaria/direccion-de-farmacia
- MINSA / ANRS, guía de usuario para solicitudes de licencia sanitaria de establecimientos (versión 2026): https://www.minsa.gob.ni/sites/default/files/publicaciones/Versi%C3%B3n%2001%20M1-A-LIC-DF-DL-G01%20GU%C3%8DA%20DEL%20USUARIO%20PARA%20SOLICITUDES%20DE%20LICENCIA%20SANITARIA.pdf
- MINSA / ANRS, guía de usuario para inscripción sanitaria de productos cosméticos: https://www.minsa.gob.ni/sites/default/files/publicaciones/Rev.%2001%20M1-A-REG-DF-DRS-G03%20Gu%C3%ADa%20usuario%20presentar%20solicitud%20Inscripci%C3%B3n%20Sanitaria%20Cosmeticos_0.pdf
- MIFIC, servicios de Derechos de Autor: https://www.mific.gob.ni/Inicio/Servicios/Servicios-RPI/Servicios-deDerechos-de-Autor
- MIFIC, formulario DDADX6 para programa de cómputo: https://www.mific.gob.ni/Portals/0/Documentos/DGRPI/ONDADX/FORMULARIOS/Formulario%20Solicitud%20Programa%20de%20Computo%20DDADX6.pdf

**Respaldo:** se añadió un workflow de copia lógica diaria cifrada desde Neon Development a un prefijo privado del R2 existente. Está desactivado por defecto; requiere secretos de GitHub Actions, activación expresa, ejecución satisfactoria y prueba de restauración antes de declarar que cumple el control de respaldo. Véase `docs/backup-restore-es.md`.

**Regla de publicación:** esta rama de desarrollo no significa que la DGI haya aprobado el sistema. No emitir documentos fiscales desde el ERP sin confirmación y autorización aplicables.
