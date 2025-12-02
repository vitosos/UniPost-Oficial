"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Image from "next/image";
import UniPostLogo from "../../assets/UniPost.png";
import BskyIcon from "@/app/assets/bsky.png";
import IgIcon from "@/app/assets/ig.png";
import FbIcon from "@/app/assets/fb.png";
import TtIcon from "@/app/assets/tt.png";
import XIcon from "@/app/assets/x.png";

// TIPOS
type Variant = {
  id?: number;
  network: string;
  text: string;
  status?: string;
  uri?: string;
  bskyUri?: string;
};

type Media = {
  id: number;
  url: string;
  type: "IMAGE" | "VIDEO";
  mime: string;
  mediaLocation: string;
};

type Schedule = {
  runAt: string;
  timezone: string;
};

type Post = {
  id: number;
  title: string;
  body: string;
  status: string;
  mediaBase64?: string;
  variants: Variant[];
  medias: Media[];
  schedule?: Schedule | null;
};

const ITEMS_PER_PAGE = 5;

// Constantes para filtros
const STATUS_OPTIONS = [
  { label: "Todos los estados", value: "ALL" },
  { label: "Borrador (Draft)", value: "DRAFT" },
  { label: "Programado", value: "SCHEDULED" },
  { label: "Publicado", value: "PUBLISHED" },
];

const NETWORK_OPTIONS = [
  { label: "Todas las redes", value: "ALL" },
  { label: "Instagram", value: "INSTAGRAM" },
  { label: "Facebook", value: "FACEBOOK" },
  { label: "Bluesky", value: "BLUESKY" },
  { label: "TikTok", value: "TIKTOK" },
  { label: "X (Twitter)", value: "TWITTER" },
];

