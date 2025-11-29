"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

// --- TIPOS ---
type Variant = {
  network: string;
  text: string;
};

type NewMedia = {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
  type: "image" | "video";
  order: number;
};

type NetworkConnection = {
  connected: boolean;
  username?: string;
};

type UserConnections = {
  [key: string]: NetworkConnection;
};

const ALL_POSSIBLE_NETWORKS = ["INSTAGRAM", "BLUESKY", "FACEBOOK", "TIKTOK"] as const;
const CATEGORIES = ["Ilustración", "Evento", "Emprendimiento", "Entretenimiento", "Otro"];

// Zonas horarias IANA
const TIMEZONES = [
  { label: "Santiago / Buenos Aires", id: "America/Santiago" },
  { label: "Bogotá / Lima / Quito", id: "America/Bogota" },
  { label: "Ciudad de México", id: "America/Mexico_City" },
  { label: "Caracas / La Paz", id: "America/Caracas" },
  { label: "Nueva York / Miami", id: "America/New_York" },
  { label: "Los Angeles (Pacific)", id: "America/Los_Angeles" },
  { label: "Madrid / París / Roma", id: "Europe/Madrid" },
  { label: "Londres / Lisboa", id: "Europe/London" },
  { label: "UTC (Universal)", id: "UTC" },
  { label: "Tokio", id: "Asia/Tokyo" },
];

