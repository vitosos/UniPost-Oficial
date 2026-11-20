"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import AuthShell from "@/components/AuthShell";
import { Alert, Button, Field, LoadingState, inputClass } from "@/components/ui";

const RESEND_SECONDS = 60;

function VerifyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get("email") ?? "";
  const justRegistered = params.get("sent") === "1";

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(justRegistered ? RESEND_SECONDS : 0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(justRegistered);

  useEffect(() => {
    if (!email) {
      router.replace("/login");
      return;
    }
    fetch("/api/auth/check-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.isVerified) {
          toast.success("Tu correo ya está verificado. Inicia sesión.");
          router.replace("/login");
        }
      })
      .catch(() => {});
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("Te enviamos un nuevo código.");
        setCodeSent(true);
        setCooldown(RESEND_SECONDS);
      } else if (json.error === "WAIT_BEFORE_RESEND" || res.status === 429) {
        setError("Espera un momento antes de pedir otro código.");
        setCooldown(RESEND_SECONDS);
      } else {
        setError("No pudimos enviar el código. Inténtalo más tarde.");
      }
    } catch {
      setError("Error de conexión.");
    }
    setSending(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success("¡Correo verificado! Ya puedes iniciar sesión.");
        router.push("/login");
        return;
      }
      setError("El código es incorrecto o expiró. Tras 5 intentos fallidos deberás pedir uno nuevo.");
    } catch {
      setError("Error de conexión.");
    }
    setVerifying(false);
  }

  return (
    <AuthShell
      title="Verifica tu correo"
      subtitle={
        <>
          {codeSent ? "Enviamos un código de 6 dígitos a" : "Te enviaremos un código de 6 dígitos a"}{" "}
          <span className="font-medium text-slate-200">{email}</span>
        </>
      }
      footer={<Link href="/login" className="hover:text-slate-200">← Volver a iniciar sesión</Link>}
    >
      <form onSubmit={verifyCode} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {codeSent ? (
          <>
            <Field label="Código de verificación" htmlFor="code" hint="Revisa también tu carpeta de spam.">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
                placeholder="••••••"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={verifying} disabled={code.length !== 6}>
              Verificar correo
            </Button>
            <p className="text-center text-sm text-slate-400">
              ¿No te llegó?{" "}
              <button type="button" onClick={sendCode} disabled={sending || cooldown > 0} className="font-medium text-indigo-300 hover:text-indigo-200 disabled:cursor-not-allowed disabled:text-slate-500">
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
              </button>
            </p>
          </>
        ) : (
          <Button size="lg" className="w-full" onClick={sendCode} loading={sending}>
            Enviar código
          </Button>
        )}
      </form>
    </AuthShell>
  );
}

export default function VerificarCorreo() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyForm />
    </Suspense>
  );
}
