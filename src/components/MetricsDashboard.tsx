"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import Image from "next/image";
import toast from "react-hot-toast";
import { calculateHashtagPerformance } from "@/utils/analytics";
import { NETWORKS, NETWORK_KEYS, networkLabel, type NetworkKey } from "@/lib/networks";
import { Avatar, Button, ButtonLink, Card, EmptyState, LoadingState, NetworkBadge, PageHeader, Pagination } from "@/components/ui";

export type Metric = {
  id: number | string;
  network: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number | null;
  collectedAt: string | null;
  variant?: { date_sent: string | null };
  post: { title: string; text?: string };
};

type ApiMetric = {
  id: number;
  network: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number | null;
  collectedAt: string | null;
  Variant?: { text?: string | null; date_sent?: string | null } | null;
  post?: { title?: string | null; body?: string | null } | null;
};

type Profile = Record<string, unknown> & { picture?: { data?: { url?: string } } };
type ProfileSummary = { avatar: string | null; name: string | null; handle: string | null; followers: number | null };

const num = (v: unknown) => (typeof v === "number" ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-CL"));

// Endpoint de perfil y normalización por red.
const PROFILE_SOURCES: Record<NetworkKey, { endpoint: string; normalize: (p: Profile) => ProfileSummary }> = {
  INSTAGRAM: { endpoint: "/api/instagram/profile", normalize: (p) => ({ avatar: str(p.profilePictureUrl), name: str(p.name) ?? str(p.username), handle: str(p.username), followers: num(p.followers) }) },
  FACEBOOK: { endpoint: "/api/facebook/profile", normalize: (p) => ({ avatar: p.picture?.data?.url ?? null, name: str(p.name), handle: null, followers: num(p.followers_count) }) },
  TWITTER: { endpoint: "/api/x_twitter/profile", normalize: (p) => ({ avatar: str(p.avatar), name: str(p.name), handle: str(p.username), followers: num(p.followers) }) },
  BLUESKY: { endpoint: "/api/bsky/profile", normalize: (p) => ({ avatar: str(p.avatar), name: str(p.displayName), handle: str(p.handle), followers: num(p.followers) }) },
  TIKTOK: { endpoint: "/api/tiktok/profile", normalize: (p) => ({ avatar: str(p.avatar_url), name: str(p.display_name), handle: str(p.username), followers: num(p.follower_count) }) },
};

type TabKey = "GENERAL" | NetworkKey;
type SortKey = "likes" | "comments" | "dateSent";
const ITEMS_PER_PAGE = 10;

const metricDate = (m: Metric) => m.variant?.date_sent || m.collectedAt;

interface Props {
  targetUserId?: number;
  userName?: string;
}

export default function MetricsDashboard({ targetUserId, userName }: Props) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Partial<Record<NetworkKey, ProfileSummary | null>>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("GENERAL");
  const [currentPage, setCurrentPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "dateSent", dir: "desc" });

  const withUser = useCallback((endpoint: string) => (targetUserId ? `${endpoint}?userId=${targetUserId}` : endpoint), [targetUserId]);

  useEffect(() => {
    NETWORK_KEYS.forEach((key) => {
      const src = PROFILE_SOURCES[key];
      fetch(withUser(src.endpoint))
        .then((r) => r.json())
        .then((d) => setProfiles((p) => ({ ...p, [key]: d.ok && d.profile ? src.normalize(d.profile) : null })))
        .catch(() => setProfiles((p) => ({ ...p, [key]: null })));
    });
  }, [withUser]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(withUser("/api/metrics/list")).then((r) => r.json());
      if (!data.ok) throw new Error();
      setMetrics(
        (data.metrics as ApiMetric[]).map((m) => ({
          id: m.id,
          network: m.network,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          impressions: m.impressions,
          collectedAt: m.collectedAt,
          variant: { date_sent: m.Variant?.date_sent || null },
          post: { title: m.post?.title || "(Sin título)", text: m.Variant?.text || m.post?.body || "" },
        }))
      );
    } catch {
      toast.error("No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, [withUser]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => setCurrentPage(1), [activeTab, sort]);

  const filtered = useMemo(() => (activeTab === "GENERAL" ? metrics : metrics.filter((m) => m.network === activeTab)), [metrics, activeTab]);

  const sorted = useMemo(() => {
    const value = (m: Metric) => (sort.key === "dateSent" ? new Date(metricDate(m) || 0).getTime() : m[sort.key]);
    return [...filtered].sort((a, b) => (sort.dir === "asc" ? value(a) - value(b) : value(b) - value(a)));
  }, [filtered, sort]);

  const totals = useMemo(
    () => filtered.reduce((acc, m) => ({ likes: acc.likes + m.likes, comments: acc.comments + m.comments, shares: acc.shares + (m.shares || 0) }), { likes: 0, comments: 0, shares: 0 }),
    [filtered]
  );

  const hashtagStats = useMemo(() => calculateHashtagPerformance(filtered).slice(0, 5), [filtered]);

  const chartData = useMemo(() => {
    const byNetwork = new Map<string, { network: string; likes: number; comments: number }>();
    for (const m of filtered) {
      const row = byNetwork.get(m.network) ?? { network: networkLabel(m.network), likes: 0, comments: 0 };
      row.likes += m.likes;
      row.comments += m.comments;
      byNetwork.set(m.network, row);
    }
    return [...byNetwork.values()].sort((a, b) => b.likes - a.likes);
  }, [filtered]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const pageRows = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  async function handleRefresh() {
    setSyncing(true);
    try {
      const res = await fetch("/api/metrics/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetUserId ? { targetUserId } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo sincronizar");
      toast.success(`Métricas actualizadas (${data.processed ?? 0} publicaciones)`);
      await loadMetrics();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const avgLikes = (network: NetworkKey) => {
    const list = metrics.filter((m) => m.network === network);
    return list.length ? (list.reduce((a, m) => a + m.likes, 0) / list.length).toFixed(1) : null;
  };

  const SortHeader = ({ k, label, align }: { k: SortKey; label: string; align: "center" | "right" }) => (
    <th scope="col" className={`px-4 py-3 font-medium ${align === "center" ? "text-center" : "text-right"}`} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-white" onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}>
        {label}
        <span aria-hidden="true" className={sort.key === k ? "text-slate-200" : "text-slate-600"}>{sort.key === k ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={userName ? `Métricas de ${userName}` : "Métricas"}
        description="Interacciones de tus publicaciones en cada red. Actualiza para traer los datos más recientes."
        actions={<Button onClick={handleRefresh} loading={syncing}>{syncing ? "Sincronizando…" : "Actualizar métricas"}</Button>}
      />

      {/* Cuentas */}
      <section aria-label="Cuentas conectadas" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {NETWORK_KEYS.map((key) => {
          const p = profiles[key];
          const meta = NETWORKS[key];
          return (
            <Card key={key} className="flex items-center gap-3 p-4">
              {p === undefined ? (
                <div className="h-10 w-full animate-pulse rounded-lg bg-white/5" />
              ) : p ? (
                <>
                  <div className="relative">
                    <Avatar src={p.avatar} name={p.name} size={40} />
                    <Image src={meta.icon} alt={meta.label} width={16} height={16} className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-slate-900" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{p.name || p.handle}</p>
                    <p className="text-xs text-slate-400">
                      {fmt(p.followers)} seguidores{avgLikes(key) && <> · {avgLikes(key)} ♥/post</>}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Image src={meta.icon} alt="" width={28} height={28} className="h-7 w-7 opacity-50" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-300">{meta.label}</p>
                    <p className="text-xs text-slate-500">No conectada</p>
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </section>

      {/* Filtro por red */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por red">
        {(["GENERAL", ...NETWORK_KEYS] as TabKey[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${active ? "border-indigo-400/60 bg-indigo-500/20 text-white" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}
            >
              {tab !== "GENERAL" && <Image src={NETWORKS[tab].icon} alt="" width={14} height={14} className="h-3.5 w-3.5" />}
              {tab === "GENERAL" ? "Todas" : NETWORKS[tab].label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingState label="Cargando métricas..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📊"
          title={metrics.length === 0 ? "Aún no hay métricas" : "Sin datos para esta red"}
          description={metrics.length === 0 ? "Publica en tus redes y luego presiona “Actualizar métricas” para ver cómo les va." : "Prueba con otra red o actualiza las métricas."}
          action={!targetUserId && metrics.length === 0 ? <ButtonLink href="/composer">Crear publicación</ButtonLink> : undefined}
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat label="Publicaciones medidas" value={filtered.length} />
            <SummaryStat label="Me gusta" value={totals.likes} />
            <SummaryStat label="Comentarios" value={totals.comments} />
            <SummaryStat label="Compartidos" value={totals.shares} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-3">
              <h2 className="mb-4 font-semibold text-white">Interacciones por red</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="network" stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={{ backgroundColor: "#0f172a", borderRadius: 12, border: "1px solid #ffffff20", color: "#fff" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="likes" name="Me gusta" fill="#f472b6" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Bar dataKey="comments" name="Comentarios" fill="#818cf8" radius={[6, 6, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-1 font-semibold text-white">Hashtags con más interacción</h2>
              <p className="mb-4 text-xs text-slate-500">Promedio de me gusta + comentarios por publicación.</p>
              {hashtagStats.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Tus publicaciones aún no usan hashtags.</p>
              ) : (
                <ol className="space-y-2">
                  {hashtagStats.map((tag, i) => (
                    <li key={tag.tag} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                      <span className="w-4 text-xs text-slate-500">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-indigo-200" title={tag.tag}>{tag.tag}</span>
                      <span className="text-xs text-slate-400">{tag.postsCount} posts</span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">{tag.efficiency.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="font-semibold text-white">Detalle por publicación</h2>
              <span className="text-xs text-slate-500">{sorted.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-white/10">
                    <th scope="col" className="px-4 py-3 font-medium">Red</th>
                    <th scope="col" className="px-4 py-3 font-medium">Publicación</th>
                    <SortHeader k="likes" label="Me gusta" align="center" />
                    <SortHeader k="comments" label="Comentarios" align="center" />
                    <SortHeader k="dateSent" label="Fecha" align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pageRows.map((m) => {
                    const date = metricDate(m);
                    return (
                      <tr key={m.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3"><NetworkBadge network={m.network} /></td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate font-medium text-slate-100">{m.post.title}</p>
                          {m.post.text && <p className="mt-0.5 truncate text-xs text-slate-500">{m.post.text}</p>}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{fmt(m.likes)}</td>
                        <td className="px-4 py-3 text-center tabular-nums">{fmt(m.comments)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">
                          {date ? new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pb-5">
              <Pagination page={currentPage} totalPages={totalPages} onChange={setCurrentPage} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{fmt(value)}</p>
    </Card>
  );
}
