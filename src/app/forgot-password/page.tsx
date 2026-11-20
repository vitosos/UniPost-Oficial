"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        setError("Demasiadas solicitudes. Inténtalo en unos minutos.");
      } else if (!res.ok) {
        setError("Ingresa un correo válido.");
      } else {
        router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
        return;
      }
    } catch {
      setError("Error de conexión.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Ingresa tu correo y te enviaremos un código para crear una nueva."
      footer={<Link href="/login" className="hover:text-slate-200">← Volver a iniciar sesión</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Correo electrónico" htmlFor="email">
          <input id="email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tu@correo.com" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email}>
          Enviar código
        </Button>
      </form>
    </AuthShell>
  );
}
