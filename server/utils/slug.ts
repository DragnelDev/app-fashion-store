/** "Camisa Lino Azul — Edición 2026" -> "camisa-lino-azul-edicion-2026" */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** Devuelve un slug libre agregando -2, -3… si `existe` indica que ya está tomado. */
export async function slugUnico(base: string, existe: (slug: string) => Promise<boolean>): Promise<string> {
  const raiz = slugify(base) || 'item'
  let candidato = raiz
  for (let n = 2; await existe(candidato); n++) {
    candidato = `${raiz}-${n}`
    if (n > 200) throw new Error('No se pudo generar un slug único')
  }
  return candidato
}
