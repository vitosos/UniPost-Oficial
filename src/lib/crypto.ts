import crypto from 'crypto';

// Clave de 32 caracteres (AES-256). Se mantiene la misma derivación para poder leer los tokens ya guardados.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

function key(): Buffer {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not found in .env");
  const buf = Buffer.from(ENCRYPTION_KEY);
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be exactly 32 bytes");
  return buf;
}

/**
 * Cifra con AES-256-GCM (autenticado: detecta manipulación del texto cifrado).
 * Formato: "v2:<iv>:<authTag>:<cifrado>" en hex.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v2', iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

/** Descifra tanto el formato nuevo (GCM, "v2:...") como el antiguo (CBC, "<iv>:<cifrado>"). */
export function decrypt(text: string): string {
  const parts = text.split(':');

  if (parts[0] === 'v2' && parts.length === 4) {
    const [, ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  }

  // Formato antiguo AES-256-CBC (tokens guardados antes de la migración a GCM).
  if (parts.length < 2) throw new Error("Invalid encrypted text format");
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key(), iv);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}
