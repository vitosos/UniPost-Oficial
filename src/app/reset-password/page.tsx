"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import AuthShell from "@/components/AuthShell";
import { Alert, Button, Field, LoadingState, PasswordChecklist, inputClass } from "@/components/ui";
import { isStrongPassword } from "@/lib/password";

function ResetForm() {
  const email = useSearchParams().get("email") || "";
  const router = useRouter();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = code.length === 6 && isStrongPassword(newPassword) && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
        router.push("/login");
        return;
      }
      setError(json.error || "No se pudo restablecer la contraseña.");
    } catch {
      setError("Error de conexión.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Crea una nueva contraseña"
      subtitle={
        email ? (
          <>Si existe una cuenta para <span className="font-medium text-slate-200">{email}</span>, recibirás un código de 6 dígitos.</>
        ) : (
          "Ingresa el código que recibiste por correo."
        )
      }
      footer={<Link href="/forgot-password" className="hover:text-slate-200">¿No te llegó el código? Pedir otro</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Código" htmlFor="code">
          <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`} placeholder="••••••" />
        </Field>

        <Field label="Nueva contraseña" htmlFor="new-password">
          <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} maxLength={72} />
        </Field>
        <PasswordChecklist password={newPassword} />

        <Field label="Confirmar contraseña" htmlFor="confirm-password" error={confirmPassword && !passwordsMatch ? "Las contraseñas no coinciden." : null}>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!confirmPassword && !passwordsMatch} className={inputClass} maxLength={72} />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!canSubmit}>
          Cambiar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetForm />
    </Suspense>
  );
}
