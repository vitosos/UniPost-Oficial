"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { PublicFeed } from "@/components/PublicFeed";
import { Button, ButtonLink } from "@/components/ui";
import { NETWORKS, NETWORK_KEYS } from "@/lib/networks";
import UniPostLogo from "./assets/UniPost.png";

const NAV = [
  { href: "#feed", label: "Comunidad" },
  { href: "#features", label: "Características" },
  { href: "#about", label: "Sobre nosotros" },
];

const FEATURES = [
  { icon: "🌐", title: "Cinco redes, un formulario", text: "Instagram, Facebook, X, Bluesky y TikTok desde el mismo lugar, con textos personalizados por red." },
  { icon: "📅", title: "Programa con anticipación", text: "Agenda tus publicaciones en tu zona horaria y UniPost las publica por ti." },
  { icon: "📊", title: "Métricas claras", text: "Me gusta, comentarios y hashtags que mejor funcionan, en un solo panel." },
  { icon: "👥", title: "Pensado para equipos", text: "Organizaciones con roles para que managers sigan el rendimiento de cada miembro." },
];

const STEPS = [
  { n: 1, title: "Conecta tus redes", text: "Vincula tus cuentas de forma segura en un par de clics." },
  { n: 2, title: "Escribe una vez", text: "Redacta, sube tus imágenes o video y ajusta el texto para cada red." },
  { n: 3, title: "Publica o programa", text: "Publica al instante o deja que UniPost lo haga a la hora indicada." },
];

const networkNames = NETWORK_KEYS.map((k) => NETWORKS[k].label);
const networkList = `${networkNames.slice(0, -1).join(", ")} y ${networkNames[networkNames.length - 1]}`;

export default function HomePage() {
  const { status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: "/" });
  }

  const AuthButtons = ({ mobile = false }: { mobile?: boolean }) => {
    const w = mobile ? "w-full" : "";
    if (status === "loading") return <div className={`h-10 animate-pulse rounded-xl bg-white/10 ${mobile ? "w-full" : "w-48"}`} />;
    if (status === "unauthenticated") {
      return (
        <>
          <ButtonLink href="/login" variant="ghost" className={w}>Iniciar sesión</ButtonLink>
          <ButtonLink href="/register" className={w}>Crear cuenta</ButtonLink>
        </>
      );
    }
    return (
      <>
        <Button variant="ghost" onClick={handleLogout} loading={loggingOut} className={w}>Cerrar sesión</Button>
        <ButtonLink href="/composer" className={w}>Ir a mi panel</ButtonLink>
      </>
    );
  };

  return (
    <main className="min-h-screen w-full text-slate-200">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={UniPostLogo} alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight text-white">UniPost</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Principal">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-slate-400 transition hover:text-white">{n.label}</a>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <AuthButtons />
            </div>
          </nav>

          <button
            className="rounded-lg p-2 text-slate-200 transition hover:bg-white/10 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"} />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="border-t border-white/10 px-4 pb-5 md:hidden">
            <nav className="flex flex-col py-2" aria-label="Principal">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="border-b border-white/5 py-3 text-slate-300 hover:text-white">{n.label}</a>
              ))}
              <Link href="/term_cond" className="py-3 text-slate-300 hover:text-white">Términos y condiciones</Link>
            </nav>
            <div className="flex flex-col gap-2">
              <AuthButtons mobile />
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 md:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              Publica en {NETWORK_KEYS.length} redes desde un solo lugar
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Un solo panel para <span className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">todas tus redes</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Escribe una vez, adapta el texto para cada red y publica o programa en segundos. UniPost es tu copiloto de Community Management.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {status === "authenticated" ? (
                <ButtonLink href="/composer" size="lg">Crear una publicación</ButtonLink>
              ) : (
                <ButtonLink href="/register" size="lg">Comenzar gratis</ButtonLink>
              )}
              <ButtonLink href="#features" size="lg" variant="secondary">Ver características</ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-500">Compatible con {networkList}.</p>
          </div>

          <div className="relative hidden items-center justify-center md:flex" aria-hidden="true">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/25 to-fuchsia-500/25 blur-[70px]" />
            <div className="relative grid grid-cols-3 gap-5">
              {NETWORK_KEYS.map((k, i) => (
                <div
                  key={k}
                  className={`rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl transition duration-300 hover:rotate-0 hover:scale-105 ${["-rotate-6", "rotate-6 translate-y-6", "-rotate-3", "rotate-3 -translate-y-4", "-rotate-6 translate-y-4"][i]} ${i === 3 ? "col-start-1" : ""}`}
                >
                  <Image src={NETWORKS[k].icon} alt="" width={80} height={80} className="h-16 w-16 lg:h-20 lg:w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{s.n}</span>
              <div>
                <h3 className="font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div id="feed" className="scroll-mt-20 pt-12">
        <PublicFeed />
      </div>

      {/* Características */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="mb-3 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">¿Por qué UniPost?</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">Herramientas para potenciar tu presencia digital sin complicarte la vida.</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/20 hover:bg-white/[0.06]">
              <div className="mb-4 inline-flex rounded-xl bg-white/10 p-3 text-2xl" aria-hidden="true">{f.icon}</div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sobre nosotros */}
      <section id="about" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-24 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12">
          <div className="mb-8 flex items-center gap-4">
            <div className="rounded-2xl bg-white/90 p-2.5">
              <Image src={UniPostLogo} alt="" width={48} height={48} className="h-12 w-12" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Sobre UniPost</h2>
          </div>
          <div className="space-y-5 leading-relaxed text-slate-300">
            <p>
              UniPost nació como proyecto de título de Ingeniería en Informática en DuocUC, Chile. La idea surgió de la necesidad de uno de nuestros
              diseñadores, ilustrador independiente: <strong className="text-white">lograr alcance y exposición en redes sociales</strong> sin que eso consuma todo su tiempo.
            </p>
            <p>
              Muchos rubros trabajan codo a codo con redes sociales, y el tiempo que eso exige es la razón por la que existen los Community Managers.
              UniPost busca ser una herramienta para todos: emprendedores, independientes, empresas y equipos de comunicación.
            </p>
            <p className="border-t border-white/10 pt-5 font-medium text-white">Esperamos que esta herramienta cumpla con tus necesidades y aliviane tu carga.</p>
          </div>
          <p className="mt-8 text-sm uppercase tracking-widest text-slate-500">— Equipo UniPost</p>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/30 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Image src={UniPostLogo} alt="" width={24} height={24} className="h-6 w-6 opacity-70" />
            © {new Date().getFullYear()} UniPost · Desarrollado en Chile
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400" aria-label="Pie de página">
            {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-white">{n.label}</a>)}
            <Link href="/term_cond" className="hover:text-white">Términos y condiciones</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
