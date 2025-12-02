"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Siempre decimos que fue enviado por seguridad
    toast.success("Si el correo existe, recibirás un código.");
    
    // Redirigir a la pantalla de reset pasando el email
    setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    }, 1500);
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 text-slate-200 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">Recuperar Contraseña</h1>
        <p className="text-sm text-slate-300 mb-6 text-center">Ingresa tu correo para recibir un código de recuperación.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 focus:outline-none focus:border-white/40 focus:bg-black/30 transition"
            required
          />
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition">
            {loading ? "Enviando..." : "Enviar Código"}
          </button>
        </form>
        
        <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition">← Volver al login</Link>
        </div>
      </div>
    </div>
  );
}