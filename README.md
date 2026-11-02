# Vestiq — E-commerce de ropa para Bolivia

Nuxt 4 (Nitro full-stack) · MongoDB + Mongoose · Tailwind CSS · TypeScript · Zod

- Precios en **Bolivianos (Bs.) con IVA incluido**: el IVA (13%) es el 13% del **total facturado** y se desglosa en el checkout y en el recibo.
- Facturación con **NIT / CI / CEX / Pasaporte + Razón Social** (con complemento de CI).
- Pagos locales: **QR (Simple QR / Bisa / BCP / BNB)** con comprobante, **transferencia** y **contra entrega**.
- Imágenes con arrastrar y soltar + previsualización; **disco local en desarrollo, Cloudinary en producción** (cambio por variable de entorno).
- Stock por variante (color/talla/SKU) con **reserva atómica**: no se vende de más aunque compren a la vez.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # complete NUXT_MONGODB_URI y NUXT_ADMIN_API_KEY
npm run dev               # http://localhost:3000
```

1. Abra `/admin/productos`, pegue su `NUXT_ADMIN_API_KEY`, cree una categoría y un producto (con imágenes y variantes).
2. Reemplace `public/qr/pago-qr.svg` por su QR de cobro real y complete los datos `NUXT_PUBLIC_PAGO_*`.
3. Ajuste las tarifas de envío en `shared/utils/bolivia.ts` (`TARIFAS_ENVIO_BS`; los valores incluidos son de ejemplo).

## Variables de entorno

Nuxt sobreescribe `runtimeConfig` en **tiempo de ejecución** con variables `NUXT_*`; no se graba ningún secreto en el build.

| Variable                                                              | Descripción                                                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `NUXT_MONGODB_URI`                                                    | URI de MongoDB (local o Atlas). **Obligatoria en producción.**                          |
| `NUXT_ADMIN_API_KEY`                                                  | Clave de los endpoints de administración (cabecera `x-admin-key`).                      |
| `NUXT_STORAGE_DRIVER`                                                 | `local` (desarrollo) o `cloudinary` (producción).                                       |
| `NUXT_CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` / `_FOLDER` | Credenciales de Cloudinary.                                                             |
| `NUXT_PUBLIC_UPLOAD_MAX_MB`                                           | Tamaño máximo por imagen (por defecto 5).                                               |
| `NUXT_TRUST_PROXY`                                                    | `true` solo detrás de un proxy/CDN de confianza (IP real para el límite de peticiones). |
| `NUXT_PUBLIC_PAGO_*`                                                  | Datos de cobro que se muestran al cliente (QR, banco, cuenta, titular).                 |

### Pasar a Cloudinary

```env
NUXT_STORAGE_DRIVER=cloudinary
NUXT_CLOUDINARY_CLOUD_NAME=...
NUXT_CLOUDINARY_API_KEY=...
NUXT_CLOUDINARY_API_SECRET=...
```

No cambia ningún otro código: el endpoint `POST /api/upload` usa el driver configurado y siempre devuelve `https` (`secure_url`). Los nombres son UUID aleatorios. Las URLs que se guardan en productos, categorías y pedidos **solo se aceptan si pertenecen al driver activo** (no se pueden guardar URLs arbitrarias). Las imágenes ya subidas en local no se migran automáticamente.

## Estructura

```
nuxt.config.ts            runtimeConfig, Tailwind, almacenamiento local, cabeceras de seguridad
shared/                   Código común cliente + servidor
  utils/bolivia.ts          ciudades, tipos de documento, estados, tarifas de envío, teléfono +591
  utils/money.ts            aritmética en centavos, cálculo de IVA/totales, formato Bs.
  schemas/                  validaciones Zod (pedido, producto) usadas por el checkout y la API
  types/                    tipos de las respuestas de la API
