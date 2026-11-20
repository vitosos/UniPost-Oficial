// /app/api/auth/[...nextauth]/route.ts

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/validation";

// Hash ficticio para que el tiempo de respuesta sea similar exista o no el usuario.
const DUMMY_HASH = "$2b$12$JgafSNRZjwK8TEnTuSvBW.3fvoJMFn/V7byYKHxU7P/VfLpS7jnXa";

/** Huella del hash de contraseña: cambia cuando el usuario cambia su contraseña. */
function passwordFingerprint(hash: string | null) {
  return crypto.createHash("sha256").update(hash ?? "").digest("hex").slice(0, 16);
}

/** Cada cuánto el JWT se revalida contra la BD (usuario existente y contraseña sin cambios). */
const REVALIDATE_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password;
        if (!email || typeof password !== "string" || !password) return null;

        const ip = clientIp(req as { headers?: Record<string, string> });
        if (!rateLimit(`login:${ip}`, 30, 15 * 60 * 1000) || !rateLimit(`login:${email}`, 10, 15 * 60 * 1000)) {
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
        if (!user || !user.password || !valid) return null;

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          pwf: passwordFingerprint(user.password),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = Number(user.id);
        token.picture = user.image;
        token.name = user.name;
        token.pwf = user.pwf;
        token.checkedAt = Date.now();
      }

      // Revalidación periódica: si el usuario fue eliminado o cambió su contraseña, la sesión deja de ser válida.
      if (!user && (!token.checkedAt || Date.now() - token.checkedAt > REVALIDATE_MS)) {
        const dbUser = token.id
          ? await prisma.user.findUnique({ where: { id: token.id }, select: { password: true, name: true, image: true } })
          : null;
        if (!dbUser || passwordFingerprint(dbUser.password) !== token.pwf) {
          return {};
        }
        token.name = dbUser.name;
        token.picture = dbUser.image;
        token.checkedAt = Date.now();
      }

      // Si se dispara "update" desde el cliente (perfil), actualizamos nombre/imagen
      if (trigger === "update" && session?.user) {
        if (typeof session.user.name === "string") token.name = session.user.name.slice(0, 60);
        if (typeof session.user.image === "string") token.picture = session.user.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (!token.id) {
        // Token invalidado → sesión vacía (el usuario deberá iniciar sesión de nuevo).
        return { ...session, user: undefined };
      }
      if (session.user) {
        session.user.id = token.id;
        session.user.image = token.picture;
        session.user.name = token.name;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
