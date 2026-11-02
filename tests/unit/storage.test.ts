import { describe, expect, it } from 'vitest'
import { crearCloudinaryDriver } from '../../server/utils/storage/cloudinary'
import { localDriver, PATRON_RUTA_LOCAL } from '../../server/utils/storage/local'
import { slugify } from '../../server/utils/slug'
import { generarSku } from '../../server/utils/sku'

const UUID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

describe('driver local: URLs propias', () => {
  it('acepta rutas generadas por el sistema', () => {
    expect(localDriver.esUrlPropia(`/uploads/producto/2026/${UUID}.webp`, 'producto')).toBe(true)
    expect(localDriver.esUrlPropia(`/uploads/comprobante/2026/${UUID}.webp`, 'comprobante')).toBe(true)
  })
  it('rechaza otro scope, path traversal y URLs externas', () => {
    expect(localDriver.esUrlPropia(`/uploads/producto/2026/${UUID}.webp`, 'comprobante')).toBe(false)
    expect(localDriver.esUrlPropia('/uploads/producto/2026/../../etc/passwd', 'producto')).toBe(false)
    expect(localDriver.esUrlPropia('https://evil.com/x.png')).toBe(false)
    expect(PATRON_RUTA_LOCAL.test(`producto/2026/${UUID}.png`)).toBe(false)
  })
})

describe('driver Cloudinary: URLs propias', () => {
  const driver = crearCloudinaryDriver({ cloudName: 'vestiq', apiKey: 'k', apiSecret: 's', folder: 'vestiq' })
  it('acepta https de su cloud y carpeta', () => {
    expect(driver.esUrlPropia(`https://res.cloudinary.com/vestiq/image/upload/v1/vestiq/producto/${UUID}.webp`, 'producto')).toBe(true)
  })
  it('rechaza otros clouds, http y otros scopes', () => {
    expect(driver.esUrlPropia(`https://res.cloudinary.com/otro/image/upload/v1/vestiq/producto/${UUID}.webp`, 'producto')).toBe(false)
    expect(driver.esUrlPropia(`http://res.cloudinary.com/vestiq/image/upload/v1/vestiq/producto/${UUID}.webp`, 'producto')).toBe(false)
    expect(driver.esUrlPropia(`https://res.cloudinary.com/vestiq/image/upload/v1/vestiq/categoria/${UUID}.webp`, 'producto')).toBe(false)
  })
  it('sin cloudName configurado no acepta nada', () => {
    expect(crearCloudinaryDriver({ cloudName: '', apiKey: '', apiSecret: '', folder: 'vestiq' }).esUrlPropia('https://res.cloudinary.com//image/upload/x')).toBe(false)
  })
})

describe('slug y SKU', () => {
  it('slugify quita tildes y símbolos', () => {
    expect(slugify('Camisa Lino — Edición 2026!')).toBe('camisa-lino-edicion-2026')
  })
  it('generarSku es legible y único', () => {
    const a = generarSku('Camisa Lino Azul', 'Azul', 'L')
    expect(a).toMatch(/^VQ-CAM-AZU-L-[0-9A-F]{4}$/)
    expect(generarSku('Camisa Lino Azul', 'Azul', 'L')).not.toBe(a)
  })
})
