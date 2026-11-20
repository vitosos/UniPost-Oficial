"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { NETWORKS, NETWORK_KEYS, type NetworkKey } from "@/lib/networks";
import { Alert, Button, ButtonLink, Card, Field, LoadingState, PageHeader, inputClass } from "@/components/ui";

// --- TIPOS ---
type NewMedia = { id: string; file: File; previewUrl: string; type: "image" | "video" };
type UserConnections = Partial<Record<NetworkKey, { connected: boolean; username?: string }>>;

const CATEGORIES = ["Ilustración", "Evento", "Emprendimiento", "Entretenimiento", "Otro"];
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;

const TIMEZONES = [
  { label: "Santiago", id: "America/Santiago" },
  { label: "Buenos Aires", id: "America/Argentina/Buenos_Aires" },
  { label: "Bogotá / Lima / Quito", id: "America/Bogota" },
  { label: "Ciudad de México", id: "America/Mexico_City" },
  { label: "Caracas / La Paz", id: "America/Caracas" },
  { label: "Nueva York / Miami", id: "America/New_York" },
  { label: "Los Ángeles", id: "America/Los_Angeles" },
  { label: "Madrid / París / Roma", id: "Europe/Madrid" },
  { label: "Londres / Lisboa", id: "Europe/London" },
  { label: "Tokio", id: "Asia/Tokyo" },
  { label: "UTC", id: "UTC" },
];

// --- HELPERS ---

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en un instante dado. */
function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - instant;
}

/** Convierte "fecha + hora de pared en una zona" a un Date UTC (correcto también con cambio de horario). */
function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - zoneOffsetMs(wall, timeZone);
  utc = wall - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

function computeRules(networks: NetworkKey[]) {
  let maxImages = 10;
  let allowMix = true;
  let minMedia = 0;
  let videoOnly = false;
  if (networks.includes("TIKTOK")) { maxImages = 0; minMedia = 1; allowMix = false; videoOnly = true; }
  if (networks.includes("BLUESKY") || networks.includes("TWITTER")) { maxImages = Math.min(maxImages, 4); allowMix = false; }
  if (networks.includes("INSTAGRAM")) minMedia = Math.max(minMedia, 1);
  return { maxImages, maxVideos: 1, allowMix, minMedia, videoOnly };
}

// --- PÁGINA ---

