// Componentes de interfaz reutilizables. Mantienen consistencia visual
// (espaciado, foco visible, estados deshabilitados) en toda la app.

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { NETWORKS, isNetworkKey, statusMeta } from "@/lib/networks";
import { PASSWORD_RULES } from "@/lib/password";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Botones ---

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-950/40",
  secondary: "bg-white/10 text-slate-100 hover:bg-white/15 border border-white/10",
  ghost: "text-slate-300 hover:text-white hover:bg-white/5",
  danger: "bg-red-500/10 text-red-200 hover:bg-red-500/20 border border-red-500/30",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3 gap-2",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-xl font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    extra
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

// --- Feedback ---

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
      {icon && <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title?: string; children?: ReactNode }) {
  const tones = {
    info: "border-indigo-400/30 bg-indigo-500/10 text-indigo-100",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    error: "border-red-400/30 bg-red-500/10 text-red-100",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title && "mt-1", "opacity-90")}>{children}</div>}
    </div>
  );
}

// --- Layout ---

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20 backdrop-blur", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// --- Formularios ---

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition " +
  "focus:border-indigo-400/60 focus:bg-black/35 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400/60";

export function Field({ label, htmlFor, hint, error, children, aside }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-200">{label}</label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-300" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

// --- Badges ---

export function StatusBadge({ status }: { status?: string | null }) {
  const meta = statusMeta(status);
  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.className)}>{meta.label}</span>;
}

export function NetworkBadge({ network, withLabel = true }: { network: string; withLabel?: boolean }) {
  if (!isNetworkKey(network)) {
    return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">{network}</span>;
  }
  const meta = NETWORKS[network];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", meta.badge)} title={meta.label}>
      <Image src={meta.icon} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
      {withLabel && meta.label}
    </span>
  );
}

export function NetworkIcon({ network, size = 20 }: { network: string; size?: number }) {
  if (!isNetworkKey(network)) return null;
  const meta = NETWORKS[network];
  return <Image src={meta.icon} alt={meta.label} width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
}

// --- Contraseñas ---

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1 rounded-xl border border-white/5 bg-black/20 p-3 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className={cx("flex items-center gap-2 text-xs transition", ok ? "text-emerald-300" : "text-slate-400")}>
            <span aria-hidden="true" className={cx("flex h-4 w-4 items-center justify-center rounded-full border text-[10px]", ok ? "border-emerald-400 bg-emerald-500/20" : "border-slate-600")}>
              {ok ? "✓" : ""}
            </span>
            <span>{rule.label}<span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

// --- Paginación ---

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginación">
      <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>← Anterior</Button>
      <span className="text-sm text-slate-400">Página {page} de {totalPages}</span>
      <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Siguiente →</Button>
    </nav>
  );
}

// --- Avatar ---

export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ? `Avatar de ${name}` : "Avatar"} width={size} height={size} className="shrink-0 rounded-full border border-white/15 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-indigo-500/30 font-semibold text-indigo-100" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
