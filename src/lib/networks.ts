// Metadatos centralizados de cada red social soportada.
// Úsalo en lugar de repetir if/else por red en cada componente.

import type { StaticImageData } from "next/image";
import BskyIcon from "@/app/assets/bsky.png";
import IgIcon from "@/app/assets/ig.png";
import FbIcon from "@/app/assets/fb.png";
import TtIcon from "@/app/assets/tt.png";
import XIcon from "@/app/assets/x.png";

export const NETWORK_KEYS = ["INSTAGRAM", "FACEBOOK", "TWITTER", "BLUESKY", "TIKTOK"] as const;
export type NetworkKey = (typeof NETWORK_KEYS)[number];

export type NetworkMeta = {
  key: NetworkKey;
  label: string;
  icon: StaticImageData;
  /** Límite de caracteres del texto de la publicación. */
  charLimit: number;
  /** Endpoint que publica una variante de esta red. */
  publishEndpoint: string;
  /** Clases para chips/badges (fondo + texto + borde). */
  badge: string;
  /** Color sólido (gráficos). */
  color: string;
};

export const NETWORKS: Record<NetworkKey, NetworkMeta> = {
  INSTAGRAM: {
    key: "INSTAGRAM",
    label: "Instagram",
    icon: IgIcon,
    charLimit: 2200,
    publishEndpoint: "/api/publish/instagram",
    badge: "bg-pink-500/15 text-pink-200 border-pink-500/30",
    color: "#ec4899",
  },
  FACEBOOK: {
    key: "FACEBOOK",
    label: "Facebook",
    icon: FbIcon,
    charLimit: 63206,
    publishEndpoint: "/api/publish/facebook",
    badge: "bg-blue-500/15 text-blue-200 border-blue-500/30",
    color: "#3b82f6",
  },
  TWITTER: {
    key: "TWITTER",
    label: "X (Twitter)",
    icon: XIcon,
    charLimit: 280,
    publishEndpoint: "/api/publish/x_twitter",
    badge: "bg-zinc-500/15 text-zinc-100 border-zinc-400/30",
    color: "#a1a1aa",
  },
  BLUESKY: {
    key: "BLUESKY",
    label: "Bluesky",
    icon: BskyIcon,
    charLimit: 300,
    publishEndpoint: "/api/publish/bluesky",
    badge: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    color: "#0ea5e9",
  },
  TIKTOK: {
    key: "TIKTOK",
    label: "TikTok",
    icon: TtIcon,
    charLimit: 2200,
    publishEndpoint: "/api/publish/tiktok",
    badge: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    color: "#22d3ee",
  },
};

export function isNetworkKey(value: string): value is NetworkKey {
  return (NETWORK_KEYS as readonly string[]).includes(value);
}

export function networkLabel(value: string): string {
  return isNetworkKey(value) ? NETWORKS[value].label : value;
}

/** Estados de publicación en lenguaje amigable. */
export const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-500/15 text-slate-200 border-slate-400/30" },
  SCHEDULED: { label: "Programado", className: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  PUBLISHING: { label: "Publicando…", className: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30" },
  PUBLISHED: { label: "Publicado", className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  FAILED: { label: "Con error", className: "bg-red-500/15 text-red-200 border-red-500/30" },
};

export function statusMeta(status?: string | null) {
  return STATUS_META[status ?? "DRAFT"] ?? STATUS_META.DRAFT;
}
