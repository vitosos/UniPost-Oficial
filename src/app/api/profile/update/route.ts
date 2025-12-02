import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const file = formData.get("file") as File | null;

    const updateData: any = {};

    if (name && name.trim().length >= 2) {
      updateData.name = name;
    }

    // Procesar Imagen
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const filename = `avatar-${Date.now()}-${file.name.replace(/\s/g, "-")}`;
      
      // Definimos la ruta específica 'ProfilePics'
      const uploadDir = path.join(process.cwd(), "public", "uploads", "ProfilePics");
      
      // Crear la carpeta recursivamente (si 'uploads' o 'ProfilePics' no existen, las crea)
      await mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);

      // Guardamos la ruta con la nueva carpeta en la BD
      updateData.image = `/uploads/ProfilePics/${filename}`;
    }

    if (Object.keys(updateData).length > 0) {
      const updatedUser = await prisma.user.update({
        where: { email: session.user.email },
        data: updateData,
      });
      
      return NextResponse.json({ 
        ok: true, 
        user: { name: updatedUser.name, image: updatedUser.image } 
      });
    }

    return NextResponse.json({ ok: true, message: "No changes requested" });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Error updating profile" }, { status: 500 });
  }
}