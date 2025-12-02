"use client";

import { useEffect, useState, useMemo } from "react";

// 1. Tipo actualizado (igual que antes)
export type FeedVariant = {
  id: number;
  network: "BLUESKY" | "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | string;
  uri: string;
  permalink?: string | null;
  post?: {
    title?: string | null;
    body?: string | null;
    category?: string | null;
  };
};

// --- CONSTANTES ---
const CATEGORIES = ["Todas", "Ilustración", "Evento", "Emprendimiento", "Entretenimiento", "Otro"];
const NETWORKS = [
  { label: "Todas las redes", value: "ALL" },
  { label: "Bluesky", value: "BLUESKY" },
  { label: "Instagram", value: "INSTAGRAM" },
  { label: "Facebook", value: "FACEBOOK" },
  { label: "TikTok", value: "TIKTOK" },
];
const ITEMS_PER_PAGE = 9;

// --- HELPER FUNCTIONS ---
function blueskyAtUriToUrl(atUri: string): string | null {
  try {
    const withoutPrefix = atUri.replace("at://", "");
    const [didOrHandle, , rkey] = withoutPrefix.split("/");
    if (!didOrHandle || !rkey) return null;
    return `https://bsky.app/profile/${encodeURIComponent(didOrHandle)}/post/${rkey}?ref_src=embed`;
  } catch { return null; }
}

function BlueskyEmbed({ uri }: { uri: string }) {
  const postUrl = blueskyAtUriToUrl(uri);
  return (
    <blockquote className="bluesky-embed" data-bluesky-uri={uri} data-bluesky-embed-color-mode="system">
      <p className="text-xs">Ver en {postUrl ? <a href={postUrl} target="_blank" rel="noreferrer" className="underline">Bluesky</a> : "Bluesky"}</p>
    </blockquote>
  );
}

function InstagramEmbed({ permalink }: { permalink: string }) {
  return (
    <blockquote className="instagram-media w-full rounded-xl border border-white/20 bg-black/40" data-instgrm-permalink={permalink} data-instgrm-version="14" style={{ margin: 0 }}>
      <a href={permalink} target="_blank" rel="noreferrer" className="block p-3 text-center text-xs underline">Ver en Instagram</a>
    </blockquote>
  );
}

function XEmbed({ uri }: { uri: string }) {
  return <iframe src={uri} className="h-[380px] w-full rounded-xl border border-white/20 bg-black/40" loading="lazy" />;
}

function FacebookEmbed({ uri }: { uri: string }) {
  return <iframe src={uri} className="h-[380px] w-full rounded-xl border border-white/20 bg-black/40" loading="lazy" />;
}

function renderEmbed(v: FeedVariant) {
  switch (v.network) {
    case "BLUESKY": return <BlueskyEmbed uri={v.uri} />;
    case "INSTAGRAM": return <InstagramEmbed permalink={v.permalink ?? v.uri} />;
    case "X": return <XEmbed uri={v.uri} />;
    case "FACEBOOK": return <FacebookEmbed uri={v.uri} />;
    default: return <a href={v.uri} target="_blank" rel="noreferrer" className="block rounded-xl bg-black/30 p-3 text-center text-xs underline">Ver publicación</a>;
  }
}

