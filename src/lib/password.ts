// Reglas de contraseña compartidas por el cliente (feedback en vivo) y el servidor (validación real).

export const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Una letra mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Una letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un número", test: (p: string) => /\d/.test(p) },
  { label: "Un símbolo (ej: @ $ ! % * ? & # -)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** bcrypt solo considera los primeros 72 bytes, así que limitamos el largo. */
export const PASSWORD_MAX_LENGTH = 72;

export function isStrongPassword(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_RULES.every((r) => r.test(password))
  );
}
