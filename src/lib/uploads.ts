// Manejo seguro de archivos subidos: lista blanca de tipos MIME con extensión fija,
// límite de tamaño y nombres generados por el servidor (nunca el nombre del cliente).

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type DecodedUpload = { buffer: Buffer; mime: string; ext: string; isVideo: boolean };

/** Firma ("magic bytes") mínima para confirmar que el contenido coincide con el tipo declarado. */
function matchesSignature(buffer: Buffer, mime: string): boolean {
  const hex = buffer.subarray(0, 12).toString("hex");
  switch (mime) {
    case "image/jpeg": return hex.startsWith("ffd8ff");
    case "image/png": return hex.startsWith("89504e470d0a1a0a");
    case "image/gif": return hex.startsWith("47494638");
    case "image/webp": return hex.startsWith("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    case "video/webm": return hex.startsWith("1a45dfa3");
    case "video/mp4":
    case "video/quicktime": return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    default: return false;
  }
}

/** Valida y decodifica un buffer con su MIME declarado. Lanza Error con mensaje para el usuario si no es válido. */
export function validateUpload(buffer: Buffer, declaredMime: string): DecodedUpload {
  const mime = declaredMime.toLowerCase().split(";")[0].trim();
  const isVideo = mime in VIDEO_TYPES;
  const ext = IMAGE_TYPES[mime] ?? VIDEO_TYPES[mime];
  if (!ext) throw new Error(`Tipo de archivo no permitido: ${mime || "desconocido"}`);
  if (buffer.length > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new Error("El archivo es demasiado grande");
  if (!matchesSignature(buffer, mime)) throw new Error("El contenido del archivo no coincide con su tipo");
  return { buffer, mime, ext, isVideo };
}

/** Decodifica un data URI ("data:image/png;base64,...") con las mismas validaciones. */
export function decodeDataUri(dataUri: string): DecodedUpload {
  const match = /^data:([\w.+/-]+);base64,([\s\S]*)$/.exec(dataUri);
  if (!match) throw new Error("Formato de archivo inválido");
  return validateUpload(Buffer.from(match[2], "base64"), match[1]);
}

/** Guarda el archivo bajo public/uploads/<subdir> con un nombre aleatorio. Devuelve la URL relativa. */
export async function saveUpload(upload: DecodedUpload, subdir = "", prefix = ""): Promise<string> {
  const safeSubdir = subdir.replace(/[^\w-]/g, "");
  const dir = path.join(process.cwd(), "public", "uploads", safeSubdir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${prefix.replace(/[^\w-]/g, "")}${randomUUID()}.${upload.ext}`;
  await fs.writeFile(path.join(dir, filename), upload.buffer);
  return `/uploads/${safeSubdir ? `${safeSubdir}/` : ""}${filename}`;
}

/**
 * Convierte una URL de media guardada (relativa o absoluta de esta app) a una ruta local
 * dentro de public/uploads. Devuelve null si apunta fuera de esa carpeta.
 */
export function localUploadPath(urlOrPath: string): string | null {
  let pathname = urlOrPath;
  if (/^https?:\/\//i.test(pathname)) {
    try { pathname = new URL(pathname).pathname; } catch { return null; }
  }
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const resolved = path.resolve(process.cwd(), "public", "." + path.posix.normalize("/" + decodeURIComponent(pathname)));
  return resolved.startsWith(uploadsRoot + path.sep) ? resolved : null;
}