server/
  plugins/mongodb.ts        conexión a MongoDB al arrancar (falla rápido en producción)
  models/                   User, Category, Product, Order, Counter (+ plugin de soft-delete)
  api/
    upload.post.ts          POST /api/upload?scope=producto|categoria|comprobante
    products/               GET (filtros) · POST · GET /:slug
    categories/             GET · POST
    orders/                 POST · GET /:numero?t=token · PATCH /:numero/comprobante
  routes/uploads/           sirve las imágenes del driver local
  utils/                    auth admin, rate limit, procesado de imagen (sharp), storage/, orderService
app/                      pages (index, productos/[slug], checkout, pedido/[numero], admin/productos),
                          components (ImageUploader, PagoInstrucciones, ProductCard…), composables (carrito)
tests/unit, tests/e2e     Vitest y pruebas de integración contra un servidor real
```

## API

| Método y ruta                           | Descripción                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/upload?scope=`               | `multipart/form-data` (campo `file`). `producto`/`categoria`: requiere `x-admin-key`. `comprobante`: público (10/min por IP). Valida por contenido, quita metadatos EXIF, limita a 1600 px y convierte a WebP. Devuelve `{ url, … }`. |
| `GET /api/products`                     | Filtros: `categoria` (slug), `talla`, `color` (solo con stock), `q`, `orden`, `page`, `limit`.                                                                                                                                        |
| `POST /api/products`                    | (admin) Producto con variantes `{color, talla, stock, sku?}` e imágenes ya subidas. SKU se autogenera si falta.                                                                                                                       |
| `GET/POST /api/categories`              | Listado público / alta (admin).                                                                                                                                                                                                       |
| `POST /api/orders`                      | Crea el pedido: valida variantes y stock, **toma el precio de la base de datos**, calcula envío e IVA, reserva stock. `201 { numero, token, totales }` · `409` stock insuficiente (con detalle por SKU) · `422` validación por campo. |
| `GET /api/orders/:numero?t=`            | Consulta con el token entregado al crear el pedido.                                                                                                                                                                                   |
| `PATCH /api/orders/:numero/comprobante` | `{ token, url }` adjunta/reemplaza el comprobante de pago.                                                                                                                                                                            |

## Cálculo del IVA

```
total   = subtotal (precios con IVA) + envío
IVA     = round(total × 13%)          // débito fiscal contenido en el total
sin IVA = total − IVA
```

Todo se calcula en centavos enteros (`shared/utils/money.ts`) para evitar errores de coma flotante. El servidor siempre recalcula con los precios de la base de datos; el total que ve el cliente es solo una vista previa. Se asume que el envío forma parte del importe facturado.

## Pruebas

```bash
npm test                 # unitarias: IVA, validación NIT/CI, modelos, drivers de almacenamiento
npm run typecheck

# Integración (crea datos: use una BD descartable)
NUXT_MONGODB_URI=mongodb://127.0.0.1:27017/vestiq_test NUXT_ADMIN_API_KEY=clave-de-prueba npm run build
NUXT_MONGODB_URI=mongodb://127.0.0.1:27017/vestiq_test NUXT_ADMIN_API_KEY=clave-de-prueba PORT=3000 node .output/server/index.mjs &
ADMIN_API_KEY=clave-de-prueba npm run test:e2e
```

## Pendiente / siguientes pasos

- **Factura electrónica oficial del SIN**: hoy el sistema captura los datos fiscales y emite un recibo con el desglose del IVA. La emisión de facturas válidas exige un sistema de facturación autorizado por el SIN (integración con un proveedor o con el SFE).
- **Login y roles**: el modelo `User` ya existe (rol, +591, direcciones, NIT/CI por defecto) pero los endpoints de administración se protegen con `x-admin-key` hasta implementar autenticación.
- **Panel de pedidos**: confirmar pagos (`estadoPago`) y avanzar `estadoPedido` (pendiente → procesando → enviado → entregado), con envío de correos.
- **Rate limit compartido** (Redis/WAF) si despliega varias instancias; hoy es en memoria por instancia.
- Los comprobantes de pago en Cloudinary se suben como imágenes públicas con nombre aleatorio; para mayor privacidad use `type: authenticated` con URLs firmadas.
