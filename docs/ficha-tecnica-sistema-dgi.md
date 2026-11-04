# Ficha técnica del sistema — JB PARFUMS ERP

**Documento preparatorio; no es una solicitud presentada ni una autorización DGI.**

| Dato solicitado en el expediente | Información preparada |
|---|---|
| Nombre del sistema | JB PARFUMS ERP |
| Tipo | Sistema web de gestión comercial / ERP |
| Idioma de la interfaz | Español |
| Lenguaje(s) de desarrollo | JavaScript, HTML y CSS en interfaz y Worker |
| Plataforma de ejecución | Navegador web y servicios web en Cloudflare |
| Base de datos | PostgreSQL alojado en Neon |
| Archivos | Cloudflare R2 privado |
| Módulos integrados | Catálogo, productos, inventario/kardex, clientes, proveedores, compras, pedidos, comprobantes internos, cuentas por cobrar/pagar, caja/finanzas, RR. HH., informes y control DGI |
| Código fuente | Repositorio privado de GitHub bajo titularidad del propietario; indicar cómo se facilitará a los auditores cuando la DGI lo solicite |
| Autor / desarrollador | **Pendiente de completar con los datos legales correctos de la persona autora o autores** |
| Titular de derechos patrimoniales | **Pendiente de confirmar con documentos de titularidad/cesión cuando corresponda** |
| RUC / cédula / domicilio / teléfono / correo del autor o proveedor | **No incluir hasta completar desde documentos oficiales del titular** |
| Fecha prevista de inicio de uso | Pendiente de definir con la DGI |
| Fecha de adquisición | No aplica si se documenta como desarrollo propio; confirmar si existen servicios o componentes de terceros con licencia |
| Sistema de facturación computarizada | No habilitado. Los comprobantes actuales son internos y no fiscales |
| Número de autorización DGI | No existe / no solicitado a la fecha de este documento |
| Manual técnico en español | `docs/manual-tecnico-es.md` |
| Manual de usuario en español | `docs/manual-usuario-es.md` |

## Descripción para la solicitud

JB PARFUMS ERP es una aplicación web de administración de una actividad comercial de perfumería. Permite mantener un catálogo, registrar compras y proveedores, administrar inventario mediante movimientos, gestionar clientes y pedidos, registrar comprobantes comerciales internos, administrar cobros/pagos y consultar indicadores de gestión. Incluye un módulo de RR. HH. y un centro de control documental y tributario.

La aplicación utiliza una interfaz web en JavaScript y una API en Cloudflare Worker. Los datos operativos se almacenan en PostgreSQL (Neon) y los archivos se guardan en un bucket privado de Cloudflare R2. El acceso se controla mediante autenticación y perfiles de autorización del ERP.

**Limitación a declarar:** el módulo de facturación vigente genera comprobantes comerciales internos marcados expresamente como “NO FISCAL”. No se debe declarar que el sistema emite facturas fiscales, ni completar fecha de inicio de facturación computarizada, numeración o autorización, hasta obtener indicación formal de la Administración Tributaria.

## Datos que debe completar el titular

- Nombre legal completo del autor o autores, tal como aparece en su documento de identidad.
- Número de identificación y RUC, únicamente cuando la DGI los solicite.
- Domicilio, teléfono y correo de contacto para el expediente.
- Titular legal de los derechos patrimoniales y prueba de titularidad o cesión, si existe más de un autor.
- Fecha exacta de inicio de uso que se someterá a la DGI.
- Confirmación de disponibilidad del programa fuente y modalidad para ponerlo a disposición de auditoría.
- Número y fecha de autorización, solo si la DGI la otorga.

No se deben inventar ni autocompletar estos datos a partir del nombre comercial o del nombre del repositorio.
