"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import UniPostLogo from "../assets/UniPost.png";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // 1. Nuevo estado para el checkbox
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Validaciones básicas
  const validateEmail = (email: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|[^@]+\.(com|cl))$/;
    return regex.test(email);
  };

  const validateName = (name: string) => {
    return name.trim().length >= 2;
  };

  // Lista de requisitos
  const requirements = [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Un número", valid: /\d/.test(password) },
    { label: "Un carácter especial (@$!%*?&)", valid: /[@$!%*?&]/.test(password) },
  ];

  const isPasswordValid = () => {
    return requirements.every((req) => req.valid);
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("❌ El correo debe ser válido.");
      setLoading(false);
      return;
    }

    if (!validateName(name)) {
      toast.error("❌ El nombre de usuario debe tener al menos 2 caracteres.");
      setLoading(false);
      return;
    }

    if (!isPasswordValid()) {
      toast.error("❌ La contraseña no cumple con los requisitos.");
      setLoading(false);
      return;
    }

    // 2. Validación de Términos
    if (!termsAccepted) {
      toast.error("⚠️ Debes aceptar los Términos y Condiciones para continuar.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (data.ok) {
      toast.success("Usuario registrado correctamente ✅");
      router.push(`/verificar?email=${email}`);
    } else {
      if (data.error === "USER_EXISTS") {
        toast.error("❌ Este correo ya está en uso");
      } else {
        toast.error("❌ Error: " + (data.error || "No se pudo registrar"));
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-slate-200 p-4">
      
      {/* 🔙 Botón Volver al Inicio */}
      <Link 
        href="/" 
        className="mb-6 flex items-center gap-2 text-slate-200/80 hover:text-slate-200 transition-all bg-black/10 hover:bg-black/20 px-5 py-2 rounded-full backdrop-blur-sm border border-white/10 text-sm font-medium shadow-lg hover:-translate-y-0.5"
      >
        <span>←</span> Volver al Inicio
      </Link>

      <form
        onSubmit={handleRegister}
        className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 text-slate-200 w-full max-w-sm flex flex-col"
      >
        {/* 📛 Logo + UniPost */}
        <div className="flex flex-col items-center justify-center mb-6">
            <div className="bg-white/20 p-3 rounded-2xl shadow-inner mb-3">
                <Image
                    src={UniPostLogo}
                    alt="UniPost Logo"
                    width={64}
                    height={64}
                    className="h-12 w-12 drop-shadow-md"
                />
            </div>
            <h1 className="text-2xl font-black tracking-wide">UniPost</h1>
            <p className="text-slate-200/60 text-sm">Crea tu cuenta</p>
        </div>

        {/* Inputs */}
        <div className="space-y-4 mb-4">
            <input
            type="text"
            placeholder="Nombre de Usuario"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 focus:outline-none focus:border-white/40 focus:bg-black/30 transition"
            required
            />

            <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 focus:outline-none focus:border-white/40 focus:bg-black/30 transition"
            required
            />

            <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 focus:outline-none focus:border-white/40 focus:bg-black/30 transition"
            required
            />
        </div>

        {/* ✅ LISTA DE CONDICIONES VISUAL */}
        <div className="mb-4 bg-black/20 p-4 rounded-xl border border-white/5">
          <p className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wide">
            Requisitos de seguridad:
          </p>
          <ul className="space-y-1">
            {requirements.map((req, index) => (
              <li
                key={index}
                className={`text-xs flex items-center gap-2 transition-all duration-300 ${
                  req.valid ? "text-green-400 font-medium" : "text-gray-400"
                }`}
              >
                <span>{req.valid ? "✅" : "○"}</span>
                {req.label}
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Checkbox de Términos */}
        <div className="flex items-start gap-3 mb-6 px-1">
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/20 bg-black/20 transition-all checked:border-indigo-500 checked:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <svg
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity peer-checked:opacity-100"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <label htmlFor="terms" className="text-sm text-slate-300 cursor-pointer select-none leading-tight">
                He leído y acepto los{" "}
                <Link 
                    href="/term_cond" 
                    target="_blank" 
                    className="text-indigo-400 hover:text-indigo-300 underline font-semibold transition"
                >
                    Términos y Condiciones
                </Link>
                {" "}de la plataforma.
            </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold hover:opacity-90 hover:scale-[1.02] transition shadow-lg disabled:opacity-60 disabled:scale-100"
        >
          {loading ? "Creando..." : "Registrarse"}
        </button>

        <p className="text-center mt-6 text-sm text-gray-300">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-slate-200 font-semibold hover:underline hover:text-indigo-200 transition">
            Inicia sesión aquí
          </a>
        </p>
      </form>
    </div>
  );
}