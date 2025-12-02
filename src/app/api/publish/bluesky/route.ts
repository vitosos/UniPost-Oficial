import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { AtpAgent } from "@atproto/api";
import { decryptBlueskySecret } from "@/lib/cryptoBluesky";
import sharp from "sharp";

const MAX_BSKY_IMAGE_BYTES = 1_000_000; // ≈ 976.56 KiB
export const runtime = "nodejs";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.unipost.cl";

function buildHashtagFacets(text: string) {
  const facets: any[] = [];
  // Unicode letters + numbers + underscore
  const regex = /#[\p{L}\p{N}_]+/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const hashtag = match[0]; // e.g. "#Genshin"
    const startChar = match.index;
    const endChar = startChar + hashtag.length;

    const encoder = new TextEncoder();
    const fullTextBytes = encoder.encode(text);
    const beforeBytes = encoder.encode(text.slice(0, startChar));
    const hashtagBytes = encoder.encode(text.slice(startChar, endChar));

    const byteStart = beforeBytes.length;
    const byteEnd = byteStart + hashtagBytes.length;

    facets.push({
      index: {
        byteStart,
        byteEnd,
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag: hashtag.slice(1), // remove the leading '#'
        },
      ],
    });
  }

  return facets;
}

async function compressToSizeLimit(
  input: Buffer,
  mime?: string,
  maxBytes: number = MAX_BSKY_IMAGE_BYTES,
): Promise<Buffer> {
  const lowerMime = (mime || "").toLowerCase();
  const usePng = lowerMime.includes("png");

  let pipeline = sharp(input, { failOnError: false });
  const meta = await pipeline.metadata();

  const MAX_WIDTH = 2048;
  if ((meta.width ?? 0) > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH);
  }

  let quality = 85;
  let output: Buffer;

  while (true) {
    if (usePng) {
      output = await pipeline.png({ quality }).toBuffer();
    } else {
      output = await pipeline
        .jpeg({
          quality,
          mozjpeg: true,
        })
        .toBuffer();
    }

    if (output.byteLength <= maxBytes) break;

    quality -= 10;
    if (quality < 30) break; // no destruimos la imagen
  }

  if (output.byteLength > maxBytes) {
    throw new Error(
      `Could not compress image below ${maxBytes} bytes (final size: ${output.byteLength})`,
    );
  }

  return output;
}

// LÓGICA INTERNA REUTILIZABLE (Para Cron y API)
export async function publishToBlueskyInternal(userId: number, postId: number, variantId: number) {
    // 1. Obtener credenciales de usuario
    const access = await prisma.blueSky_Access.findFirst({
      where: { usuarioId: userId },
    });
    if (!access) throw new Error("No Bluesky access found for this user");

    const decryptedPassword = decryptBlueskySecret(access.appPassword);

    const agent = new AtpAgent({ service: "https://bsky.social" });
    await agent.login({
      identifier: access.nombreUsuario,
      password: decryptedPassword,
    });

    // 2. Buscar Post y Variante
    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new Error("Variant not found");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        medias: {
          orderBy: { mediaOrder: "asc" }, 
        },
      },
    });
    if (!post) throw new Error("Post not found");

    const medias = post.medias ?? [];

    const imageMedias = medias.filter(
      (m) =>
        m.type === "IMAGE" ||
        (m.mime || "").toLowerCase().startsWith("image/"),
    );
    const videoMedias = medias.filter(
      (m) =>
        m.type === "VIDEO" ||
        (m.mime || "").toLowerCase().startsWith("video/"),
    );

    // 3. Validaciones de reglas Bluesky
    if (videoMedias.length > 1) {
      throw new Error("Bluesky solo permite 1 video por post.");
    }

    if (videoMedias.length === 1 && imageMedias.length > 0) {
      throw new Error("Bluesky no permite mezclar imágenes y video en el mismo post.");
    }

    let mode: "text" | "images" | "video" = "text";

    if (videoMedias.length === 1) {
      mode = "video";
    } else if (imageMedias.length > 0) {
      mode = "images";
    }

    const selectedImages = mode === "images" ? imageMedias.slice(0, 4) : [];
    const selectedVideo = mode === "video" ? videoMedias[0] : null;

    // 4. Preparar texto y facets
    const text = (variant.text || post.body || "").toString();
    const facets = buildHashtagFacets(text);

    const record: any = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
      ...(facets.length ? { facets } : {}),
    };

    // 5. Procesar multimedia
    if (mode === "images" && selectedImages.length > 0) {
      const images: any[] = [];

      for (const media of selectedImages) {
        const mediaUrl = media.url.startsWith("http")
          ? media.url
          : `${APP_URL}${media.url}`;

        const resImg = await fetch(mediaUrl);
        if (!resImg.ok) {
          throw new Error("Could not download image for Bluesky");
        }

        const arrayBuffer = await resImg.arrayBuffer();
        let imageBuffer: any = Buffer.from(arrayBuffer);

        if (imageBuffer.byteLength > MAX_BSKY_IMAGE_BYTES) {
          imageBuffer = await compressToSizeLimit(imageBuffer, media.mime);
        }

        const blobRes = await agent.uploadBlob(new Uint8Array(imageBuffer), {
          encoding: media.mime || "image/jpeg",
        });

        images.push({
          image: blobRes.data.blob,
          alt: post.title || "Post image",
        });
      }

      record.embed = {
        $type: "app.bsky.embed.images",
        images,
      };
    }
    else if (mode === "video" && selectedVideo) {
      const videoUrl = selectedVideo.url.startsWith("http")
        ? selectedVideo.url
        : `${APP_URL}${selectedVideo.url}`;

      record.embed = {
        $type: "app.bsky.embed.external",
        external: {
          uri: videoUrl,
          title: post.title || "Video",
          description: "",
        },
      };
    }

    // 6. Crear el Post en Bluesky
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record,
    });

    console.log("Bluesky createRecord response:", response);

    const uri = response.data.uri;
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeOnly = new Date(1970, 0, 1, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    // 7. Actualizar estado en DB
    await prisma.variant.update({
      where: { id: variantId },
      data: {
        status: "PUBLISHED",
        uri: uri,
        date_sent: dateOnly,
        time_sent: timeOnly,
      },
    });

    return { ok: true, uri };
}

// HANDLER POST (Para llamadas desde el navegador/frontend)
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session)
    return Response.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );

  const { postId, variantId } = await req.json();

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email ?? "" },
    });
    if (!user) throw new Error("User not found");

    // Llamamos a la función interna
    const result = await publishToBlueskyInternal(user.id, postId, variantId);

    return Response.json(result);
  } catch (err: any) {
    console.error("Bluesky publish error:", err);
    return Response.json(
      { ok: false, error: err.message },
      { status: 400 },
    );
  }
}