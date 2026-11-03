# Vestiq — E-commerce de ropa para Bolivia

Nuxt 4 (Nitro full-stack) · Vue 3 · Pinia · MongoDB + Mongoose · Tailwind CSS · TypeScript · Zod

- Precios en **Bolivianos (Bs.) con IVA incluido**: el IVA (13%) es el 13% del **total facturado** y se desglosa en el checkout y en el recibo.
- Facturación con **NIT / CI / CEX / Pasaporte + Razón Social** (con complemento de CI).
- Pagos locales: **QR (Simple QR / Bisa / BCP / BNB)** con comprobante, **transferencia** y **contra entrega**.
- Imágenes con arrastrar y soltar + previsualización; **disco local en desarrollo, Cloudinary en producción** (cambio por variable de entorno).
- Stock por variante (color/talla/SKU) con **transacción de MongoDB**: descontar stock y crear el pedido es todo-o-nada, así no se vende de más aunque compren a la vez.
- **Cuentas y roles** (`admin` / `client`): cookie de sesión httpOnly firmada, contraseñas con scrypt, middlewares de ruta `auth`, `admin` y `guest`.
- **Panel `/admin`**: dashboard, CRUD de productos (imágenes + variantes), categorías y pedidos (estados, revisión de comprobantes QR).
- **Carrito en Pinia** persistido en `localStorage`, validado contra precio/stock del servidor.

## Puesta en marcha

```bash
npm install               # (no `npm ci`: el package-lock.json debe regenerarse con pinia)
cp .env.example .env      # complete NUXT_SESSION_SECRET, NUXT_ADMIN_EMAIL y NUXT_ADMIN_PASSWORD
docker compose up -d      # MongoDB como replica set (habilita las transacciones)
npm run dev               # http://localhost:3000
```

1. Al arrancar se crea el administrador con `NUXT_ADMIN_EMAIL` / `NUXT_ADMIN_PASSWORD` (solo si no existe). Ingrese en `/login`: irá a `/admin`.
2. Cree una categoría y un producto (con imágenes y variantes). Los clientes se registran en `/registro`.
3. Reemplace `public/qr/pago-qr.svg` por su QR de cobro real y complete los datos `NUXT_PUBLIC_PAGO_*`.
4. Ajuste las tarifas de envío en `shared/utils/bolivia.ts` (`TARIFAS_ENVIO_BS`; los valores incluidos son de ejemplo).

> Un `mongod` standalone también funciona en desarrollo, pero sin transacciones (usa reserva atómica por variante + compensación). En producción use Atlas o un replica set.

## Variables de entorno

Nuxt sobreescribe `runtimeConfig` en **tiempo de ejecución** con variables `NUXT_*`; no se graba ningún secreto en el build.

| Variable                                                              | Descripción                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NUXT_MONGODB_URI`                                                    | URI de MongoDB (local o Atlas). **Obligatoria en producción.**                            |
| `NUXT_SESSION_SECRET`                                                 | Firma las sesiones (≥ 32 caracteres). **Obligatoria en producción** (falla al arrancar).  |
| `NUXT_ADMIN_EMAIL` / `NUXT_ADMIN_PASSWORD`                            | Crean el primer administrador al arrancar; luego puede retirar la contraseña del entorno. |
| `NUXT_STORAGE_DRIVER`                                                 | `local` (desarrollo) o `cloudinary` (producción).                                         |
| `NUXT_CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` / `_FOLDER` | Credenciales de Cloudinary.                                                               |
| `NUXT_PUBLIC_UPLOAD_MAX_MB`                                           | Tamaño máximo por imagen (por defecto 5).                                                 |
| `NUXT_TRUST_PROXY`                                                    | `true` solo detrás de un proxy/CDN de confianza (IP real para el límite de peticiones).   |
| `NUXT_PUBLIC_PAGO_*`                                                  | Datos de cobro que se muestran al cliente (QR, banco, cuenta, titular).                   |

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
nuxt.config.ts            runtimeConfig, módulos (Pinia, Tailwind), cabeceras de seguridad
shared/                   Código común cliente + servidor
  utils/bolivia.ts          ciudades, documentos, estados y transiciones, tarifas de envío, teléfono +591
  utils/money.ts            aritmética en centavos, IVA/totales, formato Bs.
  utils/pedido.ts           reglas de estados de pedido y pago (puras, con tests)
  schemas/                  validaciones Zod (auth, pedido, producto) usadas en formularios y API
  types/                    DTOs de la API
server/
  models/                   User, Category, Product (variantes), Order (IVA, facturación, historial), Counter
  utils/auth.ts             sesiones (cookie firmada), requireUsuario / requireAdmin
  utils/orderService.ts     crearPedido (transacción) y cambiarEstadoPedido
  api/auth|products|categories|cart|orders|upload|admin/**
app/
  stores/                   Pinia: auth, cart
  middleware/               auth, admin, guest
  pages/                    /, /productos, /productos/[slug], /carrito, /checkout, /pedido/[numero],
                            /login, /registro, /cuenta, /cuenta/pedidos, /admin/**
tests/unit, tests/e2e     Vitest y pruebas de integración contra un servidor real
```