export default function ComposerPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Estados Formulario
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Otro");
  const [visible, setVisible] = useState(false);

  // Estados de Conexión (Nuevo)
  const [connections, setConnections] = useState<UserConnections>({});
  const [loadingConnections, setLoadingConnections] = useState(true);
  
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [medias, setMedias] = useState<NewMedia[]>([]);

  // Estados Scheduler
  const [agendar, setAgendar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("12:00");
  const [zona, setZona] = useState("America/Santiago");
  const [now, setNow] = useState(new Date());

  // Cargar conexiones al inicio
  useEffect(() => {
    async function fetchConnections() {
        try {
            const res = await fetch("/api/users/connections");
            const data = await res.json();
            if (data.ok) {
                setConnections(data.connections);
                
                // Inicializar variants con la primera red disponible por defecto (si hay alguna)
                const available = ALL_POSSIBLE_NETWORKS.filter(net => data.connections[net]?.connected);
                if (available.length > 0) {
                    setVariants([{ network: available[0], text: "" }]);
                } else {
                    setVariants([]); // Sin redes, lista vacía
                }
            }
        } catch (e) {
            console.error("Error fetching connections", e);
        } finally {
            setLoadingConnections(false);
        }
    }
    fetchConnections();
  }, []);

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getTimeInZone = (zoneId: string) => {
    try {
      return new Intl.DateTimeFormat("es-CL", {
        timeZone: zoneId, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(now);
    } catch (e) { return "--:--"; }
  };

  // --- LÓGICA DE RESTRICCIONES ---
  const calculateRestrictions = () => {
    const networks = variants.map(v => v.network);

    // Valores base (máximos posibles)
    let maxImages = 10;
    let maxVideos = 1;
    let allowMix = true;
    let minMedia = 0;

    // Aplicamos restricciones según las redes activas
    if (networks.includes("TIKTOK")) {
      maxImages = 0; 
      minMedia = Math.max(minMedia, 1); 
      allowMix = false;
    }
    if (networks.includes("BLUESKY")) {
      maxImages = Math.min(maxImages, 4);
      allowMix = false;
    }
    if (networks.includes("INSTAGRAM")) {
      minMedia = Math.max(minMedia, 1);
    }

    return { maxImages, maxVideos, allowMix, minMedia };
  };

  const restrictions = calculateRestrictions();

  function canAddMedia(file: File, currentMedias: NewMedia[]) {
    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");

    if (!isVideo && !isImage) return { ok: false, reason: "Archivo no soportado." };

    const imageCount = currentMedias.filter(m => m.type === "image").length + (isImage ? 1 : 0);
    const videoCount = currentMedias.filter(m => m.type === "video").length + (isVideo ? 1 : 0);

    if (isImage && imageCount > restrictions.maxImages) return { ok: false, reason: `Límite de imágenes excedido (${restrictions.maxImages}).` };
    if (isVideo && videoCount > restrictions.maxVideos) return { ok: false, reason: `Límite de videos excedido (${restrictions.maxVideos}).` };

    if (!restrictions.allowMix) {
      const hasImages = currentMedias.some(m => m.type === "image") || isImage;
      const hasVideos = currentMedias.some(m => m.type === "video") || isVideo;
      if (hasImages && hasVideos) return { ok: false, reason: "Las redes seleccionadas no permiten mezclar fotos y videos." };
    }

    return { ok: true };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const check = canAddMedia(selected, medias);
    if (!check.ok) {
      toast.error(check.reason || "Error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const isVideo = selected.type.startsWith("video");
      const newMedia: NewMedia = {
        id: crypto.randomUUID(),
        file: selected,
        previewUrl: URL.createObjectURL(selected),
        base64,
        type: isVideo ? "video" : "image",
        order: medias.length,
      };
      setMedias((prev) => [...prev, newMedia]);
      e.target.value = "";
    };
    reader.readAsDataURL(selected);
  }

  // --- Helpers de Media ---
  function moveMedia(index: number, direction: "left" | "right") {
    setMedias((prev) => {
      const newIndex = index + (direction === "left" ? -1 : 1);
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const arr = [...prev];
      const temp = arr[index]; arr[index] = arr[newIndex]; arr[newIndex] = temp;
      return arr.map((m, idx) => ({ ...m, order: idx }));
    });
  }

  function removeMedia(index: number) {
    setMedias((prev) => {
      const arr = prev.filter((_, i) => i !== index);
      return arr.map((m, idx) => ({ ...m, order: idx }));
    });
  }

  // --- SUBMIT ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (medias.length < restrictions.minMedia) {
      toast.error(`Debes subir al menos ${restrictions.minMedia} archivo(s) para continuar.`);
      setLoading(false);
      return;
    }

    let schedulePayload = null;
    if (agendar) {
      if (!fecha || !hora) { toast.error("⚠️ Faltan fecha y hora."); setLoading(false); return; }
      try {
        const targetDateStr = `${fecha}T${hora}:00`;
        const offset = getOffsetForZone(zona);
        const finalIsoString = `${targetDateStr}${offset}`;
        const dateCheck = new Date(finalIsoString);
        if (isNaN(dateCheck.getTime())) throw new Error("Fecha inválida");
        if (dateCheck <= new Date()) { toast.error("⚠️ Fecha debe ser futura."); setLoading(false); return; }
        schedulePayload = { runAt: dateCheck.toISOString(), timezone: zona };
      } catch (err) { toast.error("Error al calcular fecha."); setLoading(false); return; }
    }

    const payload = {
      organizationId: 1,
      title,
      body,
      category,
      visible,
      variants,
      medias: medias.sort((a, b) => a.order - b.order).map((m) => ({
        base64: m.base64, type: m.type, order: m.order,
      })),
      schedule: schedulePayload,
    };

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (json.ok) {
      toast.success(agendar ? "📅 Agendado correctamente" : "✅ Creado correctamente");
      setTitle(""); setBody(""); setMedias([]); setAgendar(false); setFecha("");
      setCategory("Otro"); setVisible(false);
      
      // Resetear variants a la primera disponible
      const firstAvailable = ALL_POSSIBLE_NETWORKS.find(net => connections[net]?.connected);
      setVariants(firstAvailable ? [{ network: firstAvailable, text: "" }] : []);
    } else {
      toast.error("❌ Error: " + (json.error || "Fallo al crear"));
    }
    setLoading(false);
  }

  function getOffsetForZone(timeZone: string): string {
    const date = new Date();
    const timeString = date.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
    const offsetPart = timeString.split('GMT')[1];
    if (!offsetPart) return "Z";
    let [hours, minutes] = offsetPart.split(':');
    if (!minutes) minutes = "00";
    const sign = hours.includes('-') ? '-' : '+';
    hours = hours.replace('+', '').replace('-', '').padStart(2, '0');
    return `${sign}${hours}:${minutes}`;
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const newVariants = [...variants];
    // @ts-ignore
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  // 🔴 FILTRO DE REDES: Solo mostramos las que tienen connected: true y no están ya en uso
  const availableNetworks = ALL_POSSIBLE_NETWORKS.filter(net => 
    connections[net]?.connected === true && // Debe estar conectada
    !variants.some(v => v.network === net)  // No debe estar seleccionada ya
  );

  const hasAnyConnection = Object.values(connections).some(c => c.connected);

  if (loadingConnections) {
      return <div className="min-h-screen flex items-center justify-center text-white">Cargando perfiles...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {session && (
        <div className="flex justify-between items-center mb-6">
          <p>👋 Hola, <span className="font-bold">{session.user?.name}</span></p>
          <div className="flex gap-3">
            <a href="/publicaciones" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition">📂 Biblioteca</a>
            <a href="/perfil" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition">👤 Perfil</a>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition">🚪 Salir</button>
          </div>
        </div>
      )}

      <h1 className="text-4xl font-bold mb-8 text-center tracking-tight">Crear nueva publicación</h1>

      {!hasAnyConnection ? (
        // 🚨 ESTADO SIN CONEXIONES
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl text-center">
            <h2 className="text-xl font-bold text-red-200 mb-2">¡Aún no has enlazado tus cuentas!</h2>
            <p className="text-slate-300 mb-6">Para crear publicaciones, primero debes conectar al menos una red social.</p>
            <Link 
                href="/perfil"
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg"
            >
                Ir a mi Perfil y Conectar
            </Link>
        </div>
      ) : (
        // ✅ ESTADO NORMAL
        <div className="flex flex-col lg:flex-row gap-8">

            {/* FORMULARIO PRINCIPAL */}
            <div className="flex-1 backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Título y Cuerpo */}
                <div className="space-y-4">
                <input
                    className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-slate-200 placeholder-white/40 focus:bg-black/40 outline-none"
                    placeholder="Título interno..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                    <textarea
                        className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-slate-200 placeholder-white/40 focus:bg-black/40 outline-none h-40 resize-none"
                        placeholder="Texto principal..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                    />
                    </div>

                    {/* Configuración Global */}
                    <div className="md:w-64 flex flex-col gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Categoría</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-slate-200 text-sm focus:bg-black/40 outline-none">
                        {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-gray-900 text-slate-200">{cat}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Visibilidad</label>
                        <div className="flex items-center gap-2 relative group">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200 select-none">
                            <input
                            type="checkbox"
                            checked={visible}
                            onChange={(e) => setVisible(e.target.checked)}
                            className="w-4 h-4 accent-green-500 rounded"
                            />
                            Mostrar en Feed
                        </label>

                        {/* Icono Info */}
                        <div className="bg-white/20 text-slate-200/80 rounded-full w-4 h-4 flex items-center justify-center text-xs cursor-help font-serif italic transition hover:bg-white/40 hover:text-white">
                            i
                        </div>

                        {/* TOOLTIP FLOTANTE (Corregido hacia abajo) */}
                        <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-white/20 text-xs text-slate-300 p-4 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed text-left">
                            <div className="absolute bottom-full right-1 -mb-[1px] border-8 border-transparent border-b-slate-900/50"></div>
                            <p>
                            Si tu publicación está configurada como <strong className="text-white">visible</strong>, otros usuarios podrán ver las publicaciones que has realizado a través de UniPost en el feed presente en el inicio.
                            </p>
                            <p className="mt-2 text-slate-400 italic">
                            Asegúrate de que el contenido cumpla con los términos y condiciones de nuestra plataforma.
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                </div>
                </div>

                {/* Multimedia */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-slate-200">📎 Multimedia</label>
                    <span className="text-xs text-slate-400">{medias.length} archivo(s) seleccionados</span>
                </div>

                <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white cursor-pointer hover:file:bg-indigo-500 transition" />

                {medias.length > 0 && (
                    <div className="mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
                    {medias.sort((a, b) => a.order - b.order).map((m, index) => (
                        <div key={m.id} className="relative min-w-[120px] max-w-[120px] aspect-square border border-white/10 bg-black/40 rounded-xl flex flex-col items-center justify-center overflow-hidden group">
                        <span className="absolute top-1 left-2 text-[10px] bg-black/70 px-1.5 py-0.5 rounded-full z-10 text-white">#{index + 1}</span>
                        {m.type === "video" ? <video src={m.previewUrl} className="w-full h-full object-cover opacity-80" /> : <img src={m.previewUrl} alt="prev" className="w-full h-full object-cover opacity-80" />}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                            <button type="button" onClick={() => moveMedia(index, "left")} disabled={index === 0} className="p-1 text-gray-300 hover:text-white disabled:opacity-30">◀</button>
                            <button type="button" onClick={() => removeMedia(index)} className="p-1 bg-red-500/80 rounded-full text-white text-xs">🗑️</button>
                            <button type="button" onClick={() => moveMedia(index, "right")} disabled={index === medias.length - 1} className="p-1 text-gray-300 hover:text-white disabled:opacity-30">▶</button>
                        </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>

                {/* Redes y Configuración (AJUSTADO: Selector arriba del texto) */}
                <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-200">🌍 Variantes por Red</label>
                {variants.map((v, i) => (
                    <div key={i} className="flex flex-col gap-3 bg-black/20 p-4 rounded-xl border border-white/10 animate-in slide-in-from-left-2 relative">

                    {/* Botón Eliminar (Posición absoluta para no estorbar) */}
                    {variants.length > 1 && (
                        <button type="button" onClick={() => removeVariant(i)} className="absolute top-3 right-3 p-1.5 bg-red-500/20 text-red-200 rounded-lg hover:bg-red-500/40 transition text-xs">✕</button>
                    )}

                    {/* 1. Selector de Red (Arriba) */}
                    <div className="w-full">
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Red Social</label>
                        <select 
                            value={v.network} 
                            onChange={(e) => updateVariant(i, "network", e.target.value)} 
                            className="w-full p-3 bg-black/20 border border-white/10 text-slate-200 rounded-lg text-sm focus:bg-black/40 outline-none"
                        >
                            {/* Solo mostramos redes conectadas que no estén seleccionadas YA (o la actual) */}
                            {ALL_POSSIBLE_NETWORKS
                                .filter(net => connections[net]?.connected && (!variants.some(va => va.network === net) || net === v.network))
                                .map(net => (
                                    <option key={net} value={net} className="bg-gray-900">{net}</option>
                            ))}
                        </select>
                        {/* 🟢 NUEVO: Mostrar quién está publicando */}
                        <p className="text-[12px] text-green-400 mt-1 flex items-center gap-1">
                            ✅ Publicando como: <span className="font-bold">{connections[v.network]?.username || "Usuario"}</span>
                        </p>
                    </div>

                    {/* 2. Texto (Abajo) */}
                    <div className="w-full">
                        <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Descripción / Copy</label>
                        <textarea
                        value={v.text}
                        onChange={(e) => updateVariant(i, "text", e.target.value)}
                        placeholder={`Texto específico para ${v.network} (opcional)`}
                        rows={3}
                        className="w-full p-3 rounded-lg bg-black/20 border border-white/10 text-slate-200 placeholder-white/30 resize-none overflow-hidden text-sm focus:bg-black/40 outline-none transition"
                        style={{ minHeight: "80px" }}
                        />
                    </div>

                    </div>
                ))}
                </div>

                {/* Botón Agregar Red */}
                {availableNetworks.length > 0 && (
                <div className="flex gap-2">
                    <select id="newNetwork" className="p-2 bg-white/10 border border-white/20 rounded-lg text-sm text-slate-200" defaultValue="">
                    <option value="" disabled>Otra red...</option>
                    {availableNetworks.map(r => <option key={r} value={r} className="bg-gray-900">{r}</option>)}
                    </select>
                    <button type="button" onClick={() => {
                    const select = document.getElementById("newNetwork") as HTMLSelectElement;
                    if (select.value) { setVariants([...variants, { network: select.value, text: "" }]); select.value = ""; }
                    }} className="text-sm bg-green-600/20 text-green-300 px-3 py-2 rounded-lg hover:bg-green-600/30 transition border border-green-500/30">
                    + Agregar
                    </button>
                </div>
                )}

                {/* Scheduler */}
                <div className="pt-4 border-t border-white/10">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition w-fit">
                    <input type="checkbox" checked={agendar} onChange={() => setAgendar(!agendar)} className="w-5 h-5 accent-indigo-500" />
                    <span className="font-bold text-sm">📅 Programar publicación</span>
                </label>

                {agendar && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-black/20 rounded-xl border border-white/5 animate-in slide-in-from-top-2">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Fecha</label>
                        <input type="date" value={fecha} min={new Date().toISOString().split("T")[0]} onChange={(e) => setFecha(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded p-2 text-slate-200 [color-scheme:dark] text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Hora</label>
                        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded p-2 text-slate-200 [color-scheme:dark] text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Zona</label>
                        <select value={zona} onChange={(e) => setZona(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded p-2 text-slate-200 text-sm">
                        {TIMEZONES.map((tz) => <option key={tz.id} value={tz.id} className="text-black">{tz.label} ({getTimeInZone(tz.id)})</option>)}
                        </select>
                    </div>
                    </div>
                )}
                </div>

                <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition disabled:opacity-50 transform active:scale-[0.99]">
                {loading ? "Procesando..." : agendar ? "📅 Agendar Publicación" : "📁 Guardar Publicación"}
                </button>
            </form>
            </div>

            {/* PANEL LATERAL DE RESTRICCIONES (ACTUALIZADO) */}
            <div className="lg:w-64 shrink-0 space-y-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl sticky top-6">
                <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                📝 Reglas Activas
                </h3>
                <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">Máx Imágenes</span>
                    <span className={`font-mono font-bold ${medias.filter(m => m.type === 'image').length > restrictions.maxImages ? "text-red-400" : "text-green-400"}`}>
                    {restrictions.maxImages}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">Máx Videos</span>
                    <span className={`font-mono font-bold ${medias.filter(m => m.type === 'video').length > restrictions.maxVideos ? "text-red-400" : "text-green-400"}`}>
                    {restrictions.maxVideos}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">Mezclar Tipos</span>
                    <span className={`font-bold ${!restrictions.allowMix && medias.some(m => m.type === 'video') && medias.some(m => m.type === 'image') ? "text-red-400" : "text-slate-200"}`}>
                    {restrictions.allowMix ? "Sí" : "No"}
                    </span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                    <span className="text-slate-400">Mínimo Archivos</span>
                    <span className={`font-mono font-bold ${medias.length < restrictions.minMedia ? "text-orange-400" : "text-green-400"}`}>
                        {restrictions.minMedia}
                    </span>
                    </div>
                </div>
                </div>

                {/* Alertas dinámicas */}
                {variants.some(v => v.network === "TIKTOK") && (
                <div className="mt-4 p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg text-xs text-pink-200">
                    🎵 TikTok activo: Solo se permiten videos.
                </div>
                )}
            </div>
            </div>

        </div>
      )}
    </div>
  );
}