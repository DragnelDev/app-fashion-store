import { getValidatedQuery } from 'h3'
import { z } from 'zod'
import type { Paginado, PedidoDTO } from '../../../shared/types'
import { Order } from '../../models'
import { requireUsuario } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

/** GET /api/orders — «Mis pedidos»: pedidos de la cuenta con sesión iniciada, del más reciente al más antiguo. */
export default defineApiHandler(async (event): Promise<Paginado<PedidoDTO>> => {
  const usuario = await requireUsuario(event)
  const { page, limit } = await getValidatedQuery(event, querySchema.parse)
  const filtro = { usuarioId: usuario._id }
  const [total, items] = await Promise.all([
    Order.countDocuments(filtro),
    Order.find(filtro).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ])
  return { items: items as unknown as PedidoDTO[], total, page, limit, pages: Math.ceil(total / limit) }
})
