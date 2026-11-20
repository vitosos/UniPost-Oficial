"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { Alert, Button, Field, PasswordChecklist, inputClass } from "@/components/ui";
import { isStrongPassword } from "@/lib/password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const errors = {
    name: name.trim().length < 2 ? "Ingresa al menos 2 caracteres." : null,
    email: !EMAIL_REGEX.test(email.trim()) ? "Ingresa un correo válido." : null,
    password: !isStrongPassword(password) ? "La contraseña aún no cumple todos los requisitos." : null,
    terms: !termsAccepted ? "Debes aceptar los términos para continuar." : null,
  };
  const isValid = !Object.values(errors).some(Boolean);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim(), termsAccepted }),
      });
      const data = await res.json();

      if (data.ok) {
        router.push(`/verificar?email=${encodeURIComponent(email.trim())}&sent=1`);
        return;
      }
      setError(
        data.error === "USER_EXISTS"
          ? "Ya existe una cuenta con este correo. ¿Quieres iniciar sesión?"
          : data.error === "WEAK_PASSWORD"
            ? "La contraseña no cumple los requisitos de seguridad."
            : "No pudimos crear tu cuenta. Inténtalo nuevamente."
      );
    } catch {
      setError("Error de conexión. Revisa tu internet e inténtalo de nuevo.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Publica en todas tus redes desde un solo lugar."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">Inicia sesión</Link>
        </>
      }
    >
      <form onSubmit={handleRegister} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Nombre" htmlFor="name" error={touched ? errors.name : null}>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!errors.name} className={inputClass} placeholder="¿Cómo te llamas?" maxLength={60} />
        </Field>

        <Field label="Correo electrónico" htmlFor="email" error={touched ? errors.email : null}>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!errors.email} className={inputClass} placeholder="tu@correo.com" />
        </Field>

        <Field label="Contraseña" htmlFor="password" error={touched ? errors.password : null}>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={touched && !!errors.password} className={`${inputClass} pr-20`} maxLength={72} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200" aria-pressed={showPassword}>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </Field>
        <PasswordChecklist password={password} />

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500" />
            <span>
              Acepto los{" "}
              <Link href="/term_cond" target="_blank" className="font-medium text-indigo-300 underline hover:text-indigo-200">Términos y Condiciones</Link>
            </span>
          </label>
          {touched && errors.terms && <p className="mt-1.5 text-xs text-red-300" role="alert">{errors.terms}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}