## API

| Método y ruta                                                          | Descripción                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register` · `login` · `logout`                         | Alta de cliente (rol siempre `client`), inicio y cierre de sesión.                                                                                                                                  |
| `GET /api/auth/me` · `PATCH /api/auth/me` · `PATCH /api/auth/password` | Perfil: teléfono +591, direcciones en ciudades de Bolivia, NIT/CI y razón social por defecto; cambio de contraseña.                                                                                 |
| `GET /api/products`                                                    | Filtros: `categoria`, `talla`, `color` (solo con stock), `precioMin`, `precioMax`, `q`, `orden`, `page`, `limit`.                                                                                   |
| `GET /api/products/filtros`                                            | Facetas dinámicas (colores, tallas con stock, rango de precios).                                                                                                                                    |
| `POST /api/cart/validar`                                               | Stock y precio vigentes de los ítems del carrito.                                                                                                                                                   |
| `POST /api/orders`                                                     | Crea el pedido en una **transacción**: valida stock, toma el precio de la BD, calcula envío e IVA, descuenta stock. `201 { numero, token, totales }` · `409` stock insuficiente · `422` validación. |
| `GET /api/orders` · `GET /api/orders/:numero`                          | «Mis pedidos» (sesión) · detalle por token (`?t=`) o por sesión del dueño.                                                                                                                          |
| `PATCH /api/orders/:numero/comprobante`                                | Adjunta/reemplaza el comprobante (token o sesión). Si estaba rechazado, vuelve a «pendiente».                                                                                                       |
| `POST /api/upload?scope=`                                              | `multipart/form-data` (campo `file`). `producto`/`categoria`: admin. `comprobante`: público (10/min por IP). Valida por contenido, quita EXIF, limita a 1600 px, WebP.                              |
| `/api/admin/**` (admin)                                                | Estadísticas, CRUD de productos y categorías, listado/detalle de pedidos y `PATCH /api/admin/orders/:numero` (estado del pedido y del pago).                                                        |
| `POST /api/products` · `POST /api/categories` (admin)                  | Altas.                                                                                                                                                                                              |

**Estados**: pedido `pendiente → procesando → enviado → entregado` (o `cancelado` antes del envío, que devuelve el stock); pago `pendiente / pagado / rechazado`. En QR/transferencia hay que confirmar el pago antes de enviar; en contra entrega, «entregado» registra el cobro.

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
NUXT_MONGODB_URI=mongodb://127.0.0.1:27017/vestiq_test NUXT_SESSION_SECRET=$(openssl rand -hex 32) NUXT_ADMIN_EMAIL=admin@vestiq.bo NUXT_ADMIN_PASSWORD=Clave12345 npm run build
NUXT_MONGODB_URI=mongodb://127.0.0.1:27017/vestiq_test NUXT_SESSION_SECRET=$(openssl rand -hex 32) NUXT_ADMIN_EMAIL=admin@vestiq.bo NUXT_ADMIN_PASSWORD=Clave12345 PORT=3000 node .output/server/index.mjs &
ADMIN_EMAIL=admin@vestiq.bo ADMIN_PASSWORD=<la-del-servidor> npm run test:e2e
```

## Pendiente / siguientes pasos

- **Factura electrónica oficial del SIN**: hoy el sistema captura NIT/CI + razón social y emite un recibo con el desglose del IVA. La emisión de facturas válidas exige un sistema de facturación autorizado por el SIN (proveedor o SFE).
- Correos transaccionales (confirmación y cambios de estado) y recuperación de contraseña.
- **Rate limit compartido** (Redis/WAF) si despliega varias instancias; hoy es en memoria por instancia.
- Comprobantes en Cloudinary: se suben como imágenes públicas con nombre aleatorio; para mayor privacidad use `type: authenticated` con URLs firmadas.
