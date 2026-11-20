export const runtime = "nodejs";

import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { isNetworkKey } from "@/lib/networks";
import { decodeDataUri, localUploadPath, saveUpload } from "@/lib/uploads";
import { readJson, toPositiveInt } from "@/lib/validation";

const CATEGORIES = ["Ilustración", "Evento", "Emprendimiento", "Entretenimiento", "Otro"];
const MAX_MEDIAS = 10;

type VariantInput = { network: string; text: string };
type MediaInput = { base64: string; type: "image" | "video"; order: number };
type ScheduleInput = { runAt: string; timezone: string };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { id: "desc" },
      include: {
        variants: { orderBy: { id: "asc" } },
        medias: { orderBy: { mediaOrder: "asc" }, select: { id: true, url: true, type: true, mime: true, mediaLocation: true, mediaOrder: true } },
        schedule: true,
      },
    });

    return NextResponse.json({ ok: true, data: posts });
  } catch (err) {
    console.error("❌ Error GET /api/posts:", err);
    return NextResponse.json({ ok: false, error: "LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await readJson<{
      title: string;
      body: string;
      category: string;
      visible: boolean;
      variants: VariantInput[];
      medias: MediaInput[];
      schedule: ScheduleInput | null;
    }>(req);

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const baseBody = typeof body.body === "string" ? body.body.slice(0, 70000) : "";
    const category = typeof body.category === "string" && CATEGORIES.includes(body.category) ? body.category : "Otro";

    const variants = (Array.isArray(body.variants) ? body.variants : [])
      .filter((v): v is VariantInput => !!v && typeof v.network === "string" && isNetworkKey(v.network))
      .map((v) => ({ network: v.network, text: typeof v.text === "string" ? v.text.slice(0, 70000) : "" }));
    const uniqueNetworks = new Set(variants.map((v) => v.network));

    if (!title || variants.length === 0 || uniqueNetworks.size !== variants.length) {
      return NextResponse.json({ ok: false, error: "MISSING_TITLE_OR_VARIANTS" }, { status: 400 });
    }

    let schedule: ScheduleInput | null = null;
    if (body.schedule) {
      const runAt = new Date(String(body.schedule.runAt));
      if (Number.isNaN(runAt.getTime()) || runAt.getTime() <= Date.now()) {
        return NextResponse.json({ ok: false, error: "INVALID_SCHEDULE" }, { status: 400 });
      }
      schedule = { runAt: runAt.toISOString(), timezone: String(body.schedule.timezone || "UTC").slice(0, 64) };
    }

    // Validar todos los archivos antes de crear nada en la BD.
    const mediaInputs = (Array.isArray(body.medias) ? body.medias : []).slice(0, MAX_MEDIAS);
    let decoded;
    try {
      decoded = mediaInputs
        .filter((m) => typeof m?.base64 === "string")
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
        .map((m) => decodeDataUri(m.base64));
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
    }

    // La organización se toma del usuario, nunca del cliente.
    const organizationId = user.organizationId ?? 1;
    const initialStatus = schedule ? "SCHEDULED" : "DRAFT";

    const created = await prisma.post.create({
      data: {
        organizationId,
        authorId: user.id,
        title,
        body: baseBody,
        category,
        visible: body.visible === true,
        status: initialStatus,
        mediaBase64: null,
        variants: { create: variants.map((v) => ({ ...v, status: initialStatus })) },
        schedule: schedule ? { create: schedule } : undefined,
      },
      include: { variants: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    const base = appUrl ? (appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).replace(/\/$/, "") : null;

    for (let index = 0; index < decoded.length; index++) {
      const upload = decoded[index];
      try {
        const relativeUrl = await saveUpload(upload, "", `${created.id}-${index}-`);
        await prisma.media.create({
          data: {
            postId: created.id,
            mime: upload.mime,
            type: upload.isVideo ? "VIDEO" : "IMAGE",
            size: upload.buffer.length,
            originalBase64: null,
            url: base ? `${base}${relativeUrl}` : relativeUrl,
            mediaLocation: relativeUrl,
            mediaOrder: index + 1,
          },
        });
      } catch (err) {
        console.error("❌ Error creating Media file:", err);
      }
    }

    return NextResponse.json({ ok: true, data: { id: created.id } }, { status: 201 });
  } catch (err) {
    console.error("❌ Error POST /api/posts:", err);
    return NextResponse.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const id = toPositiveInt(new URL(req.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const post = await prisma.post.findFirst({
      where: { id, authorId: user.id },
      select: { id: true, medias: { select: { mediaLocation: true } } },
    });
    if (!post) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await prisma.$transaction([
      prisma.metric.deleteMany({ where: { postId: id } }),
      prisma.media.deleteMany({ where: { postId: id } }),
      prisma.variant.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);

    // Limpieza de archivos (no bloquea si falla).
    await Promise.all(
      post.medias.map((m) => {
        const file = localUploadPath(m.mediaLocation);
        return file ? fs.unlink(file).catch(() => {}) : undefined;
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Error DELETE /api/posts:", err);
    return NextResponse.json({ ok: false, error: "DELETE_FAILED" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await readJson<{ variantId: number; text: string }>(req);
    const variantId = toPositiveInt(body.variantId);
    if (!variantId || typeof body.text !== "string") {
      return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    }

    const variant = await prisma.variant.findFirst({
      where: { id: variantId, post: { authorId: user.id } },
      select: { id: true, status: true },
    });
    if (!variant) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (variant.status === "PUBLISHED") {
      return NextResponse.json({ ok: false, error: "ALREADY_PUBLISHED" }, { status: 409 });
    }

    const updated = await prisma.variant.update({ where: { id: variantId }, data: { text: body.text.slice(0, 70000) } });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ Error PUT /api/posts:", err);
    return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: 500 });
  }
}
