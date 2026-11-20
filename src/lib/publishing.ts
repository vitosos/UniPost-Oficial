// Envoltorio común para publicar una variante en cualquier red.
// - Verifica que la variante pertenezca al post y que el post sea del usuario (evita IDOR).
// - "Reclama" la variante de forma atómica para evitar publicaciones duplicadas
//   (doble clic, "Enviar todas" + cron al mismo tiempo, etc.).
// - Si la publicación falla, restaura el estado previo.
// - Sincroniza el estado del post padre.

import { prisma } from "@/lib/prisma";
import type { NetworkKey } from "@/lib/networks";

export class PublishError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const PUBLISHING = "PUBLISHING";

export async function runPublish<T>(
  { userId, postId, variantId, network }: { userId: number; postId: unknown; variantId: unknown; network: NetworkKey },
  publish: (ctx: { postId: number; variantId: number }) => Promise<T>
): Promise<T> {
  const pid = Number(postId);
  const vid = Number(variantId);
  if (!Number.isInteger(pid) || !Number.isInteger(vid)) throw new PublishError("Datos inválidos");

  const variant = await prisma.variant.findFirst({
    where: { id: vid, postId: pid, network, post: { authorId: userId } },
    select: { id: true, status: true },
  });
  if (!variant) throw new PublishError("Publicación no encontrada", 404);
  if (variant.status === "PUBLISHED") throw new PublishError("Esta variante ya fue publicada", 409);

  const claimed = await prisma.variant.updateMany({
    where: { id: vid, status: { notIn: ["PUBLISHED", PUBLISHING] } },
    data: { status: PUBLISHING },
  });
  if (claimed.count === 0) throw new PublishError("Esta variante ya se está publicando", 409);

  try {
    const result = await publish({ postId: pid, variantId: vid });
    await prisma.variant.updateMany({ where: { id: vid, status: PUBLISHING }, data: { status: "PUBLISHED" } });
    await syncPostStatus(pid);
    return result;
  } catch (err) {
    await prisma.variant.updateMany({ where: { id: vid, status: PUBLISHING }, data: { status: variant.status === "SCHEDULED" ? "FAILED" : variant.status } });
    throw err;
  }
}

/** El post queda PUBLISHED solo cuando todas sus variantes están publicadas. */
export async function syncPostStatus(postId: number) {
  const variants = await prisma.variant.findMany({ where: { postId }, select: { status: true } });
  if (variants.length > 0 && variants.every((v) => v.status === "PUBLISHED")) {
    await prisma.post.update({ where: { id: postId }, data: { status: "PUBLISHED" } });
  }
}

/** Convierte un error de publicación en respuesta JSON uniforme. */
export function publishErrorResponse(err: unknown) {
  const status = err instanceof PublishError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Error desconocido";
  return Response.json({ ok: false, error: message }, { status });
}