export default function PublicacionesPage() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postMediaIndex, setPostMediaIndex] = useState<{ [postId: number]: number }>({});

  const [processing, setProcessing] = useState<{ [key: number]: boolean }>({});
  const [publishingAll, setPublishingAll] = useState<{ [postId: number]: boolean }>({});

  // Estado para guardar cambios de texto (loading por variante)
  const [savingVariant, setSavingVariant] = useState<{ [variantId: number]: boolean }>({});

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [networkFilter, setNetworkFilter] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchPosts();
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Resetear página al cambiar cualquier filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, networkFilter]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch("/api/posts");
      const json = await res.json();
      if (json.ok) setPosts(json.data);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando publicaciones");
    } finally {
      setLoading(false);
    }
  }

  // --- LÓGICA DE GUARDADO DE VARIANTE ---
  async function handleSaveVariantText(variantId: number, text: string) {
    setSavingVariant(prev => ({ ...prev, [variantId]: true }));
    try {
      const res = await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, text }),
      });
      const json = await res.json();

      if (json.ok) {
        toast.success("Cambios guardados");
      } else {
        throw new Error(json.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar cambios");
    } finally {
      setSavingVariant(prev => ({ ...prev, [variantId]: false }));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;
    const res = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      toast.success("🗑️ Publicación eliminada");
      fetchPosts();
    } else {
      toast.error("❌ Error al eliminar");
    }
  }

  async function handlePublishVariant(post: Post, variant: Variant) {
    if (!variant.id) return;

    setProcessing(prev => ({ ...prev, [variant.id!]: true }));
    const toastId = toast.loading(`Publicando en ${variant.network}...`);

    try {
      let endpoint = "";
      if (variant.network === "BLUESKY") endpoint = "/api/publish/bluesky";
      else if (variant.network === "INSTAGRAM") endpoint = "/api/publish/instagram";
      else if (variant.network === "FACEBOOK") endpoint = "/api/publish/facebook";
      else if (variant.network === "TIKTOK") endpoint = "/api/publish/tiktok";
      else if (variant.network === "TWITTER") endpoint = "/api/publish/x_twitter";
      else throw new Error("Red no soportada");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, variantId: variant.id }),
      });

      const data = await res.json();

      if (data.ok) {
        toast.success(`Publicado en ${variant.network} ✅`, { id: toastId });
        setPosts(prev => prev.map(p =>
          p.id === post.id
            ? { ...p, variants: p.variants.map(v => v.id === variant.id ? { ...v, status: "PUBLISHED" } : v) }
            : p
        ));
      } else {
        toast.error(`Error ${variant.network}: ${data.error}`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setProcessing(prev => ({ ...prev, [variant.id!]: false }));
    }
  }

  async function handlePublishAll(post: Post) {
    setPublishingAll(prev => ({ ...prev, [post.id]: true }));

    const pendingVariants = post.variants.filter(v => v.status !== "PUBLISHED");
    if (pendingVariants.length === 0) {
      toast("No hay variantes pendientes para publicar.", { icon: "ℹ️" });
      setPublishingAll(prev => ({ ...prev, [post.id]: false }));
      return;
    }

    await Promise.all(pendingVariants.map(v => handlePublishVariant(post, v)));

    setPublishingAll(prev => ({ ...prev, [post.id]: false }));
  }

  function getScheduleDisplay(runAt: string) {
    const target = new Date(runAt);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const timeStr = target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = target.toLocaleDateString();

    if (diffMs <= 0) return { text: `${dateStr} ${timeStr}`, remaining: "Procesando..." };
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    let remaining = diffMins < 60 ? `Faltan ${diffMins} min` : `Faltan ${diffHours} hrs`;
    return { text: `${dateStr} a las ${timeStr}`, remaining };
  }

  const handleExistingVariantTextChange = (postId: number, variantId: number | undefined, newText: string) => {
    if (!variantId) return;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, variants: p.variants.map((v) => v.id === variantId ? { ...v, text: newText } : v) } : p));
  };

  const movePostMedia = (postId: number, direction: "left" | "right", total: number) => {
    setPostMediaIndex((prev) => {
      const current = prev[postId] ?? 0;
      let next = direction === "left" ? current - 1 : current + 1;
      if (next < 0) next = 0;
      if (next >= total) next = total - 1;
      return { ...prev, [postId]: next };
    });
  };

  function isVideoBase64(base64?: string) { return base64?.startsWith("data:video"); }

  // --- LÓGICA DE FILTRADO MEMOIZADA ---
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      // 1. Filtro Texto
      const matchText = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.body.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Filtro Estado
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;

      // 3. Filtro Red (Si el post tiene AL MENOS una variante de esa red)
      const matchNetwork = networkFilter === "ALL" || p.variants.some(v => v.network === networkFilter);

      return matchText && matchStatus && matchNetwork;
    });
  }, [posts, searchTerm, statusFilter, networkFilter]);

  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
  const displayedPosts = filteredPosts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">📋 Biblioteca de Publicaciones</h1>
        <div className="flex gap-4">
          <a href="/composer" className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition">+ Crear Nueva</a>
          <a href="/perfil" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">Cuentas Enlazadas</a>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row gap-4">
        {/* Buscador */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="🔍 Buscar por título o contenido..."
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition h-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro Estado */}
        <div className="md:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500/50 cursor-pointer"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Filtro Red */}
        <div className="md:w-48">
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500/50 cursor-pointer"
          >
            {NETWORK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <p className="text-center animate-pulse">Cargando publicaciones...</p> : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xl text-slate-200/70">No se encontraron resultados con estos filtros.</p>
          <button
            onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); setNetworkFilter("ALL"); }}
            className="text-purple-300 underline mt-2 block w-full"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {displayedPosts.map((p) => {
            const mediaList = p.medias || [];
            const totalMedia = mediaList.length;
            const currentIndex = postMediaIndex[p.id] ?? 0;
            const currentMedia = totalMedia > 0 ? mediaList[Math.min(Math.max(currentIndex, 0), totalMedia - 1)] : null;
            const scheduleInfo = p.schedule ? getScheduleDisplay(p.schedule.runAt) : null;
            const uniqueNetworks = Array.from(new Set(p.variants.map(v => v.network)));

            return (
              <div key={p.id} className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-xl shadow-lg hover:border-white/20 transition">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">

                  {/* Título + Íconos de Redes */}
                  <div className="flex items-center gap-3 overflow-hidden">
                    <h3 className="text-xl font-bold truncate max-w-xs text-white" title={p.title}>
                      {p.title}
                    </h3>

                    {/* Lista de Iconos */}
                    <div className="flex -space-x-2 hover:space-x-1 transition-all duration-300 pl-2">
                      {uniqueNetworks.map((net) => {
                        let iconSrc = null;
                        if (net === "BLUESKY") iconSrc = BskyIcon;
                        if (net === "INSTAGRAM") iconSrc = IgIcon;
                        if (net === "FACEBOOK") iconSrc = FbIcon;
                        if (net === "TIKTOK") iconSrc = TtIcon;
                        if (net === "TWITTER") iconSrc = XIcon;


                        if (!iconSrc) return null;

                        return (
                          <div
                            key={net}
                            className="relative w-6 h-6 z-0 hover:z-10 hover:scale-125 transition-transform drop-shadow-md"
                            title={net}
                          >
                            <Image src={iconSrc} alt={net} fill className="object-contain" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    {p.status === "SCHEDULED" && scheduleInfo && (
                      <div className="text-right">
                        <div className="text-yellow-300 text-sm font-bold flex items-center gap-1 justify-end">🕒 {scheduleInfo.text}</div>
                        <div className="text-yellow-200/70 text-xs">({scheduleInfo.remaining})</div>
                      </div>
                    )}

                    <span className={`text-sm px-3 py-1 rounded-full border ${p.status === "PUBLISHED" ? "bg-green-500/10 text-green-300 border-green-500/30" :
                        p.status === "SCHEDULED" ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" :
                          "bg-gray-500/10 text-gray-300 border-gray-500/30"
                      }`}>
                      {p.status}
                    </span>

                    {/* 🚀 BOTÓN MAESTRO */}
                    <button
                      onClick={() => handlePublishAll(p)}
                      disabled={publishingAll[p.id] || p.variants.every(v => v.status === "PUBLISHED")}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:opacity-50 text-slate-200 px-4 py-1.5 rounded-lg font-bold text-sm shadow-md transition flex items-center gap-2"
                    >
                      {publishingAll[p.id] ? (
                        <><span className="animate-spin">↻</span> Enviando...</>
                      ) : (
                        <>
                          <Image src={UniPostLogo} alt="Logo" width={20} height={20} className="w-5 h-5 object-contain" />
                          Enviar Todas
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-slate-300 mb-4 whitespace-pre-wrap">{p.body}</p>

                {/* MEDIA VIEWER */}
                {currentMedia && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2 flex flex-col items-center">
                    {currentMedia.type === "VIDEO" || currentMedia.mime.startsWith("video") ? (
                      <video src={currentMedia.mediaLocation} controls className="max-h-[300px] rounded-lg object-contain" />
                    ) : (
                      <img src={currentMedia.mediaLocation} alt="media" className="max-h-[300px] w-auto rounded-lg object-contain" />
                    )}
                    {totalMedia > 1 && (
                      <div className="flex items-center gap-3 mt-3">
                        <button onClick={() => movePostMedia(p.id, "left", totalMedia)} disabled={currentIndex === 0} className="px-3 py-1 bg-white/10 rounded disabled:opacity-30 hover:bg-white/20">◀</button>
                        <span className="text-xs text-gray-400">{currentIndex + 1} / {totalMedia}</span>
                        <button onClick={() => movePostMedia(p.id, "right", totalMedia)} disabled={currentIndex === totalMedia - 1} className="px-3 py-1 bg-white/10 rounded disabled:opacity-30 hover:bg-white/20">▶</button>
                      </div>
                    )}
                  </div>
                )}

                {!currentMedia && p.mediaBase64 && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2 flex justify-center">
                    {isVideoBase64(p.mediaBase64) ? (
                      <video src={p.mediaBase64} controls className="max-h-[300px]" />
                    ) : (
                      <img src={p.mediaBase64} alt="media" className="max-h-[300px]" />
                    )}
                  </div>
                )}

                {/* VARIANTES */}
                <div className="space-y-3 mt-6">
                  {p.variants.map((v, i) => (
                    <div key={i} className="flex flex-col md:flex-row gap-4 bg-black/20 border border-white/5 p-4 rounded-lg">
                      <div className="flex-1 group">

                        {/* Cabecera: Red + Estado */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm uppercase tracking-wider text-slate-300">{v.network}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded ${v.status === "PUBLISHED"
                              ? "bg-green-500/20 text-green-200"
                              : "bg-white/10 text-slate-400"
                            }`}>
                            {v.status || "DRAFT"}
                          </span>
                        </div>

                        {/* Área de Texto + Botón Guardar */}
                        {v.status !== "PUBLISHED" ? (
                          <div>
                            <textarea
                              value={v.text}
                              onChange={(e) => handleExistingVariantTextChange(p.id, v.id, e.target.value)}
                              className="w-full text-sm text-slate-200 bg-black/40 border border-white/10 rounded p-3 resize-none focus:border-purple-500 outline-none transition placeholder-white/20 focus:bg-black/60"
                              rows={3}
                              placeholder="Escribe el contenido..."
                            />

                            {/* Botón Guardar (Fuera del textarea) */}
                            {v.id && (
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => handleSaveVariantText(v.id!, v.text)}
                                  disabled={savingVariant[v.id!]}
                                  className="text-xs flex items-center gap-2 bg-white/5 hover:bg-green-600/80 text-slate-400 hover:text-white px-3 py-1.5 rounded-md transition border border-white/10"
                                  title="Guardar cambios de texto"
                                >
                                  {savingVariant[v.id!] ? (
                                    <>Guardando... <span className="animate-spin">↻</span></>
                                  ) : (
                                    <>Guardar texto 💾</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic p-2 border border-transparent">"{v.text}"</p>
                        )}
                      </div>

                      {/* Botón Publicar (Columna Derecha) */}
                      <div className="flex items-start pt-8 md:pt-0">
                        <button
                          onClick={() => handlePublishVariant(p, v)}
                          disabled={v.status === "PUBLISHED" || processing[v.id!]}
                          className={`px-4 py-2 rounded font-bold text-sm shadow-lg transition w-32 flex justify-center ${v.status === "PUBLISHED" ? "bg-gray-700 cursor-not-allowed opacity-50 text-slate-400" :
                              v.network === "BLUESKY" ? "bg-sky-600 hover:bg-sky-500 text-white" :
                                v.network === "INSTAGRAM" ? "bg-pink-600 hover:bg-pink-500 text-white" :
                                  v.network === "FACEBOOK" ? "bg-blue-600 hover:bg-blue-500 text-white" :
                                    v.network === "TIKTOK" ? "bg-black border border-cyan-500/30 hover:bg-gray-900 text-white" :
                                      v.network === "TWITTER" ? "bg-black border border-white/20 hover:bg-neutral-800 text-white" :
                                    
                                      "bg-gray-500"
                            }`}
                        >
                          {v.status === "PUBLISHED" ? "Publicado" :
                            processing[v.id!] ? <span className="animate-spin">↻</span> : "Publicar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end border-t border-white/10 pt-4">
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition flex items-center gap-1">
                    🗑️ Eliminar publicación
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white/10 rounded disabled:opacity-30 hover:bg-white/20 transition text-sm"
          >
            ◀ Anterior
          </button>
          <span className="text-sm text-slate-400">Página {currentPage} de {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white/10 rounded disabled:opacity-30 hover:bg-white/20 transition text-sm"
          >
            Siguiente ▶
          </button>
        </div>
      )}

    </div>
  );
}