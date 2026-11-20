"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { NETWORKS, NETWORK_KEYS, isNetworkKey, networkLabel } from "@/lib/networks";
import { Button, ButtonLink, Card, EmptyState, LoadingState, NetworkBadge, PageHeader, Pagination, StatusBadge, inputClass } from "@/components/ui";

type Variant = { id: number; network: string; text: string; status: string; uri?: string | null; permalink?: string | null };
type Media = { id: number; url: string; type: "IMAGE" | "VIDEO"; mime: string; mediaLocation: string };
type Post = {
  id: number;
  title: string;
  body: string;
  status: string;
  category: string;
  variants: Variant[];
  medias: Media[];
  schedule?: { runAt: string; timezone: string } | null;
};

const ITEMS_PER_PAGE = 8;
const STATUS_TABS = [
  { value: "ALL", label: "Todas" },
  { value: "DRAFT", label: "Borradores" },
  { value: "SCHEDULED", label: "Programadas" },
  { value: "FAILED", label: "Con error" },
  { value: "PUBLISHED", label: "Publicadas" },
];

function relativeSchedule(runAt: string) {
  const target = new Date(runAt);
  const diffMin = Math.round((target.getTime() - Date.now()) / 60000);
  const when = target.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  if (diffMin <= 0) return { when, remaining: "procesando…" };
  if (diffMin < 60) return { when, remaining: `en ${diffMin} min` };
  if (diffMin < 60 * 24) return { when, remaining: `en ${Math.round(diffMin / 60)} h` };
  return { when, remaining: `en ${Math.round(diffMin / 1440)} días` };
}

