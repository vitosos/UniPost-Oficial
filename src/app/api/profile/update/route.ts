import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/session";
import { IMAGE_TYPES, saveUpload, validateUpload } from "@/lib/uploads";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const formData = await request.formData();
    const rawName = formData.get("name");
    const file = formData.get("file");

    const updateData: { name?: string; image?: string } = {};

    if (typeof rawName === "string") {
      const name = rawName.trim().slice(0, 60);
      if (name.length < 2) {
        return NextResponse.json({ ok: false, error: "El nombre debe tener al menos 2 caracteres." }, { status: 400 });
      }
      updateData.name = name;
    }

    // Procesar imagen: se ignora el nombre de archivo del cliente, se valida el tipo
    // y se re-codifica con sharp (elimina metadatos y cualquier contenido no-imagen).
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_AVATAR_BYTES || !(file.type in IMAGE_TYPES)) {
        return NextResponse.json({ ok: false, error: "La imagen debe ser JPG, PNG, WEBP o GIF de hasta 5 MB." }, { status: 400 });
      }
      let original;
      try {
        original = validateUpload(Buffer.from(await file.arrayBuffer()), file.type);
      } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
      }
      const resized = await sharp(original.buffer).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
      updateData.image = await saveUpload({ buffer: resized, mime: "image/webp", ext: "webp", isVideo: false }, "ProfilePics", "avatar-");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: true, message: "No changes requested" });
    }

    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: updateData });
    return NextResponse.json({ ok: true, user: { name: updatedUser.name, image: updatedUser.image } });
  } catch (error) {
    console.error("profile update error:", error);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar el perfil." }, { status: 500 });
  }
}
