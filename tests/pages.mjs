/**
 * Comprueba que las páginas renderizan en el servidor con datos reales.
 * Ejecutar DESPUÉS de tests/e2e/api.mjs (usa el producto que este crea).
 *   BASE_URL=http://127.0.0.1:3000 node tests/e2e/pages.mjs
 */
const B = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
let ok = 0, fail = 0
const check = (n, c, x = '') => { c ? ok++ : fail++; console.log(`${c ? 'OK  ' : 'FAIL'} ${n}${c ? '' : '  -> ' + x}`) }
const html = async (path) => { const r = await fetch(B + path); return { status: r.status, text: await r.text() } }

const lista = await (await fetch(B + '/api/products')).json()
const prod = lista.items[0]
const M = prod.variantes.find((v) => v.talla === 'M' && v.color === 'Azul')
const r = await fetch(B + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  items: [{ productoId: prod._id, sku: M.sku, cantidad: 1 }], email: 'z@z.com',
  facturacion: { tipoDocumento: 'CI', numeroDocumento: '4567890', complemento: '1a', razonSocial: 'Zeke Prueba' },
  envio: { nombreDestinatario: 'Zeke Prueba', telefono: '71234567', ciudad: 'Cochabamba', zona: 'Cala Cala', direccion: 'Av. Oquendo 100' }, metodoPago: 'qr' }) })
const o = await r.json()
check('pedido de prueba creado', r.status === 201, JSON.stringify(o))

let p = await html('/'); check('GET / renderiza catálogo con producto y precio', p.status === 200 && p.text.includes('Camisa Lino Azul') && /Bs\s?113,00/.test(p.text.replace(/&nbsp;|\u00a0/g, ' ')), p.status)
p = await html('/?categoria=camisas-hombre&talla=M'); check('GET / con filtros', p.status === 200 && p.text.includes('Camisa Lino Azul'))
p = await html('/productos/camisa-lino-azul'); check('GET /productos/:slug', p.status === 200 && p.text.includes('IVA incluido') && p.text.includes('Talla'))
p = await html('/productos/no-existe'); check('GET producto inexistente => 404', p.status === 404)
p = await html('/checkout'); check('GET /checkout (carrito vacío en SSR)', p.status === 200 && p.text.includes('Su carrito está vacío'))
p = await html(`/pedido/${o.numero}?t=${o.token}`)
const t = p.text.replace(/<!--.*?-->/g, '').replace(/&nbsp;|\u00a0/g, ' ')
const needles = [o.numero, 'IVA 13%', '4567890-1A', 'Zeke Prueba', 'Pago por QR']
const faltan = needles.filter((n) => !t.includes(n))
check('GET /pedido con token: recibo, IVA 13% y datos fiscales', p.status === 200 && faltan.length === 0, 'faltan: ' + JSON.stringify(faltan) + ' | fragmento: ' + (t.match(/IVA[^<]{0,40}/g) || []).join(' || ') + ' | ' + (t.match(/CI[^<]{0,30}4567890[^<]{0,10}/g) || []).join(' || '))
p = await html(`/pedido/${o.numero}?t=incorrecto`); check('GET /pedido con token errado => mensaje de no encontrado', p.text.includes('No encontramos este pedido'))
p = await html('/admin/productos'); check('GET /admin/productos', p.status === 200 && p.text.includes('Clave de administración'))
p = await html('/qr/pago-qr.svg'); check('QR de ejemplo servido', p.status === 200 && p.text.includes('<svg'))
console.log(`\n${ok} OK, ${fail} FAIL`); process.exit(fail ? 1 : 0)