export default function PublicacionesPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [networkFilter, setNetworkFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchPosts();
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => setPage(1), [search, statusFilter, networkFilter]);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/posts");
      const json = await res.json();
      if (json.ok) setPosts(json.data);
      else toast.error("No se pudieron cargar las publicaciones");
    } catch {
      toast.error("Error de conexión al cargar publicaciones");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: posts.length };
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)) &&
        (statusFilter === "ALL" || p.status === statusFilter) &&
        (networkFilter === "ALL" || p.variants.some((v) => v.network === networkFilter))
    );
  }, [posts, search, statusFilter, networkFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const visiblePosts = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const hasFilters = search || statusFilter !== "ALL" || networkFilter !== "ALL";

  const updatePost = (id: number, fn: (p: Post) => Post) => setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  const removePost = (id: number) => setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Publicaciones" description="Revisa, edita y publica tus borradores. Las programadas se publican solas." actions={<ButtonLink href="/composer">+ Crear publicación</ButtonLink>} />

      {/* Pestañas de estado */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Filtrar por estado">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={statusFilter === t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${statusFilter === t.value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] ${t.value === "FAILED" && counts.FAILED ? "bg-red-500/20 text-red-200" : "bg-white/10 text-slate-400"}`}>{counts[t.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Búsqueda + red */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input type="search" placeholder="Buscar por título o texto…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} sm:flex-1`} aria-label="Buscar publicaciones" />
        <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)} className={`${inputClass} sm:w-52`} aria-label="Filtrar por red">
          <option value="ALL">Todas las redes</option>
          {NETWORK_KEYS.map((n) => <option key={n} value={n}>{NETWORKS[n].label}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Cargando publicaciones..." />
      ) : posts.length === 0 ? (
        <EmptyState icon="📝" title="Aún no tienes publicaciones" description="Crea tu primera publicación y publícala en varias redes a la vez." action={<ButtonLink href="/composer">Crear publicación</ButtonLink>} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Sin resultados"
          description="No hay publicaciones que coincidan con estos filtros."
          action={hasFilters && <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("ALL"); setNetworkFilter("ALL"); }}>Limpiar filtros</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {visiblePosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onChange={(fn) => updatePost(p.id, fn)}
              onDeleted={() => removePost(p.id)}
              onRefresh={fetchPosts}
            />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function PostCard({ post, expanded, onToggle, onChange, onDeleted, onRefresh }: {
  post: Post;
  expanded: boolean;
  onToggle: () => void;
  onChange: (fn: (p: Post) => Post) => void;
  onDeleted: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [publishing, setPublishing] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);

  const pending = post.variants.filter((v) => v.status !== "PUBLISHED");
  const publishedCount = post.variants.length - pending.length;
  const cover = post.medias[0];
  const schedule = post.status === "SCHEDULED" && post.schedule ? relativeSchedule(post.schedule.runAt) : null;
  const anyPublishing = Object.values(publishing).some(Boolean);

  async function publishVariant(v: Variant): Promise<boolean> {
    if (!isNetworkKey(v.network)) return false;
    setPublishing((s) => ({ ...s, [v.id]: true }));
    const toastId = toast.loading(`Publicando en ${networkLabel(v.network)}…`);
    try {
      const res = await fetch(NETWORKS[v.network].publishEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, variantId: v.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error desconocido");
      toast.success(`Publicado en ${networkLabel(v.network)}`, { id: toastId });
      onChange((p) => ({ ...p, variants: p.variants.map((x) => (x.id === v.id ? { ...x, status: "PUBLISHED" } : x)) }));
      return true;
    } catch (err) {
      toast.error(`${networkLabel(v.network)}: ${(err as Error).message}`, { id: toastId, duration: 6000 });
      return false;
    } finally {
      setPublishing((s) => ({ ...s, [v.id]: false }));
    }
  }

  async function publishAll() {
    await Promise.all(pending.map(publishVariant));
    await onRefresh();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts?id=${post.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error();
      toast.success("Publicación eliminada");
      onDeleted();
    } catch {
      toast.error("No se pudo eliminar");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <li>
      <Card className="overflow-hidden">
        {/* Resumen */}
        <div className="flex gap-4 p-4 sm:p-5">
          <button type="button" onClick={onToggle} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:h-24 sm:w-24" aria-label={expanded ? "Ocultar detalles" : "Ver detalles"}>
            {cover ? (
              cover.type === "VIDEO" ? (
                <video src={cover.mediaLocation} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.mediaLocation} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <span className="flex h-full items-center justify-center text-2xl text-slate-600" aria-hidden="true">Aa</span>
            )}
            {post.medias.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 text-[10px] text-white">+{post.medias.length - 1}</span>}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white" title={post.title}>{post.title}</h3>
              <StatusBadge status={post.status} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">{post.body || <span className="italic text-slate-600">Sin texto principal</span>}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {post.variants.map((v) => (
                <span key={v.id} className="relative" title={`${networkLabel(v.network)}: ${v.status === "PUBLISHED" ? "publicado" : v.status === "FAILED" ? "con error" : "pendiente"}`}>
                  <NetworkBadge network={v.network} withLabel={false} />
                  {v.status === "PUBLISHED" && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />}
                  {v.status === "FAILED" && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400 ring-2 ring-slate-900" />}
                </span>
              ))}
              <span className="text-xs text-slate-500">{publishedCount}/{post.variants.length} publicadas</span>
              {schedule && <span className="text-xs text-amber-200">· 🕒 {schedule.when} ({schedule.remaining})</span>}
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
            {pending.length > 0 && (
              <Button size="sm" onClick={publishAll} loading={anyPublishing}>
                {pending.length === post.variants.length ? "Publicar ahora" : `Publicar ${pending.length} pendiente${pending.length > 1 ? "s" : ""}`}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onToggle} aria-expanded={expanded}>{expanded ? "Ocultar" : "Editar / detalles"}</Button>
          </div>
        </div>

        {/* Acciones móviles */}
        <div className="flex gap-2 border-t border-white/5 px-4 py-2 sm:hidden">
          {pending.length > 0 && <Button size="sm" className="flex-1" onClick={publishAll} loading={anyPublishing}>Publicar ahora</Button>}
          <Button size="sm" variant="secondary" className="flex-1" onClick={onToggle} aria-expanded={expanded}>{expanded ? "Ocultar" : "Detalles"}</Button>
        </div>

        {/* Detalle */}
        {expanded && (
          <div className="space-y-5 border-t border-white/10 bg-black/10 p-4 sm:p-5">
            {post.medias.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex max-h-80 w-full justify-center overflow-hidden rounded-xl bg-black/40">
                  {post.medias[mediaIndex].type === "VIDEO" ? (
                    <video src={post.medias[mediaIndex].mediaLocation} controls className="max-h-80" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.medias[mediaIndex].mediaLocation} alt={`Archivo ${mediaIndex + 1}`} className="max-h-80 object-contain" />
                  )}
                </div>
                {post.medias.length > 1 && (
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <Button size="sm" variant="ghost" onClick={() => setMediaIndex((i) => Math.max(0, i - 1))} disabled={mediaIndex === 0} aria-label="Anterior">←</Button>
                    {mediaIndex + 1} / {post.medias.length}
                    <Button size="sm" variant="ghost" onClick={() => setMediaIndex((i) => Math.min(post.medias.length - 1, i + 1))} disabled={mediaIndex === post.medias.length - 1} aria-label="Siguiente">→</Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {post.variants.map((v) => (
                <VariantRow key={v.id} variant={v} fallbackText={post.body} publishing={!!publishing[v.id]} onPublish={() => publishVariant(v)} onSaved={(text) => onChange((p) => ({ ...p, variants: p.variants.map((x) => (x.id === v.id ? { ...x, text } : x)) }))} />
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-4">
              {confirmDelete ? (
                <>
                  <span className="mr-auto text-sm text-red-200">¿Eliminar definitivamente? Esto no se puede deshacer.</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                  <Button size="sm" variant="danger" onClick={handleDelete} loading={deleting}>Sí, eliminar</Button>
                </>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar publicación</Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

function VariantRow({ variant, fallbackText, publishing, onPublish, onSaved }: { variant: Variant; fallbackText: string; publishing: boolean; onPublish: () => void; onSaved: (text: string) => void }) {
  const [text, setText] = useState(variant.text);
  const [saving, setSaving] = useState(false);
  const dirty = text !== variant.text;
  const isPublished = variant.status === "PUBLISHED";
  const limit = isNetworkKey(variant.network) ? NETWORKS[variant.network].charLimit : 2200;
  const effectiveLength = (text.trim() ? text : fallbackText).length;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id, text }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error();
      toast.success("Cambios guardados");
      onSaved(text);
    } catch {
      toast.error("No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  }

  const link = variant.permalink || null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isNetworkKey(variant.network) && <Image src={NETWORKS[variant.network].icon} alt="" width={18} height={18} className="h-[18px] w-[18px]" />}
        <span className="text-sm font-semibold text-white">{networkLabel(variant.network)}</span>
        <StatusBadge status={variant.status} />
        {link && <a href={link} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:underline">Ver publicación ↗</a>}
        {!isPublished && <span className={`ml-auto font-mono text-xs ${effectiveLength > limit ? "text-red-300" : "text-slate-500"}`}>{effectiveLength}/{limit}</span>}
      </div>

      {isPublished ? (
        <p className="whitespace-pre-wrap text-sm text-slate-400">{variant.text || fallbackText}</p>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder={fallbackText ? `Usa el texto principal: "${fallbackText.slice(0, 80)}${fallbackText.length > 80 ? "…" : ""}"` : "Escribe el texto…"} aria-label={`Texto para ${networkLabel(variant.network)}`} />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {dirty && <Button size="sm" variant="ghost" onClick={() => setText(variant.text)}>Descartar</Button>}
            <Button size="sm" variant="secondary" onClick={save} loading={saving} disabled={!dirty}>{dirty ? "Guardar cambios" : "Guardado"}</Button>
            <Button size="sm" onClick={onPublish} loading={publishing} disabled={dirty || effectiveLength > limit} title={dirty ? "Guarda los cambios antes de publicar" : undefined}>
              {variant.status === "FAILED" ? "Reintentar" : "Publicar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
