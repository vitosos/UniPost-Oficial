export const runtime = "nodejs";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth"; 

// 1. Limpiamos el tipo de Variante (ya no lleva category/visible)
type VariantInput = {
  network: string;
  text: string;
};

type MediaInput = {
  base64: string;
  type: "image" | "video";
  order: number;
};

type ScheduleInput = {
  runAt: string;
  timezone: string;
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { id: "desc" },
      include: {
        variants: true,
        medias: true,
        schedule: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ok: true, data: posts });
  } catch (err: any) {
    console.error("❌ Error GET /api/posts:", err);
    return NextResponse.json({ ok: false, error: "LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    // 2. Recibimos category y visible en el nivel superior
    const {
      organizationId,
      title,
      body: baseBody,
      category, // 👈 Nuevo
      visible,  // 👈 Nuevo
      variants,
      medias,
      mediaBase64,
      schedule,
    }: {
      organizationId: number;
      title: string;
      body: string;
      category?: string;
      visible?: boolean;
      variants: VariantInput[];
      medias?: MediaInput[];
      mediaBase64?: string | null;
      schedule?: ScheduleInput | null;
    } = body;

    if (!title || !variants || variants.length === 0) {
      return NextResponse.json({ ok: false, error: "MISSING_TITLE_OR_VARIANTS" }, { status: 400 });
    }

    // Determinar estado inicial
    const initialStatus = schedule ? "SCHEDULED" : "DRAFT";

    // 3. Guardamos category y visible en el Post
    const created = await prisma.post.create({
      data: {
        organizationId: organizationId || user.organizationId || 1,
        authorId: user.id,
        title,
        body: baseBody || "",
        category: category || "Otro",
        visible: visible || false,
        status: initialStatus,
        mediaBase64: null,
        
        // Crear Variantes (ahora limpias de esos campos)
        variants: {
          create: variants.map((v) => ({
            network: v.network,
            text: v.text,
            status: initialStatus,
          })),
        },

        // Crear Agenda
        schedule: schedule ? {
            create: {
                runAt: schedule.runAt,
                timezone: schedule.timezone
            }
        } : undefined
      },
      include: { variants: true },
    });

    // ---- Handle medias (Lógica original intacta) ----
    const mediaInputs: MediaInput[] = Array.isArray(medias)
      ? [...medias]
      : mediaBase64
        ? [{ base64: mediaBase64, type: "image", order: 0 }]
        : [];

    mediaInputs.sort((a, b) => a.order - b.order);

    for (let index = 0; index < mediaInputs.length; index++) {
      const m = mediaInputs[index];
      if (!m.base64 || !m.base64.startsWith("data:")) continue;

      try {
        const [meta, dataPart] = m.base64.split(",");
        const mimeMatch = meta.match(/data:(.*);base64/);
        const inferredMime = mimeMatch?.[1];

        const isVideo = m.type === "video" || inferredMime?.startsWith("video/");
        const mime = inferredMime || (isVideo ? "video/mp4" : "image/jpeg");
        const mediaType = isVideo ? "VIDEO" : "IMAGE";
        const extFromMime = mime.split("/")[1] || (isVideo ? "mp4" : "jpg");
        const ext = extFromMime.split(";")[0];

        const buffer = Buffer.from(dataPart, "base64");

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `${created.id}-${m.order ?? index}-${randomUUID()}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, buffer);

        const relativeUrl = `/uploads/${filename}`;
        let absoluteUrl: string | null = null;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;

        if (appUrl) {
          const base = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
          absoluteUrl = `${base}${relativeUrl}`;
        }

        await prisma.media.create({
          data: {
            postId: created.id,
            mime,
            type: mediaType,
            size: buffer.length,
            originalBase64: null,
            url: absoluteUrl ?? relativeUrl,
            mediaLocation: relativeUrl,
            mediaOrder: typeof m.order === "number" ? m.order + 1 : index + 1,
          },
        });
      } catch (err) {
        console.error("❌ Error creating Media file:", err);
      }
    }

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Error POST /api/posts:", err);
    return NextResponse.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}

// DELETE (Intacto)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

    const id = Number(idParam);
    if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    await prisma.$transaction([
      prisma.media.deleteMany({ where: { postId: id } }),
      prisma.variant.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Error DELETE /api/posts:", err);
    return NextResponse.json({ ok: false, error: "DELETE_FAILED" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { variantId, text } = body;

    if (!variantId || text === undefined) {
      return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    }

    // Verificar que el usuario sea dueño del post (seguridad)
    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
      include: { post: true }
    });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });

    if (!variant || !user || variant.post.authorId !== user.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized or not found" }, { status: 403 });
    }

    // Actualizar texto
    const updated = await prisma.variant.update({
      where: { id: variantId },
      data: { text },
    });

    return NextResponse.json({ ok: true, data: updated });

  } catch (err: any) {
    console.error("❌ Error PUT /api/posts:", err);
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
  }
}