export default function ComposerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [connections, setConnections] = useState<UserConnections>({});
  const [loadingConnections, setLoadingConnections] = useState(true);

  const [selected, setSelected] = useState<NetworkKey[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [customTexts, setCustomTexts] = useState<Partial<Record<NetworkKey, string>>>({});
  const [activeCustomTab, setActiveCustomTab] = useState<NetworkKey | null>(null);
  const [category, setCategory] = useState("Otro");
  const [visible, setVisible] = useState(false);
  const [medias, setMedias] = useState<NewMedia[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [scheduleMode, setScheduleMode] = useState<"draft" | "schedule">("draft");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("12:00");
  const [zona, setZona] = useState("America/Santiago");
  const [previewNetwork, setPreviewNetwork] = useState<NetworkKey | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Cargar conexiones y zona horaria del navegador
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setZona(tz);
    } catch {}

    fetch("/api/users/connections")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setConnections(data.connections);
        const first = NETWORK_KEYS.find((n) => data.connections[n]?.connected);
        if (first) setSelected([first]);
      })
      .catch(() => toast.error("No se pudieron cargar tus cuentas conectadas"))
      .finally(() => setLoadingConnections(false));
  }, []);

  // Liberar las URLs de previsualización al desmontar
  const mediasRef = useRef(medias);
  mediasRef.current = medias;
  useEffect(() => () => mediasRef.current.forEach((m) => URL.revokeObjectURL(m.previewUrl)), []);

  const connectedNetworks = NETWORK_KEYS.filter((n) => connections[n]?.connected);
  const rules = useMemo(() => computeRules(selected), [selected]);
  const imageCount = medias.filter((m) => m.type === "image").length;
  const videoCount = medias.filter((m) => m.type === "video").length;
  const textFor = (n: NetworkKey) => customTexts[n]?.trim() ? customTexts[n]! : body;

  // Mantener las pestañas sincronizadas con las redes seleccionadas
  useEffect(() => {
    if (!activeCustomTab || !selected.includes(activeCustomTab)) setActiveCustomTab(selected[0] ?? null);
    if (!previewNetwork || !selected.includes(previewNetwork)) setPreviewNetwork(selected[0] ?? null);
  }, [selected, activeCustomTab, previewNetwork]);

  // --- VALIDACIÓN (lista de problemas que bloquean el envío) ---
  const issues = useMemo(() => {
    const list: string[] = [];
    if (selected.length === 0) list.push("Elige al menos una red social.");
    if (!title.trim()) list.push("Agrega un título interno.");
    if (!body.trim() && selected.some((n) => !customTexts[n]?.trim())) list.push("Escribe el texto de la publicación.");
    for (const n of selected) {
      const len = textFor(n).length;
      if (len > NETWORKS[n].charLimit) list.push(`El texto para ${NETWORKS[n].label} supera ${NETWORKS[n].charLimit} caracteres (${len}).`);
    }
    if (medias.length < rules.minMedia) list.push(`${selected.includes("TIKTOK") ? "TikTok requiere un video" : "Instagram requiere al menos una imagen o video"}.`);
    if (imageCount > rules.maxImages) list.push(rules.maxImages === 0 ? "TikTok no admite imágenes: quita las imágenes o desmarca TikTok." : `Máximo ${rules.maxImages} imágenes para las redes elegidas.`);
    if (videoCount > rules.maxVideos) list.push("Solo se permite 1 video.");
    if (!rules.allowMix && imageCount > 0 && videoCount > 0) list.push("Las redes elegidas no permiten mezclar fotos y videos.");
    if (scheduleMode === "schedule") {
      if (!fecha || !hora) list.push("Elige fecha y hora para programar.");
      else if (zonedTimeToUtc(fecha, hora, zona).getTime() <= Date.now() + 60_000) list.push("La fecha programada debe ser futura.");
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, title, body, customTexts, medias, rules, imageCount, videoCount, scheduleMode, fecha, hora, zona]);

  // --- MULTIMEDIA ---
  function addFiles(files: FileList | File[]) {
    let current = [...medias];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) { toast.error(`"${file.name}" no es una imagen ni un video.`); continue; }
      const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > maxMb * 1024 * 1024) { toast.error(`"${file.name}" supera ${maxMb} MB.`); continue; }
      if (isImage && rules.maxImages === 0) { toast.error("TikTok solo admite video."); continue; }
      if (isImage && current.filter((m) => m.type === "image").length >= rules.maxImages) { toast.error(`Máximo ${rules.maxImages} imágenes para las redes elegidas.`); continue; }
      if (isVideo && current.some((m) => m.type === "video")) { toast.error("Solo se permite 1 video."); continue; }
      if (!rules.allowMix && current.some((m) => m.type !== (isVideo ? "video" : "image"))) { toast.error("Las redes elegidas no permiten mezclar fotos y videos."); continue; }
      current = [...current, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), type: isVideo ? "video" : "image" }];
    }
    setMedias(current);
  }

  function moveMedia(index: number, delta: -1 | 1) {
    setMedias((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }

  function removeMedia(id: string) {
    setMedias((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m) URL.revokeObjectURL(m.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }

  function toggleNetwork(n: NetworkKey) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  // --- ENVÍO ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (issues.length > 0) {
      toast.error("Revisa los puntos pendientes antes de continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const encoded = await Promise.all(medias.map(async (m, order) => ({ base64: await readAsDataUrl(m.file), type: m.type, order })));
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body,
          category,
          visible,
          variants: selected.map((n) => ({ network: n, text: customTexts[n]?.trim() ? customTexts[n] : "" })),
          medias: encoded,
          schedule: scheduleMode === "schedule" ? { runAt: zonedTimeToUtc(fecha, hora, zona).toISOString(), timezone: zona } : null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo guardar");
      toast.success(scheduleMode === "schedule" ? "Publicación programada 📅" : "Borrador guardado. Publícalo desde Publicaciones.");
      router.push("/publicaciones");
    } catch (err) {
      toast.error((err as Error).message || "Error al guardar");
      setSubmitting(false);
    }
  }

  if (loadingConnections) return <LoadingState label="Cargando tus cuentas..." />;

  if (connectedNetworks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Crear publicación" />
        <Card className="p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">🔗</div>
          <h2 className="text-xl font-semibold text-white">Primero conecta una red social</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Para crear publicaciones necesitas enlazar al menos una cuenta (Instagram, Facebook, X, Bluesky o TikTok).</p>
          <ButtonLink href="/perfil" className="mt-6">Conectar mis cuentas</ButtonLink>
        </Card>
      </div>
    );
  }

  const previewText = previewNetwork ? textFor(previewNetwork) : body;
  const tightest = selected.length ? selected.reduce((a, b) => (NETWORKS[a].charLimit < NETWORKS[b].charLimit ? a : b)) : null;
  const scheduledDate = scheduleMode === "schedule" && fecha && hora ? zonedTimeToUtc(fecha, hora, zona) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Crear publicación" description="Escribe una vez y adáptala a cada red. Puedes guardarla como borrador o programarla." />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* 1. Redes */}
          <Card className="p-5 sm:p-6">
            <SectionTitle step={1} title="¿Dónde quieres publicar?" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Redes sociales">
              {NETWORK_KEYS.map((n) => {
                const meta = NETWORKS[n];
                const conn = connections[n];
                const isOn = selected.includes(n);
                if (!conn?.connected) {
                  return (
                    <Link key={n} href="/perfil" className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm text-slate-500 hover:border-white/25 hover:text-slate-300" title={`Conectar ${meta.label}`}>
                      <Image src={meta.icon} alt="" width={18} height={18} className="h-[18px] w-[18px] opacity-40 grayscale" />
                      {meta.label}
                      <span className="text-xs">+ Conectar</span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNetwork(n)}
                    aria-pressed={isOn}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${isOn ? "border-indigo-400/60 bg-indigo-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"}`}
                  >
                    <Image src={meta.icon} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                    <span>{meta.label}</span>
                    {conn.username && <span className="hidden text-xs text-slate-400 sm:inline">@{conn.username.replace(/^@/, "")}</span>}
                    <span aria-hidden="true" className={`ml-1 flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${isOn ? "border-indigo-300 bg-indigo-400 text-slate-950" : "border-slate-500"}`}>{isOn ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 2. Contenido */}
          <Card className="space-y-5 p-5 sm:p-6">
            <SectionTitle step={2} title="Contenido" />
            <Field label="Título interno" htmlFor="title" hint="Solo lo ves tú, para encontrar la publicación después.">
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputClass} placeholder="Ej: Lanzamiento colección verano" aria-invalid={submitted && !title.trim()} />
            </Field>

            <Field
              label="Texto de la publicación"
              htmlFor="body"
              aside={tightest && <CharCounter count={body.length} limit={NETWORKS[tightest].charLimit} label={NETWORKS[tightest].label} />}
              hint="Se usa en todas las redes, salvo que lo personalices más abajo."
            >
              <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={`${inputClass} resize-y`} placeholder="¿Qué quieres compartir? Puedes usar #hashtags" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría" htmlFor="category">
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-200">Feed público de UniPost</span>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5">
                  <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
                  <span className="text-sm text-slate-300">Mostrar en el inicio una vez publicada <span className="block text-xs text-slate-500">Otros visitantes podrán verla en el feed.</span></span>
                </label>
              </div>
            </div>
          </Card>

          {/* 3. Multimedia */}
          <Card className="p-5 sm:p-6">
            <SectionTitle step={3} title="Imágenes y video" optional={rules.minMedia === 0} />
            <p className="-mt-2 mb-4 text-xs text-slate-400">
              {rules.videoOnly ? "TikTok seleccionado: solo 1 video." : `Hasta ${rules.maxImages} imágenes o 1 video`}
              {!rules.allowMix && !rules.videoOnly && " · sin mezclar fotos y videos"}
              {` · imágenes hasta ${MAX_IMAGE_MB} MB, video hasta ${MAX_VIDEO_MB} MB`}
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-black/20"}`}
            >
              <p className="text-sm text-slate-300">Arrastra tus archivos aquí</p>
              <p className="my-1 text-xs text-slate-500">o</p>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Elegir archivos</Button>
              <input ref={fileInputRef} type="file" accept={rules.videoOnly ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"} multiple className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {medias.length > 0 && (
              <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {medias.map((m, i) => (
                  <li key={m.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <div className="relative aspect-square">
                      {m.type === "video" ? (
                        <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.previewUrl} alt={`Archivo ${i + 1}`} className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">{i + 1}{m.type === "video" && " · video"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      <button type="button" onClick={() => moveMedia(i, -1)} disabled={i === 0} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30" aria-label="Mover a la izquierda">←</button>
                      <button type="button" onClick={() => removeMedia(m.id)} className="rounded-md px-2 py-1 text-xs text-red-300 hover:bg-red-500/15" aria-label={`Quitar archivo ${i + 1}`}>Quitar</button>
                      <button type="button" onClick={() => moveMedia(i, 1)} disabled={i === medias.length - 1} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30" aria-label="Mover a la derecha">→</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* 4. Personalizar por red */}
          {selected.length > 0 && (
            <Card className="p-5 sm:p-6">
              <SectionTitle step={4} title="Personalizar por red" optional />
              <p className="-mt-2 mb-4 text-xs text-slate-400">Opcional. Si dejas un campo vacío se usará el texto principal.</p>
              <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-black/20 p-1" role="tablist">
                {selected.map((n) => {
                  const over = textFor(n).length > NETWORKS[n].charLimit;
                  return (
                    <button key={n} type="button" role="tab" aria-selected={activeCustomTab === n} onClick={() => setActiveCustomTab(n)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeCustomTab === n ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                      <Image src={NETWORKS[n].icon} alt="" width={14} height={14} className="h-3.5 w-3.5" />
                      {NETWORKS[n].label}
                      {customTexts[n]?.trim() && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" title="Texto personalizado" />}
                      {over && <span className="h-1.5 w-1.5 rounded-full bg-red-400" title="Excede el límite" />}
                    </button>
                  );
                })}
              </div>
              {activeCustomTab && (
                <div role="tabpanel">
                  <div className="mb-1.5 flex justify-end">
                    <CharCounter count={textFor(activeCustomTab).length} limit={NETWORKS[activeCustomTab].charLimit} />
                  </div>
                  <textarea
                    value={customTexts[activeCustomTab] ?? ""}
                    onChange={(e) => setCustomTexts((p) => ({ ...p, [activeCustomTab]: e.target.value }))}
                    rows={4}
                    className={`${inputClass} resize-y`}
                    placeholder={body || `Texto específico para ${NETWORKS[activeCustomTab].label}`}
                    aria-label={`Texto para ${NETWORKS[activeCustomTab].label}`}
                  />
                  {customTexts[activeCustomTab]?.trim() && (
                    <button type="button" onClick={() => setCustomTexts((p) => ({ ...p, [activeCustomTab]: "" }))} className="mt-2 text-xs text-slate-400 hover:text-slate-200">Usar el texto principal</button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* 5. Cuándo */}
          <Card className="p-5 sm:p-6">
            <SectionTitle step={5} title="¿Cuándo?" />
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {([
                { v: "draft", t: "Guardar como borrador", d: "Revísala y publícala cuando quieras desde Publicaciones." },
                { v: "schedule", t: "Programar", d: "Se publicará automáticamente en la fecha elegida." },
              ] as const).map((o) => (
                <label key={o.v} className={`cursor-pointer rounded-xl border p-3.5 transition ${scheduleMode === o.v ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 hover:border-white/25"}`}>
                  <input type="radio" name="when" value={o.v} checked={scheduleMode === o.v} onChange={() => setScheduleMode(o.v)} className="sr-only" />
                  <span className="block text-sm font-semibold text-white">{o.t}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{o.d}</span>
                </label>
              ))}
            </div>
            {scheduleMode === "schedule" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Fecha" htmlFor="fecha">
                  <input id="fecha" type="date" value={fecha} min={new Date().toISOString().split("T")[0]} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Hora" htmlFor="hora">
                  <input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Zona horaria" htmlFor="zona">
                  <select id="zona" value={zona} onChange={(e) => setZona(e.target.value)} className={inputClass}>
                    {!TIMEZONES.some((t) => t.id === zona) && <option value={zona}>{zona} (tu zona)</option>}
                    {TIMEZONES.map((tz) => <option key={tz.id} value={tz.id}>{tz.label}</option>)}
                  </select>
                </Field>
                {scheduledDate && !Number.isNaN(scheduledDate.getTime()) && (
                  <p className="text-xs text-slate-400 sm:col-span-3">
                    En tu hora local: <span className="text-slate-200">{scheduledDate.toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short" })}</span>
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Columna lateral: vista previa + resumen */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Vista previa</h2>
              {selected.length > 1 && (
                <select value={previewNetwork ?? ""} onChange={(e) => setPreviewNetwork(e.target.value as NetworkKey)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs" aria-label="Red de la vista previa">
                  {selected.map((n) => <option key={n} value={n}>{NETWORKS[n].label}</option>)}
                </select>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <div className="flex items-center gap-2 p-3">
                {previewNetwork && <Image src={NETWORKS[previewNetwork].icon} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{previewNetwork ? connections[previewNetwork]?.username || "Tu cuenta" : "Tu cuenta"}</p>
                  <p className="text-[10px] text-slate-500">{previewNetwork ? NETWORKS[previewNetwork].label : ""}</p>
                </div>
              </div>
              {medias[0] && (
                <div className="relative aspect-square bg-black">
                  {medias[0].type === "video" ? (
                    <video src={medias[0].previewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={medias[0].previewUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  {medias.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">1/{medias.length}</span>}
                </div>
              )}
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-slate-300">
                {previewText || <span className="text-slate-600">Tu texto aparecerá aquí…</span>}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            {issues.length > 0 ? (
              <div className={submitted ? "" : "opacity-80"}>
                <h2 className="mb-2 text-sm font-semibold text-white">Antes de guardar</h2>
                <ul className="space-y-1.5">
                  {issues.map((i) => (
                    <li key={i} className={`flex gap-2 text-xs ${submitted ? "text-amber-200" : "text-slate-400"}`}>
                      <span aria-hidden="true">•</span>{i}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Alert tone="success">Todo listo para {scheduleMode === "schedule" ? "programar" : "guardar"}.</Alert>
            )}
            <Button type="submit" size="lg" className="mt-4 w-full" loading={submitting} disabled={submitted && issues.length > 0}>
              {submitting ? "Guardando..." : scheduleMode === "schedule" ? "Programar publicación" : "Guardar borrador"}
            </Button>
          </Card>
        </aside>
      </form>
    </div>
  );
}

function SectionTitle({ step, title, optional }: { step: number; title: string; optional?: boolean }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-white">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-200" aria-hidden="true">{step}</span>
      {title}
      {optional && <span className="text-xs font-normal text-slate-500">(opcional)</span>}
    </h2>
  );
}

function CharCounter({ count, limit, label }: { count: number; limit: number; label?: string }) {
  const over = count > limit;
  const near = !over && count > limit * 0.9;
  return (
    <span className={`font-mono text-xs ${over ? "font-semibold text-red-300" : near ? "text-amber-300" : "text-slate-500"}`} aria-live="polite">
      {count.toLocaleString("es-CL")} / {limit.toLocaleString("es-CL")}{label && ` · ${label}`}
    </span>
  );
}
