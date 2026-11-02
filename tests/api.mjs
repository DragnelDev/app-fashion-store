import sharp from 'sharp'
/**
 * Pruebas de integración de la API contra un servidor en ejecución.
 *
 *   BASE_URL=http://127.0.0.1:3000 ADMIN_API_KEY=<clave> node tests/e2e/api.mjs
 *
 * ⚠️ Crea datos reales (categoría, producto, pedidos): úselo SOLO con una base de datos
 * descartable y con NUXT_STORAGE_DRIVER=local. Reinicie el servidor entre ejecuciones
 * (los límites de peticiones están en memoria).
 */
const B = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const KEY = process.env.ADMIN_API_KEY ?? ''
if (!KEY) { console.error('Defina ADMIN_API_KEY (la misma de NUXT_ADMIN_API_KEY del servidor).'); process.exit(2) }
let ok = 0, fail = 0
const check = (nombre, cond, extra = '') => { cond ? ok++ : fail++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${nombre}${cond ? '' : '  -> ' + extra}`) }
const j = async (r) => { try { return await r.json() } catch { return null } }
const api = (path, { method = 'GET', body, admin = false, headers = {} } = {}) =>
  fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(admin ? { 'x-admin-key': KEY } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
const png = async (w = 800, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: '#b91c4c' } }).png().toBuffer()
const subir = async (buf, scope, admin, nombre = 'foto.png', tipo = 'image/png') => {
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: tipo }), nombre)
  return fetch(`${B}/api/upload?scope=${scope}`, { method: 'POST', body: fd, headers: admin ? { 'x-admin-key': KEY } : {} })
}

// --- Seguridad básica ---
check('categorías: POST sin clave => 401', (await api('/api/categories', { method: 'POST', body: { nombre: 'X' } })).status === 401)
check('upload producto sin clave => 401', (await subir(await png(), 'producto', false)).status === 401)

// --- Upload ---
let r = await subir(await png(2400, 1800), 'producto', true); let up = await j(r)
check('upload producto => 201 y webp ≤1600px', r.status === 201 && up.format === 'webp' && up.width === 1600 && up.url.startsWith('/uploads/producto/'), JSON.stringify(up))
const img1 = up.url
r = await fetch(B + img1); check('GET imagen subida => 200 image/webp', r.status === 200 && r.headers.get('content-type') === 'image/webp')
r = await fetch(B + '/uploads/producto/2026/..%2F..%2F..%2Fetc%2Fpasswd'); check('path traversal => 404', r.status === 404)
r = await subir(Buffer.from('esto no es una imagen'), 'producto', true, 'falso.png'); check('archivo falso .png => 415', r.status === 415, r.status)
r = await subir(Buffer.alloc(6 * 1024 * 1024, 1), 'producto', true); check('imagen > 5MB => 413', r.status === 413, r.status)
r = await subir(await png(), 'comprobante', false); const comp = await j(r)
check('upload comprobante público => 201', r.status === 201 && comp.url.startsWith('/uploads/comprobante/'), JSON.stringify(comp))

// --- Categoría y productos ---
r = await subir(await png(600, 600), 'categoria', true); const imgCat = (await j(r)).url
r = await api('/api/categories', { method: 'POST', admin: true, body: { nombre: 'Camisas Hombre', imagenUrl: imgCat } }); const cat = await j(r)
check('crear categoría => 201 con slug', r.status === 201 && cat.slug === 'camisas-hombre', JSON.stringify(cat))
r = await api('/api/categories', { method: 'POST', admin: true, body: { nombre: 'camisas hombre' } }); check('categoría duplicada => 409', r.status === 409, r.status)
r = await api('/api/categories', { method: 'POST', admin: true, body: { nombre: 'Otra', imagenUrl: 'https://evil.com/x.png' } }); check('imagen de categoría ajena => 422', r.status === 422, r.status)

const prodBody = { nombre: 'Camisa Lino Azul', descripcion: 'Camisa de lino', precio: 113, categoriaId: cat._id, imagenes: [img1],
  variantes: [{ color: 'Azul', talla: 'm', stock: 5, sku: 'VQ-LINO-AZ-M' }, { color: 'Azul', talla: 'L', stock: 3 }, { color: 'Blanco', talla: 'M', stock: 0 }] }
r = await api('/api/products', { method: 'POST', admin: true, body: prodBody }); const prod = await j(r)
check('crear producto => 201, slug y SKU autogenerado', r.status === 201 && prod.slug === 'camisa-lino-azul' && prod.variantes[1].sku.startsWith('VQ-CAM-AZU-L-') && prod.stockTotal === 8, JSON.stringify(prod).slice(0, 300))
r = await api('/api/products', { method: 'POST', admin: true, body: { ...prodBody, nombre: 'Otra camisa' } }); check('SKU duplicado entre productos => 409', r.status === 409, r.status)
r = await api('/api/products', { method: 'POST', admin: true, body: { ...prodBody, nombre: 'Mala', precio: 10.999, variantes: [{ color: 'A', talla: 'M', stock: 1 }] } }); const mal = await j(r)
check('precio con 3 decimales => 422', r.status === 422 && mal.data?.errores?.precio, JSON.stringify(mal))
r = await api('/api/products', { method: 'POST', admin: true, body: { ...prodBody, nombre: 'Misma', variantes: [{ color: 'A', talla: 'M', stock: 1, sku: 'S1' }, { color: 'a', talla: 'm', stock: 1, sku: 'S2' }] } }); check('color+talla repetidos => 422', r.status === 422, r.status)
r = await api('/api/products', { method: 'POST', admin: true, body: { ...prodBody, nombre: 'Sin img', imagenes: ['https://evil.com/a.png'], variantes: [{ color: 'A', talla: 'M', stock: 1 }] } }); check('imagen de producto ajena => 422', r.status === 422)

r = await api('/api/products'); let lista = await j(r)
check('listado => 1 producto con categoria poblada', lista.total === 1 && lista.items[0].categoria?.slug === 'camisas-hombre', JSON.stringify(lista).slice(0, 200))
check('filtro categoria + talla M (con stock)', (await j(await api('/api/products?categoria=camisas-hombre&talla=M'))).total === 1)
check('filtro talla M color Blanco (stock 0) => 0', (await j(await api('/api/products?talla=M&color=Blanco'))).total === 0)
check('filtro categoria inexistente => 0', (await j(await api('/api/products?categoria=nada'))).total === 0)
check('búsqueda q=lino', (await j(await api('/api/products?q=LINO'))).total === 1)
check('GET por slug', (await j(await api('/api/products/camisa-lino-azul'))).nombre === 'Camisa Lino Azul')
check('GET slug inexistente => 404', (await api('/api/products/nada')).status === 404)

// --- Pedidos ---
const L = prod.variantes.find((v) => v.talla === 'L').sku
const pedido = (items, extra = {}) => ({ items, email: 'ana@correo.com',
  facturacion: { tipoDocumento: 'NIT', numeroDocumento: '1023456028', razonSocial: 'Ana Rojas S.R.L.' },
  envio: { nombreDestinatario: 'Ana Rojas', telefono: '71234567', ciudad: 'La Paz', zona: 'Sopocachi', direccion: 'Av. 20 de Octubre 1234' },
  metodoPago: 'qr', ...extra })
r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: 'VQ-LINO-AZ-M', cantidad: 2 }], { comprobantePagoUrl: comp.url }) }); const o1 = await j(r)
check('pedido QR con comprobante => 201', r.status === 201 && /^VQ-\d{4}-000001$/.test(o1.numero), JSON.stringify(o1))
check('totales: 2×113=226 + envío 20 = 246; IVA 13% = 31.98 (incluido)', o1.totales.subtotal === 226 && o1.totales.envio === 20 && o1.totales.total === 246 && o1.totales.iva === 31.98 && o1.totales.importeSinIva === 214.02, JSON.stringify(o1.totales))
check('stock descontado (5 -> 3)', (await j(await api('/api/products/camisa-lino-azul'))).variantes[0].stock === 3)

r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: 'VQ-LINO-AZ-M', cantidad: 4 }]) }); const sin = await j(r)
check('sin stock suficiente => 409 con detalle', r.status === 409 && sin.data.code === 'stock_insuficiente' && sin.data.items[0].disponible === 3, JSON.stringify(sin))
check('stock intacto tras rechazo', (await j(await api('/api/products/camisa-lino-azul'))).variantes[0].stock === 3)
r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: 'NOEXISTE', cantidad: 1 }]) }); check('SKU inexistente => 409', r.status === 409)

r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: L, cantidad: 1 }], { facturacion: { tipoDocumento: 'NIT', numeroDocumento: 'ABC', razonSocial: 'X' } }) }); const inv = await j(r)
check('NIT inválido => 422 con errores por campo', r.status === 422 && inv.data.errores['facturacion.numeroDocumento'] && inv.data.errores['facturacion.razonSocial'], JSON.stringify(inv))
r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: L, cantidad: 1 }], { metodoPago: 'contra_entrega', comprobantePagoUrl: comp.url }) }); check('contra entrega con comprobante => 422', r.status === 422)
r = await api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: L, cantidad: 1 }], { comprobantePagoUrl: 'https://evil.com/p.png' }) }); check('comprobante de URL ajena => 422', r.status === 422)
check('el stock no cambió con pedidos rechazados', (await j(await api('/api/products/camisa-lino-azul'))).variantes[1].stock === 3)

// Concurrencia: 8 compradores simultáneos, 3 unidades de la talla L
const rs = await Promise.all(Array.from({ length: 8 }, () => api('/api/orders', { method: 'POST', body: pedido([{ productoId: prod._id, sku: L, cantidad: 1 }], { metodoPago: 'contra_entrega' }) })))
const estados = rs.map((x) => x.status).sort()
const aceptados = estados.filter((s) => s === 201).length
check('concurrencia: exactamente 3 de 8 pedidos aceptados', aceptados === 3 && estados.filter((s) => s === 409).length === 5, estados.join(','))
check('stock final talla L = 0 (nunca negativo)', (await j(await api('/api/products/camisa-lino-azul'))).variantes[1].stock === 0)

// Consulta y comprobante
r = await api(`/api/orders/${o1.numero}?t=${o1.token}`); const ped = await j(r)
check('GET pedido con token => 200 sin hash', r.status === 200 && ped.items[0].nombre === 'Camisa Lino Azul' && ped.items[0].precioUnitario === 113 && !('tokenAccesoHash' in ped) && ped.estadoPago === 'pendiente' && ped.estadoPedido === 'pendiente', JSON.stringify(ped).slice(0, 200))
check('GET pedido con token errado => 404', (await api(`/api/orders/${o1.numero}?t=malo`)).status === 404)
check('GET pedido sin token => 404', (await api(`/api/orders/${o1.numero}`)).status === 404)
r = await subir(await png(), 'comprobante', false); const comp2 = await j(r)
r = await api(`/api/orders/${o1.numero}/comprobante`, { method: 'PATCH', body: { token: o1.token, url: comp2.url } }); const p2 = await j(r)
check('PATCH comprobante => 200 y URL actualizada', r.status === 200 && p2.comprobantePagoUrl === comp2.url, JSON.stringify(p2).slice(0, 200))
r = await api(`/api/orders/${o1.numero}/comprobante`, { method: 'PATCH', body: { token: 'x'.repeat(20), url: comp2.url } }); check('PATCH con token errado => 404', r.status === 404)

console.log(`\n${ok} OK, ${fail} FAIL`)
process.exit(fail ? 1 : 0)
