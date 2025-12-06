"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import CuentasConectadas from "@/components/CuentasConectadas";

export default function PerfilPage() {
  const { data: session, update } = useSession(); 
  const userEmail = session?.user?.email;

  // 1. Agregamos 'seguridad' a los tabs
  const [activeTab, setActiveTab] = useState<"cuentas" | "perfil" | "seguridad">("cuentas");

  // Estados Perfil
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados Cambio de Contraseña
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  // Estado para el nombre de la Organización
  const [orgName, setOrgName] = useState<string>("Cargando...");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (session?.user?.name) setNewName(session.user.name);
    if (session?.user?.image) setPreviewUrl(session.user.image);
  }, [session]);

  // Cargar Organización
  useEffect(() => {
    if (!session?.user?.email) return;
    async function fetchOrg() {
        try {
            const res = await fetch("/api/organizations");
            const json = await res.json();
            if (json.ok && json.data.userOrgId) {
                if (json.data.organizationName) {
                    setOrgName(json.data.organizationName);
                } else if (json.data.organizations) {
                    const myOrg = json.data.organizations.find((o: any) => o.id === json.data.userOrgId);
                    setOrgName(myOrg ? myOrg.name : "Independiente");
                } else {
                    setOrgName("Mi Organización"); 
                }
            } else {
                setOrgName("Independiente");
            }
        } catch (e) { setOrgName("Independiente"); }
    }
    fetchOrg();
  }, [session]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImage(file);
      setPreviewUrl(URL.createObjectURL(file)); 
    }
  };

  // --- LÓGICA DE VALIDACIÓN DE CONTRASEÑA ---
  const requirements = [
    { label: "Mínimo 8 caracteres", valid: newPass.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(newPass) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(newPass) },
    { label: "Un número", valid: /\d/.test(newPass) },
    { label: "Un carácter especial (@$!%*?&)", valid: /[@$!%*?&]/.test(newPass) },
  ];

  const isPasswordValid = requirements.every((req) => req.valid);
  const passwordsMatch = newPass === confirmPass && newPass !== "";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !passwordsMatch) {
        toast.error("Revisa los requisitos de la contraseña");
        return;
    }
    setPassLoading(true);

    try {
        const res = await fetch("/api/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
        });

        // Intentamos leer el JSON. Si falla, leemos texto plano para depurar.
        let json;
        try {
            json = await res.json();
        } catch (parseError) {
            console.error("Error parseando respuesta:", parseError);
            throw new Error("El servidor devolvió una respuesta inválida (no es JSON)");
        }

        if (res.ok && json.ok) {
            toast.success("Contraseña actualizada exitosamente 🔒");
            setCurrentPass("");
            setNewPass("");
            setConfirmPass("");
        } else {
            // Mostramos el error que viene del servidor
            toast.error("❌ " + (json.error || "Error desconocido"));
            console.error("Error del servidor:", json);
        }
    } catch (err: any) {
        console.error("Error en petición:", err);
        // Ahora el toast mostrará el mensaje técnico si es un error de conexión real
        toast.error(err.message || "Error de conexión");
    } finally {
        setPassLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData();
    formData.append("name", newName);
    if (newImage) formData.append("file", newImage);

    try {
      const res = await fetch("/api/profile/update", { method: "PUT", body: formData });
      const data = await res.json();
      if (data.ok) {
        toast.success("Perfil actualizado correctamente ✅");
        await update({ ...session, user: { ...session?.user, name: data.user.name, image: data.user.image } });
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (error) { toast.error("Error de conexión"); } 
    finally { setIsSaving(false); }
  };

  return (
      <div className="max-w-6xl mx-auto text-center pb-20">
        {session ? (
          <>
            {/* HEADER */}
            <div className="relative inline-block group">
              <img
                src={previewUrl || session.user?.image || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                alt="avatar"
                className="mx-auto w-28 h-28 rounded-full border-4 border-white/30 shadow-lg mb-4 object-cover"
              />
            </div>
            
            <h1 className="text-3xl font-bold mb-1"> {session.user?.name || session.user?.email}</h1>
            <p className="text-slate-200/70 mb-6 text-lg font-medium bg-white/10 inline-block px-4 py-1 rounded-full">{orgName}</p>

            {/* BOTONES ACCIÓN */}
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <a href="/composer" className="bg-white/20 hover:bg-white/30 text-sm px-5 py-2 rounded-lg transition">✏️ Ir al Composer</a>
              <a href="/metricas" className="bg-white/20 hover:bg-white/30 text-sm px-5 py-2 rounded-lg transition">📊 Ver métricas</a>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="bg-white/20 hover:bg-white/30 text-sm px-5 py-2 rounded-lg transition">🚪 Cerrar sesión</button>
            </div>

            {/* NAVEGACIÓN TABS */}
            <div className="flex justify-center gap-2 mb-8 border-b border-white/10 pb-1 flex-wrap">
              <button onClick={() => setActiveTab("cuentas")} className={`px-6 py-2 rounded-t-lg font-bold transition-all ${activeTab === "cuentas" ? "bg-white/20 text-slate-200 border-b-2 border-white" : "text-slate-200/50 hover:bg-white/5 hover:text-slate-200"}`}>🔗 Cuentas Conectadas</button>
              <button onClick={() => setActiveTab("perfil")} className={`px-6 py-2 rounded-t-lg font-bold transition-all ${activeTab === "perfil" ? "bg-white/20 text-slate-200 border-b-2 border-white" : "text-slate-200/50 hover:bg-white/5 hover:text-slate-200"}`}>👤 Datos de Perfil</button>
              <button onClick={() => setActiveTab("seguridad")} className={`px-6 py-2 rounded-t-lg font-bold transition-all ${activeTab === "seguridad" ? "bg-white/20 text-slate-200 border-b-2 border-white" : "text-slate-200/50 hover:bg-white/5 hover:text-slate-200"}`}>🔒 Seguridad</button>
            </div>

            {/* --- CONTENIDO CUENTAS --- */}
            {activeTab === "cuentas" && <CuentasConectadas userEmail={userEmail} />}

            {/* --- CONTENIDO PERFIL --- */}
            {activeTab === "perfil" && (
              <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/10 text-left">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">👤 Editar Perfil</h2>
                  <form className="space-y-6" onSubmit={handleSaveProfile}>
                    <div className="flex flex-col items-center mb-6">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                         <img src={previewUrl || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} className="w-full h-full object-cover" alt="Preview" />
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold">CAMBIAR</div>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                      <p className="text-xs text-slate-200/50 mt-2">Click en la imagen para cambiarla</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Nombre de Usuario</label>
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-3 rounded bg-black/20 border border-white/10 text-slate-200 focus:outline-none focus:border-white/50" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Correo Electrónico</label>
                      <input type="email" defaultValue={session.user?.email || ""} disabled className="w-full p-3 rounded bg-black/40 border border-white/5 text-slate-200/50 cursor-not-allowed" />
                    </div>
                    <div className="flex justify-end pt-4">
                      <button disabled={isSaving} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold shadow-lg transition flex items-center gap-2">
                        {isSaving ? "Guardando..." : "💾 Guardar Cambios"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- CONTENIDO SEGURIDAD (NUEVO) --- */}
            {activeTab === "seguridad" && (
                <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/10 text-left">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🔒 Cambiar Contraseña</h2>
                        
                        <form onSubmit={handleChangePassword} className="space-y-5">
                            {/* Actual */}
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">Contraseña Actual</label>
                                <input 
                                    type="password" 
                                    value={currentPass} 
                                    onChange={(e) => setCurrentPass(e.target.value)} 
                                    className="w-full p-3 rounded bg-black/20 border border-white/10 text-slate-200 focus:outline-none focus:border-white/50 transition"
                                    required 
                                />
                            </div>

                            <hr className="border-white/10 my-4" />

                            {/* Nueva */}
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    value={newPass} 
                                    onChange={(e) => setNewPass(e.target.value)} 
                                    className="w-full p-3 rounded bg-black/20 border border-white/10 text-slate-200 focus:outline-none focus:border-white/50 transition"
                                    required
                                />
                            </div>

                            {/* Confirmar */}
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">Confirmar Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    value={confirmPass} 
                                    onChange={(e) => setConfirmPass(e.target.value)} 
                                    className={`w-full p-3 rounded bg-black/20 border text-slate-200 focus:outline-none transition ${
                                        confirmPass && confirmPass !== newPass ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-white/50"
                                    }`}
                                    required
                                />
                                {confirmPass && confirmPass !== newPass && (
                                    <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden.</p>
                                )}
                            </div>

                            {/* Lista de Requisitos Visual */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 mt-4">
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

                            <div className="flex justify-end pt-4">
                                <button 
                                    disabled={passLoading || !isPasswordValid || !passwordsMatch} 
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold shadow-lg transition flex items-center gap-2"
                                >
                                    {passLoading ? "Actualizando..." : "Actualizar Contraseña"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

          </>
        ) : (
          <p className="text-slate-200/80">Inicia sesión para ver tu perfil.</p>
        )}
      </div>
  );
}