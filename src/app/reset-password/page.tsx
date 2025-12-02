"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

function ResetForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  
  // Estados para contraseñas
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // --- LÓGICA DE VALIDACIÓN ---
  const requirements = [
    { label: "Mínimo 8 caracteres", valid: newPassword.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(newPassword) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(newPassword) },
    { label: "Un número", valid: /\d/.test(newPassword) },
    { label: "Un carácter especial (@$!%*?&)", valid: /[@$!%*?&]/.test(newPassword) },
  ];

  const isPasswordValid = requirements.every((req) => req.valid);
  const passwordsMatch = newPassword === confirmPassword && newPassword !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isPasswordValid) {
        toast.error("La contraseña no cumple con los requisitos.");
        return;
    }

    if (!passwordsMatch) {
        toast.error("Las contraseñas no coinciden.");
        return;
    }

    setLoading(true);

    try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, newPassword }),
        });

        const json = await res.json();

        if (json.ok) {
          toast.success("Contraseña actualizada exitosamente 🎉");
          setTimeout(() => router.push("/login"), 2000);
        } else {
          toast.error(json.error || "Error al restablecer");
          setLoading(false);
        }
    } catch (error) {
        toast.error("Error de conexión");
        setLoading(false);
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 text-slate-200 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Nueva Contraseña</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email (Solo lectura) */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-slate-400 cursor-not-allowed"
            disabled
          />

          {/* Código */}
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de 6 dígitos"
            maxLength={6}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 text-center tracking-widest text-xl focus:outline-none focus:border-white/40 transition"
            required
          />

          {/* Nueva Contraseña */}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 placeholder-gray-400 focus:outline-none focus:border-white/40 transition"
            required
          />

          {/* Confirmar Contraseña */}
          <div>
            <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar contraseña"
                className={`w-full p-3 rounded-xl bg-black/20 border placeholder-gray-400 focus:outline-none transition ${
                    confirmPassword && !passwordsMatch 
                    ? "border-red-500 focus:border-red-500" 
                    : "border-white/10 focus:border-white/40"
                }`}
                required
            />
            {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1 ml-1">Las contraseñas no coinciden.</p>
            )}
          </div>

          {/* Lista de Requisitos Visual */}
          <div className="bg-black/20 p-4 rounded-xl border border-white/5 mt-2">
            <p className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wide">
                Requisitos de seguridad:
            </p>
            <ul className="space-y-1">
                {requirements.map((req, index) => (
                <li
                    key={index}
                    className={`text-xs flex items-center gap-2 transition-all duration-300 ${
                    req.valid ? "text-green-400 font-medium" : "text-gray-500"
                    }`}
                >
                    <span>{req.valid ? "✅" : "○"}</span>
                    {req.label}
                </li>
                ))}
            </ul>
          </div>

          <button 
            disabled={loading || !isPasswordValid || !passwordsMatch} 
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-bold transition shadow-lg"
          >
            {loading ? "Actualizando..." : "Cambiar Contraseña"}
          </button>
        </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-4">
      <Suspense fallback={<div className="text-white">Cargando...</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}