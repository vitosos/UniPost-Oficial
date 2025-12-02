"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { PublicFeed } from "@/components/PublicFeed";
import Image from "next/image";
import toast from "react-hot-toast";
import UniPostLogo from "./assets/UniPost.png";

// --- IMPORTACIÓN DE ÍCONOS DE REDES ---
import BskyIcon from "./assets/bsky.png";
import IgIcon from "./assets/ig.png";
import TtIcon from "./assets/tt.png";
import FbIcon from "./assets/fb.png";
import XIcon from "./assets/x.png";

export default function HomePage() {
  // 1. Desestructuramos 'status' para controlar la carga inicial
  const { data: session, status } = useSession();
  
  // 2. Estados para UI
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 3. Función Logout con Feedback
  const handleLogout = async () => {
    setIsLoggingOut(true);
    toast.loading("Cerrando sesión...", { duration: 2000 });
    await signOut({ callbackUrl: "/" });
  };

  // 4. Componente auxiliar para los Botones de Auth (DRY)
  const AuthButtons = ({ mobile = false }) => {
    // A) MIENTRAS CARGA: Mostramos un placeholder (esqueleto) para evitar parpadeo
    if (status === "loading") {
      return (
        <div className={`flex gap-3 ${mobile ? "flex-col w-full" : "items-center"}`}>
          <div className="h-10 w-24 bg-white/10 animate-pulse rounded-xl"></div>
          <div className="h-10 w-24 bg-white/10 animate-pulse rounded-xl"></div>
        </div>
      );
    }

    // B) SI NO HAY SESIÓN: Mostrar Login / Register
    if (status === "unauthenticated") {
      return (
        <>
          <a href="/login" className={`rounded-xl border border-white/30 px-4 py-2 font-semibold text-slate-200 backdrop-blur-sm hover:bg-white/10 transition text-center ${mobile ? "w-full" : ""}`}>
            Iniciar sesión
          </a>
          <a href="/register" className={`rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 shadow hover:shadow-lg transition text-center ${mobile ? "w-full" : ""}`}>
            Registrarse
          </a>
        </>
      );
    }

    // C) SI HAY SESIÓN: Mostrar Ir a App / Cerrar Sesión
    return (
      <>
        <a href="/composer" className={`rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 shadow hover:shadow-lg transition text-center ${mobile ? "w-full" : ""}`}>
          Ir a la App
        </a>
        <button 
          onClick={handleLogout} 
          disabled={isLoggingOut}
          className={`rounded-xl border border-white/30 px-4 py-2 font-semibold text-slate-200 backdrop-blur-sm hover:bg-white/10 transition text-center ${mobile ? "w-full" : ""} ${isLoggingOut ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isLoggingOut ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </>
    );
  };

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-purple-950 to-slate-900 text-slate-200">

      {/* Top Nav */}
      <header className="sticky top-0 z-50 mx-auto flex max-w-7xl items-center justify-between px-6 py-4 backdrop-blur-md bg-black/10 rounded-b-2xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image
            src={UniPostLogo}
            alt="UniPost Logo"
            width={48}
            height={48}
            className="h-8 w-8"
          />
          <span className="text-lg font-semibold tracking-wide">UniPost</span>
        </div>

        {/* --- DESKTOP NAV --- */}
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <a href="#feed" className="opacity-90 transition hover:opacity-100 hover:text-slate-200">Feed</a>
          <a href="#features" className="opacity-90 transition hover:opacity-100 hover:text-slate-200">Características</a>
          <a href="#about" className="opacity-90 transition hover:opacity-100 hover:text-slate-200">Sobre Nosotros</a>
          <a href="/term_cond" className="opacity-90 transition hover:opacity-100 hover:text-slate-200">Términos y Condiciones</a>

          <div className="flex items-center gap-3 ml-4">
            <AuthButtons />
          </div>
        </nav>

        {/* --- MOBILE HAMBURGER BUTTON --- */}
        <button 
          className="md:hidden p-2 text-slate-200 hover:bg-white/10 rounded-lg transition"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </header>

      {/* --- MOBILE MENU OVERLAY --- */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[80px] z-40 bg-slate-950/95 backdrop-blur-xl p-6 flex flex-col gap-6 animate-in slide-in-from-top-5">
          <nav className="flex flex-col gap-4 text-lg font-medium text-center">
            <a href="#feed" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-white/10 hover:text-white">Feed</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-white/10 hover:text-white">Características</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-white/10 hover:text-white">Sobre Nosotros</a>
          </nav>
          
          <div className="flex flex-col gap-3 mt-4">
            <AuthButtons mobile={true} />
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-6 pb-10 pt-10 md:pt-24 lg:pb-24">
        {/* Fondos borrosos */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
        </div>

        <div className="grid items-center gap-12 md:grid-cols-2">

          {/* Texto Hero */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <span>⚡️ Nuevo</span>
              <span className="opacity-90">Publica en 4 redes con 1 click</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight drop-shadow sm:text-6xl lg:text-7xl">
              Cuida tus tiempos. <span className="inline-block bg-white/90 px-3 text-slate-900 rounded-lg">Un solo panel</span>,
              todas tus redes.
            </h1>
            <p className="mt-6 max-w-xl text-lg opacity-95 leading-relaxed">
              Ahorra horas cada semana con programación inteligente, publicaciones simultáneas y un flujo simple para equipos. UniPost es tu copiloto de Community Management.
            </p>

            <p className="mt-5 max-w-xl text-base/7 opacity-95 sm:text-lg/8">
              Actualmente con soporte completo para: <span className="inline-block bg-white/90 px-2 text-slate-900">Instagram Business, Facebook, Bluesky y X (Twitter)</span> disponible
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#features" className="rounded-2xl bg-white px-8 py-4 text-lg font-bold text-slate-900 shadow-xl transition hover:scale-105 hover:shadow-2xl">Ver características</a>
            </div>
          </div>

          {/* Collage de Redes Sociales */}
          <div className="relative hidden md:flex items-center justify-center lg:ml-10">
            {/* Brillo de fondo */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 to-fuchsia-500/30 blur-[60px] rounded-full"></div>

            {/* Contenedor del grid del collage */}
            <div className="relative z-10 grid grid-cols-3 grid-rows-3 gap-4 p-4 transform scale-110 lg:scale-125">

              {/* Instagram - Arriba Izquierda */}
              <div className="col-start-1 row-start-1 p-3 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 -rotate-[8deg] hover:rotate-0 transition-all duration-300 hover:scale-110 hover:z-20">
                <Image src={IgIcon} alt="Instagram" width={80} height={80} className="w-20 h-20 lg:w-24 lg:h-24 drop-shadow-lg" />
              </div>

              {/* 🆕 X (Twitter) - Arriba Centro */}
              <div className="col-start-2 row-start-1 flex justify-center items-end z-20 translate-y-4">
                <div className="p-3 bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 rotate-[12deg] hover:rotate-0 transition-all duration-300 hover:scale-110">
                  <Image src={XIcon} alt="X" width={80} height={80} className="w-16 h-16 lg:w-20 lg:h-20 drop-shadow-lg" />
                </div>
              </div>

              {/* Facebook - Arriba Derecha */}
              <div className="col-start-3 row-start-1 p-3 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 rotate-[6deg] translate-y-6 hover:rotate-0 transition-all duration-300 hover:scale-110 hover:z-20">
                <Image src={FbIcon} alt="Facebook" width={80} height={80} className="w-20 h-20 lg:w-24 lg:h-24 drop-shadow-lg" />
              </div>

              {/* Centro - Ícono "+" */}
              <div className="col-start-2 row-start-2 flex items-center justify-center z-30">
                <div className="bg-white/20 p-6 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.3)] border-2 border-white/40 animate-pulse hover:animate-none transition hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={5} stroke="currentColor" className="w-12 h-12 lg:w-16 lg:h-16 text-slate-200 drop-shadow-xl">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
              </div>

              {/* Bluesky - Abajo Izquierda */}
              <div className="col-start-1 row-start-3 p-3 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 rotate-[4deg] -translate-y-6 hover:rotate-0 transition-all duration-300 hover:scale-110 hover:z-20">
                <Image src={BskyIcon} alt="Bluesky" width={80} height={80} className="w-20 h-20 lg:w-24 lg:h-24 drop-shadow-lg scale-95" />
              </div>

              {/* TikTok - Abajo Derecha */}
              <div className="col-start-3 row-start-3 p-3 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 -rotate-[6deg] hover:rotate-0 transition-all duration-300 hover:scale-110 hover:z-20">
                <Image src={TtIcon} alt="TikTok" width={80} height={80} className="w-20 h-20 lg:w-24 lg:h-24 drop-shadow-lg" />
              </div>
            </div>
          </div>
          {/* --- Fin del Collage --- */}

        </div>
      </section>

      {/* FEED SECTION */}
      <div id="feed" className="scroll-mt-24">
        <PublicFeed />
      </div>

      {/* Características */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 scroll-mt-24">
        <h2 className="text-center text-4xl font-extrabold mb-4">¿Por qué UniPost?</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg opacity-90">Herramientas diseñadas para potenciar tu presencia digital sin complicarte la vida.</p>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "🌍", text: "¡Soporte para 3 redes sociales y creciendo!" },
            { icon: "📅", text: "Agenda tus publicaciones para el momento perfecto." },
            { icon: "📊", text: "Obtén métricas y comprende tus plataformas." },
            { icon: "⚡", text: "Optimiza tus tiempos, todas tus redes en un solo lugar." },
          ].map((f, i) => (
            <div key={i} className="group flex flex-col items-center text-center rounded-3xl border border-white/20 bg-white/5 p-8 shadow-xl backdrop-blur transition-all duration-300 hover:bg-white/10 hover:-translate-y-2 hover:shadow-2xl hover:border-white/30">
              <div className="mb-6 text-5xl bg-white/10 p-4 rounded-2xl shadow-inner group-hover:scale-110 transition">{f.icon}</div>
              <h3 className="text-xl font-bold leading-snug">{f.text}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Sobre Nosotros */}
      <section id="about" className="mx-auto max-w-5xl px-6 pb-24 pt-10 scroll-mt-24">
        <div className="relative rounded-[3rem] bg-gradient-to-br from-black/30 to-black/10 border border-white/10 p-8 md:p-16 backdrop-blur-2xl shadow-3xl overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="flex items-center gap-5 mb-10">
              <div className="bg-white/90 p-3 rounded-2xl shadow-xl shadow-white/20">
                <Image src={UniPostLogo} alt="UniPost Logo" width={80} height={80} className="h-16 w-16" />
              </div>
              <h2 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">UniPost</h2>
            </div>

            <div className="space-y-8 text-lg/8 leading-relaxed opacity-90 max-w-3xl font-medium">
              <p>
                UniPost nació de un proyecto de título para la carrera de Ingeniería Informática en DuocUC, Chile.
                El concepto nació de la necesidad percibida por uno de los diseñadores que ejerce como ilustrador independiente,
                <span className="block mt-2 text-2xl font-extrabold text-slate-200/100 bg-white/10 px-4 py-2 rounded-xl -rotate-1"> ¿La necesidad? Alcance y exposición en redes sociales.</span>
              </p>
              <p>
                Muchos rubros de la actualidad trabajan codo a codo con redes sociales, pero el consumo de tiempo que conlleva
                es la razón por la que los Community Managers existen. Esta plataforma busca ser una herramienta para todos,
                tanto emprendedores e independientes como empresas y Community Managers de compañías más grandes.
              </p>
              <p className="text-xl font-bold text-slate-200 pt-6 border-t-2 border-white/10">
                Esperamos que esta herramienta cumpla con tus necesidades y a su vez, aliviane tu carga.
              </p>
            </div>

            <div className="mt-12 text-base font-bold tracking-[0.2em] uppercase text-slate-200/60 bg-white/5 px-6 py-3 rounded-full border border-white/10">
              - Equipo UniPost, 2025
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
          <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition">
            <Image src={UniPostLogo} alt="Logo" width={32} height={32} className="h-6 w-6 grayscale hover:grayscale-0 transition" />
            <p className="text-sm">© 2025 UniPost. Desarrollado en Chile.</p>
          </div>
          <nav className="flex items-center gap-8 text-sm font-bold tracking-wide opacity-80">
            <a href="#feed" className="hover:text-slate-200 hover:underline transition underline-offset-4">Feed</a>
            <a href="#features" className="hover:text-slate-200 hover:underline transition underline-offset-4">Características</a>
            <a href="#about" className="hover:text-slate-200 hover:underline transition underline-offset-4">Sobre Nosotros</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}