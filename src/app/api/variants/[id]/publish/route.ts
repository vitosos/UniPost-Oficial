// src/app/api/variants/[id]/publish/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

// Simula publicación de una variante
export async function POST(_req: Request, { params }: Params) {
  try {
    // Generar ID simulado de publicación externa
    const externalId = `mock-${Date.now()}`;

    // Actualiza la variante como publicada y crea log
    const updated = await prisma.variant.update({
      where: { id: Number(params.id) },
      data: {
        status: 'PUBLISHED',
      },
      include: {
        post: true,
      },
    });

    // Verifica si todas las variantes del post ya se publicaron
    const remaining = await prisma.variant.count({
      where: { postId: updated.postId, status: { not: 'PUBLISHED' } },
    });

    if (remaining === 0) {
      await prisma.post.update({
        where: { id: updated.postId },
        data: { status: 'PUBLISHED' },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Variante publicada con ID externo ${externalId}`,
      data: updated,
    });
  } catch (err) {
    console.error('❌ Error POST /api/variants/[id]/publish:', err);
    return NextResponse.json(
      { ok: false, error: 'PUBLISH_FAILED' },
      { status: 500 }
    );
  }
}
