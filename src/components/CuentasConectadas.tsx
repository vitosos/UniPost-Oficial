"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { NETWORKS, type NetworkKey } from "@/lib/networks";
import { Avatar, Button, Card, Field, Spinner, inputClass } from "@/components/ui";

// Perfil normalizado para mostrar cualquier red con la misma tarjeta.
type NormalizedProfile = { avatar?: string | null; name?: string | null; handle?: string | null; stats: { label: string; value?: number | null }[] };
type CardState = { loading: boolean; linked: boolean; expired: boolean; username?: string; profile?: NormalizedProfile | null; profileLoading: boolean };

type Profile = Record<string, unknown> & { picture?: { data?: { url?: string } } };

type NetworkConfig = {
  key: NetworkKey;
  base: string; // prefijo de la API: /api/<base>/status, /profile, /unlink, /connect
  description: string;
  usernameField: string;
  normalize: (p: Profile) => NormalizedProfile;
};

const num = (v: unknown) => (typeof v === "number" ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

const CONFIGS: NetworkConfig[] = [
  {
    key: "INSTAGRAM", base: "instagram", usernameField: "username",
    description: "Requiere una cuenta Profesional (Business o Creator) vinculada a una Página de Facebook.",
    normalize: (p) => ({ avatar: str(p.profilePictureUrl), name: str(p.name) ?? str(p.username), handle: str(p.username), stats: [{ label: "Seguidores", value: num(p.followers) }, { label: "Posts", value: num(p.posts) ?? num(p.mediaCount) }] }),
  },
  {
    key: "FACEBOOK", base: "facebook", usernameField: "pageName",
    description: "Publica en una Página de Facebook que administres.",
    normalize: (p) => ({ avatar: p.picture?.data?.url ?? null, name: str(p.name), handle: null, stats: [{ label: "Seguidores", value: num(p.followers_count) }, { label: "Me gusta", value: num(p.fan_count) }] }),
  },
  {
    key: "TWITTER", base: "x_twitter", usernameField: "username",
    description: "Publica tweets con imágenes o video.",
    normalize: (p) => ({ avatar: str(p.avatar), name: str(p.name), handle: str(p.username), stats: [{ label: "Seguidores", value: num(p.followers) }, { label: "Tweets", value: num(p.tweets) }] }),
  },
  {
    key: "BLUESKY", base: "bsky", usernameField: "nombreUsuario",
    description: "Se conecta con una App Password (no tu contraseña normal).",
    normalize: (p) => ({ avatar: str(p.avatar), name: str(p.displayName), handle: str(p.handle), stats: [{ label: "Seguidores", value: num(p.followers) }, { label: "Posts", value: num(p.posts) }] }),
  },
  {
    key: "TIKTOK", base: "tiktok", usernameField: "username",
    description: "Publica videos. En modo sandbox solo se publican como privados.",
    normalize: (p) => ({ avatar: str(p.avatar_url), name: str(p.display_name), handle: str(p.username), stats: [{ label: "Seguidores", value: num(p.follower_count) }, { label: "Me gusta", value: num(p.likes_count) }] }),
  },
];

// Mensajes para los parámetros con que vuelven los flujos OAuth a /perfil.
const OAUTH_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  "instagram=linked": { ok: true, text: "Instagram conectado correctamente" },
  "facebook=linked": { ok: true, text: "Página de Facebook conectada correctamente" },
  "tiktok=linked": { ok: true, text: "TikTok conectado correctamente" },
  "twitter=linked": { ok: true, text: "X conectado correctamente" },
};

function oauthMessageFromUrl(): { ok: boolean; text: string } | null {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of params) {
    const known = OAUTH_MESSAGES[`${k}=${v}`];
    if (known) return known;
    if (k === "instagram_error") return { ok: false, text: "No se pudo conectar Instagram. Verifica que tu cuenta sea Profesional y esté vinculada a una Página." };
    if (k === "fb_error") return { ok: false, text: "No se pudo conectar Facebook. Asegúrate de administrar al menos una Página." };
    if (k === "error") return { ok: false, text: v.includes("denied") ? "Cancelaste la conexión." : "No se pudo completar la conexión. Inténtalo de nuevo." };
  }
  return null;
}

