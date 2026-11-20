"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", { redirect: false, email: email.trim(), password });

    if (res?.error === "EMAIL_NOT_VERIFIED") {
      router.push(`/verificar?email=${encodeURIComponent(email.trim())}`);
      return;
    }

    if (res?.ok && !res.error) {
      router.push("/composer");
      router.refresh();
      return;
    }

    setError("Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.");
    setLoading(false);
  }

  return (
    <AuthShell
      title="Inicia sesión"
      subtitle="Bienvenido de vuelta. Ingresa para gestionar tus publicaciones."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">Crea una gratis</Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Correo electrónico" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tu@correo.com" />
        </Field>

        <Field
          label="Contraseña"
          htmlFor="password"
          aside={<Link href="/forgot-password" className="text-xs text-indigo-300 hover:text-indigo-200 hover:underline">¿La olvidaste?</Link>}
        >
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-20`} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200" aria-pressed={showPassword}>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </Button>
      </form>
    </AuthShell>
  );
}
