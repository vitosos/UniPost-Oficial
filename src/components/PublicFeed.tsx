"use client";

import { useEffect, useMemo, useState } from "react";
import { NETWORKS, NETWORK_KEYS, isNetworkKey } from "@/lib/networks";
import { Button, EmptyState, LoadingState, NetworkBadge, Pagination } from "@/components/ui";

export type FeedVariant = {
  id: number;
  network: string;
  uri: string;
  permalink?: string | null;
  post?: { title?: string | null; body?: string | null; category?: string | null };
};

type EmbedWindow = Window & {
  instgrm?: { Embeds: { process: () => void } };
  twttr?: { widgets: { load: () => void } };
};

const CATEGORIES = ["Todas", "Ilustración", "Evento", "Emprendimiento", "Entretenimiento", "Otro"];
const ITEMS_PER_PAGE = 9;

/** Solo enlaces http(s); evita esquemas como javascript:. */
function safeUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function blueskyAtUriToUrl(atUri: string): string | null {
  const [didOrHandle, , rkey] = atUri.replace("at://", "").split("/");
  if (!didOrHandle || !rkey) return null;
  return `https://bsky.app/profile/${encodeURIComponent(didOrHandle)}/post/${encodeURIComponent(rkey)}`;
}

function loadScript(src: string, onLoad?: () => void) {
  if (document.querySelector(`script[src="${src}"]`)) return false;
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  if (onLoad) s.onload = onLoad;
  document.body.appendChild(s);
  return true;
}

function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <p className="rounded-xl bg-black/30 p-4 text-center text-sm text-slate-500">Publicación no disponible</p>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 bg-black/30 p-4 text-center text-sm font-medium text-slate-200 transition hover:bg-white/5">
      {label} ↗
    </a>
  );
}

function renderEmbed(v: FeedVariant) {
  switch (v.network) {
    case "BLUESKY":
      return (
        <blockquote className="bluesky-embed" data-bluesky-uri={v.uri} data-bluesky-embed-color-mode="dark">
          <ExternalLink href={blueskyAtUriToUrl(v.uri)} label="Ver en Bluesky" />
        </blockquote>
      );
    case "INSTAGRAM": {
      const permalink = safeUrl(v.permalink ?? v.uri);
      if (!permalink) return <ExternalLink href={null} label="" />;
      return (
        <blockquote className="instagram-media w-full rounded-xl border border-white/10 bg-black/40" data-instgrm-permalink={permalink} data-instgrm-version="14" style={{ margin: 0 }}>
          <ExternalLink href={permalink} label="Ver en Instagram" />
        </blockquote>
      );
    }
    case "TWITTER":
      return (
        <div className="flex w-full justify-center overflow-hidden rounded-xl">
          <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
            <ExternalLink href={`https://x.com/i/status/${encodeURIComponent(v.uri)}`} label="Ver en X" />
          </blockquote>
        </div>
      );
    case "FACEBOOK":
      return <ExternalLink href={safeUrl(v.permalink) ?? `https://facebook.com/${encodeURIComponent(v.uri)}`} label="Ver en Facebook" />;
    case "TIKTOK":
      return <ExternalLink href={safeUrl(v.permalink) ?? `https://www.tiktok.com/embed/${encodeURIComponent(v.uri)}`} label="Ver en TikTok" />;
    default:
      return <ExternalLink href={safeUrl(v.permalink ?? v.uri)} label="Ver publicación" />;
  }
}

export function PublicFeed() {
  const [items, setItems] = useState<FeedVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Todas");
  const [network, setNetwork] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/public-feed")
      .then((r) => r.json())
      .then((json) => json.ok && setItems(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => (category === "Todas" || i.post?.category === category) && (network === "ALL" || i.network === network)),
    [items, category, network]
  );

  useEffect(() => setPage(1), [category, network]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const displayed = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);

  // Carga (una sola vez) los scripts de embeds y re-procesa al cambiar la página.
  useEffect(() => {
    if (displayed.length === 0) return;
    const w = window as EmbedWindow;
    if (displayed.some((i) => i.network === "BLUESKY")) {
      // El script de Bluesky solo escanea al cargar, así que se recarga en cada cambio.
      document.querySelector('script[src="https://embed.bsky.app/static/embed.js"]')?.remove();
      loadScript("https://embed.bsky.app/static/embed.js");
    }
    if (displayed.some((i) => i.network === "INSTAGRAM")) {
      if (!loadScript("https://www.instagram.com/embed.js", () => w.instgrm?.Embeds.process())) w.instgrm?.Embeds.process();
    }
    if (displayed.some((i) => i.network === "TWITTER")) {
      if (!loadScript("https://platform.twitter.com/widgets.js")) w.twttr?.widgets.load();
    }
  }, [displayed]);

  const resetFilters = () => {
    setCategory("Todas");
    setNetwork("ALL");
  };

  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "border-indigo-400/60 bg-indigo-500/20 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
      <h2 className="mb-2 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Lo que se está creando con UniPost</h2>
      <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-slate-400">Publicaciones reales de nuestra comunidad, publicadas desde UniPost.</p>

      <div className="mb-8 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 md:justify-center" role="group" aria-label="Filtrar por red">
          <button className={chip(network === "ALL")} onClick={() => setNetwork("ALL")} aria-pressed={network === "ALL"}>Todas las redes</button>
          {NETWORK_KEYS.map((k) => (
            <button key={k} className={chip(network === k)} onClick={() => setNetwork(k)} aria-pressed={network === k}>{NETWORKS[k].label}</button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:justify-center" role="group" aria-label="Filtrar por categoría">
          {CATEGORIES.map((c) => (
            <button key={c} className={chip(category === c)} onClick={() => setCategory(c)} aria-pressed={category === c}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Cargando publicaciones..." />
      ) : displayed.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No hay publicaciones con estos filtros"
          action={(category !== "Todas" || network !== "ALL") && <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>}
        />
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {displayed.map((v) => (
            <article key={v.id} className="mb-5 break-inside-avoid rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                {isNetworkKey(v.network) ? <NetworkBadge network={v.network} /> : <span className="text-xs text-slate-400">{v.network}</span>}
                {v.post?.category && <span className="text-[11px] uppercase tracking-wide text-slate-500">{v.post.category}</span>}
              </div>
              {renderEmbed(v)}
            </article>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}