export default function CuentasConectadas() {
  const [states, setStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(CONFIGS.map((c) => [c.key, { loading: true, linked: false, expired: false, profileLoading: false }]))
  );

  const patch = useCallback((key: NetworkKey, p: Partial<CardState>) => setStates((s) => ({ ...s, [key]: { ...s[key], ...p } })), []);

  const loadProfile = useCallback(async (cfg: NetworkConfig) => {
    patch(cfg.key, { profileLoading: true });
    try {
      const data = await fetch(`/api/${cfg.base}/profile`).then((r) => r.json());
      patch(cfg.key, { profile: data.ok && data.profile ? cfg.normalize(data.profile) : null });
    } catch {
      patch(cfg.key, { profile: null });
    } finally {
      patch(cfg.key, { profileLoading: false });
    }
  }, [patch]);

  const loadStatus = useCallback(async (cfg: NetworkConfig) => {
    try {
      const data = await fetch(`/api/${cfg.base}/status`).then((r) => r.json());
      const linked = Boolean(data.ok && data.linked);
      patch(cfg.key, { loading: false, linked, expired: Boolean(data.expired), username: data[cfg.usernameField] });
      if (linked && !data.expired) loadProfile(cfg);
    } catch {
      patch(cfg.key, { loading: false });
    }
  }, [patch, loadProfile]);

  useEffect(() => {
    CONFIGS.forEach(loadStatus);
    const msg = oauthMessageFromUrl();
    if (msg) {
      (msg.ok ? toast.success : toast.error)(msg.text, { duration: 6000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [loadStatus]);

  const connectedCount = Object.values(states).filter((s) => s.linked).length;

  return (
    <div>
      <p className="mb-5 text-sm text-slate-400">
        {connectedCount === 0 ? "Conecta tus redes para empezar a publicar." : `${connectedCount} de ${CONFIGS.length} redes conectadas.`}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CONFIGS.map((cfg) => (
          <NetworkCard key={cfg.key} cfg={cfg} state={states[cfg.key]} onChanged={() => loadStatus(cfg)} onRefresh={() => loadProfile(cfg)} onUnlinked={() => patch(cfg.key, { linked: false, expired: false, profile: null, username: undefined })} />
        ))}
      </div>
    </div>
  );
}

function NetworkCard({ cfg, state, onChanged, onRefresh, onUnlinked }: { cfg: NetworkConfig; state: CardState; onChanged: () => void; onRefresh: () => void; onUnlinked: () => void }) {
  const meta = NETWORKS[cfg.key];
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(false);

  // Bluesky (App Password)
  const [identifier, setIdentifier] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [bskyError, setBskyError] = useState<string | null>(null);

  function connect() {
    setBusy(true);
    window.location.href = `/api/${cfg.base}/connect`;
  }

  async function connectBluesky(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBskyError(null);
    try {
      const data = await fetch("/api/bsky/check-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password: appPassword }),
      }).then((r) => r.json());
      if (!data.ok) throw new Error(data.error);
      toast.success("Bluesky conectado correctamente");
      setAppPassword("");
      onChanged();
    } catch {
      setBskyError("No pudimos conectar. Revisa tu usuario y que uses una App Password válida.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      const data = await fetch(`/api/${cfg.base}/unlink`, { method: "DELETE" }).then((r) => r.json());
      if (!data.ok) throw new Error();
      toast.success(`${meta.label} desconectado`);
      onUnlinked();
    } catch {
      toast.error(`No se pudo desconectar ${meta.label}`);
    } finally {
      setBusy(false);
      setConfirmUnlink(false);
    }
  }

  function refresh() {
    onRefresh();
    setRefreshCooldown(true);
    setTimeout(() => setRefreshCooldown(false), 60_000);
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-center gap-3">
        <Image src={meta.icon} alt="" width={32} height={32} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{meta.label}</h3>
          {!state.loading && (
            <p className={`text-xs ${state.expired ? "text-amber-300" : state.linked ? "text-emerald-300" : "text-slate-500"}`}>
              {state.expired ? "Sesión caducada" : state.linked ? "Conectada" : "No conectada"}
            </p>
          )}
        </div>
        {state.loading && <Spinner className="h-4 w-4 text-slate-500" />}
      </div>

      <div className="flex-1">
        {state.loading ? null : state.linked && state.expired ? (
          <p className="text-sm text-slate-400">Por seguridad debes volver a autorizar {meta.label} para seguir publicando.</p>
        ) : state.linked ? (
          state.profileLoading && !state.profile ? (
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <div className="rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="flex items-center gap-3">
                <Avatar src={state.profile?.avatar} name={state.profile?.name || state.username} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{state.profile?.name || state.username}</p>
                  {state.profile?.handle && <p className="truncate text-xs text-slate-400">@{state.profile.handle.replace(/^@/, "")}</p>}
                </div>
              </div>
              {state.profile && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                  {state.profile.stats.map((s) => (
                    <div key={s.label} className="rounded-lg bg-white/[0.03] py-1.5">
                      <dd className="text-sm font-semibold text-white">{s.value != null ? s.value.toLocaleString("es-CL") : "—"}</dd>
                      <dt className="text-[11px] text-slate-500">{s.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        ) : cfg.key === "BLUESKY" ? (
          <form onSubmit={connectBluesky} className="space-y-3">
            <Field label="Usuario" htmlFor="bsky-id">
              <input id="bsky-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputClass} placeholder="tu-usuario.bsky.social" autoComplete="username" />
            </Field>
            <Field label="App Password" htmlFor="bsky-pass" hint={<>Créala en Bluesky → Configuración → <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">App Passwords</a>.</>} error={bskyError}>
              <input id="bsky-pass" type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} className={inputClass} placeholder="xxxx-xxxx-xxxx-xxxx" autoComplete="off" />
            </Field>
            <Button type="submit" className="w-full" loading={busy} disabled={!identifier || !appPassword}>Conectar Bluesky</Button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">{cfg.description}</p>
        )}
      </div>

      {!state.loading && (
        <div className="mt-4 flex gap-2">
          {state.linked && state.expired && <Button className="flex-1" onClick={connect} loading={busy}>Reconectar</Button>}
          {!state.linked && cfg.key !== "BLUESKY" && <Button className="flex-1" onClick={connect} loading={busy}>Conectar {meta.label}</Button>}
          {state.linked && !state.expired && (
            <Button variant="secondary" size="sm" className="flex-1" onClick={refresh} disabled={refreshCooldown || state.profileLoading}>
              {refreshCooldown ? "Actualizado" : "Actualizar datos"}
            </Button>
          )}
          {state.linked &&
            (confirmUnlink ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setConfirmUnlink(false)}>Cancelar</Button>
                <Button variant="danger" size="sm" onClick={unlink} loading={busy}>Confirmar</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmUnlink(true)}>Desconectar</Button>
            ))}
        </div>
      )}
    </Card>
  );
}