function FeedCard({ variant }: { variant: FeedVariant }) {
  return (
    <article className="mb-4 break-inside-avoid rounded-2xl bg-white/5 p-3 shadow-md backdrop-blur border border-white/10 hover:border-white/30 transition duration-300">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full 
          ${variant.network === 'BLUESKY' ? 'bg-sky-900/50 text-sky-200' : 
            variant.network === 'INSTAGRAM' ? 'bg-pink-900/50 text-pink-200' : 
            variant.network === 'FACEBOOK' ? 'bg-blue-900/50 text-blue-200' : 
            variant.network === 'TIKTOK' ? 'bg-cyan-900/50 text-cyan-200' : 
            'bg-gray-700 text-gray-300'}`}>
          {variant.network}
        </span>
        {variant.post?.category && (
           <span className="text-[10px] text-slate-200/50 uppercase tracking-wider border border-white/10 px-2 py-0.5 rounded">
             {variant.post.category}
           </span>
        )}
      </div>
      {renderEmbed(variant)}
    </article>
  );
}

// --- COMPONENTE PRINCIPAL ---

export function PublicFeed() {
  const [items, setItems] = useState<FeedVariant[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedNetwork, setSelectedNetwork] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public-feed");
        const json = await res.json();
        if (json.ok) setItems(json.data);
      } catch (e) {
        console.error("Error loading public feed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCategory === "Todas" || item.post?.category === selectedCategory;
      const matchNet = selectedNetwork === "ALL" || item.network === selectedNetwork;
      return matchCat && matchNet;
    });
  }, [items, selectedCategory, selectedNetwork]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const displayedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedNetwork]);

  useEffect(() => {
    if (displayedItems.length === 0) return;

    const bskyScript = document.createElement("script");
    bskyScript.src = "https://embed.bsky.app/static/embed.js";
    bskyScript.async = true;
    document.body.appendChild(bskyScript);

    if (displayedItems.some((i) => i.network === "INSTAGRAM")) {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
      } else {
        const igScript = document.createElement("script");
        igScript.src = "https://www.instagram.com/embed.js";
        igScript.async = true;
        igScript.onload = () => (window as any).instgrm?.Embeds?.process();
        document.body.appendChild(igScript);
      }
    }

    return () => {
      if(document.body.contains(bskyScript)) document.body.removeChild(bskyScript);
    };
  }, [displayedItems]);

  return (
    <section className="mx-auto max-w-7xl px-4 md:px-6 pb-20" id="feed">
      <h2 className="mb-2 text-center text-3xl font-extrabold sm:text-4xl text-slate-200">
        Lo que se está creando con UniPost
      </h2>
      <p className="mx-auto mb-8 max-w-2xl text-center text-sm opacity-70">
        Un vistazo a publicaciones reales agendadas y publicadas por nuestra comunidad.
      </p>

      {/* --- CONTROLES DE FILTRO --- */}
      <div className="mb-10 flex flex-col gap-6 items-center">
        
        {/* Selector de Red */}
        <div className="w-full max-w-xs">
            <label className="block text-xs text-gray-400 mb-1 text-center">Filtrar por Red Social</label>
            <select 
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-slate-200 text-sm focus:bg-black/80 outline-none transition"
            >
                {NETWORKS.map(net => (
                    <option key={net.value} value={net.value} className="bg-gray-900">{net.label}</option>
                ))}
            </select>
        </div>

        {/* 🛠️ CORRECCIÓN AQUÍ 🛠️ 
            1. Quitamos 'flex justify-center' del contenedor padre (esto rompía el scroll móvil).
            2. Añadimos 'px-4' al hijo y 'min-w-max' para que los botones no se aplasten.
            3. Usamos 'md:justify-center' para que en Desktop sí se centren.
        */}
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex gap-2 px-4 min-w-max md:justify-center md:w-full md:min-w-0">
                {CATEGORIES.map((cat) => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                    selectedCategory === cat
                        ? "bg-indigo-600 border-indigo-500 text-slate-200 shadow-lg shadow-indigo-500/20"
                        : "bg-white/5 border-white/10 text-slate-200/70 hover:bg-white/10 hover:text-slate-200"
                    }`}
                >
                    {cat}
                </button>
                ))}
            </div>
        </div>
      </div>

      {/* --- CONTENIDO --- */}
      {loading && (
        <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
            <p className="text-sm opacity-80">Cargando feed...</p>
        </div>
      )}

      {!loading && displayedItems.length === 0 && (
        <div className="py-20 text-center bg-white/5 rounded-2xl border border-white/10 border-dashed">
            <p className="text-xl opacity-80 mb-2">📭</p>
            <p className="text-sm opacity-80">
                No hay publicaciones que coincidan con estos filtros.
            </p>
            <button 
                onClick={() => { setSelectedCategory("Todas"); setSelectedNetwork("ALL"); }}
                className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline"
            >
                Limpiar filtros
            </button>
        </div>
      )}

      {/* Masonry Grid */}
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 space-y-6">
        {displayedItems.map((v) => (
          <FeedCard key={v.id} variant={v} />
        ))}
      </div>

      {/* --- PAGINACIÓN --- */}
      {!loading && totalPages > 1 && (
        <div className="mt-12 flex justify-center gap-4 items-center">
            <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-bold"
            >
                ◀ Anterior
            </button>
            
            <span className="text-sm font-mono text-slate-200/60">
                Página {currentPage} de {totalPages}
            </span>

            <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-bold"
            >
                Siguiente ▶
            </button>
        </div>
      )}

    </section>
  );
}