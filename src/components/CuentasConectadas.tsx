"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Importación de Logos para el fondo
import BskyIcon from "@/app/assets/bsky.png";
import IgIcon from "@/app/assets/ig.png";
import FbIcon from "@/app/assets/fb.png";
import TtIcon from "@/app/assets/tt.png";

interface Props {
  userEmail?: string | null;
}

export default function CuentasConectadas({ userEmail }: Props) {
  // --- BLUESKY state ---
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [linked, setLinked] = useState(false);
  const [linkedUser, setLinkedUser] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [checkingLinkStatus, setCheckingLinkStatus] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // --- INSTAGRAM state ---
  const [igLinked, setIgLinked] = useState(false);
  const [igUsername, setIgUsername] = useState("");
  const [igCheckingStatus, setIgCheckingStatus] = useState(true);
  const [igStatus, setIgStatus] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [igProfile, setIgProfile] = useState<any>(null);
  const [igCheckingProfile, setIgCheckingProfile] = useState(false);
  const [igRefreshDisabled, setIgRefreshDisabled] = useState(false);

  // --- FACEBOOK state ---
  const [fbLinked, setFbLinked] = useState(false);
  const [fbPageName, setFbPageName] = useState("");
  const [fbCheckingStatus, setFbCheckingStatus] = useState(true);
  const [fbStatus, setFbStatus] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [fbProfile, setFbProfile] = useState<any>(null);
  const [fbCheckingProfile, setFbCheckingProfile] = useState(false);
  const [fbRefreshDisabled, setFbRefreshDisabled] = useState(false);

  // --- TIKTOK state ---
  const [ttLinked, setTtLinked] = useState(false);
  const [ttUsername, setTtUsername] = useState("");
  const [ttCheckingStatus, setTtCheckingStatus] = useState(true);
  const [ttStatus, setTtStatus] = useState("");
  const [ttLoading, setTtLoading] = useState(false);
  const [ttProfile, setTtProfile] = useState<any>(null);
  const [ttCheckingProfile, setTtCheckingProfile] = useState(false);
  const [ttRefreshDisabled, setTtRefreshDisabled] = useState(false);
  const [ttExpired, setTtExpired] = useState(false);


  // --- EFECTOS ---
  useEffect(() => {
    if (!userEmail) return;
    
    // 1. Bluesky check
    (async () => {
      try {
        const res = await fetch("/api/bsky/status");
        const data = await res.json();
        if (data.ok && data.linked) {
          setLinked(true);
          setLinkedUser(data.handle);
          loadProfile().finally(() => setCheckingProfile(false));
        }
      } catch (e) { console.error(e); } 
      finally { setCheckingLinkStatus(false); }
    })();

    // 2. Instagram check
    (async () => {
      try {
        const res = await fetch("/api/instagram/status");
        const data = await res.json();
        if (data.ok && data.linked) {
          setIgLinked(true);
          setIgUsername(data.username);
          loadInstagramProfile();
        }
      } catch (err) { console.error(err); } 
      finally { setIgCheckingStatus(false); }
    })();

    // 3. Facebook check
    (async () => {
      try {
        const res = await fetch("/api/facebook/status");
        const data = await res.json();
        if (data.ok && data.linked) {
          setFbLinked(true);
          setFbPageName(data.pageName || "Página de Facebook");
          loadFacebookProfile();
        }
      } catch (err) { console.error(err); } 
      finally { setFbCheckingStatus(false); }
    })();

    // 4. TikTok check
    (async () => {
      try {
        const res = await fetch("/api/tiktok/status");
        const data = await res.json();
        if (data.ok && data.linked) {
          setTtLinked(true);
          setTtUsername(data.username || "TikTok User");
          
          if (data.expired) {
            setTtExpired(true);
            setTtCheckingProfile(false);
          } else {
            setTtExpired(false);
            loadTikTokProfile();
          }
        }
      } catch (err) { console.error(err); } 
      finally { setTtCheckingStatus(false); }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // --- FUNCIONES BLUESKY ---
  async function handleCheckAndSave() {
    setLoading(true);
    setStatus("Verificando credenciales...");
    try {
      const res = await fetch("/api/bsky/check-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("✅ Cuenta Bluesky vinculada");
        setLinked(true);
        setLinkedUser(identifier);
        loadProfile();
      } else {
        setStatus("❌ Error: " + (data.error || "Credenciales inválidas"));
      }
    } catch { setStatus("⚠️ Error de conexión"); }
    setLoading(false);
  }

  async function handleUnlink() {
    if (!confirm("¿Seguro que quieres desvincular Bluesky?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bsky/unlink", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setLinked(false);
        setLinkedUser("");
        setProfile(null);
        setStatus("🔓 Bluesky desvinculado");
      } else { setStatus("❌ Error al desvincular"); }
    } finally { setLoading(false); }
  }

  async function loadProfile() {
    const res = await fetch("/api/bsky/profile");
    const data = await res.json();
    if (data.ok) setProfile(data.profile);
  }

  async function handleRefresh() {
    if (refreshDisabled) return;
    await loadProfile();
    setRefreshDisabled(true);
    setTimeout(() => setRefreshDisabled(false), 5 * 60 * 1000);
  }

  // --- FUNCIONES INSTAGRAM ---
  async function handleInstagramConnect() {
    setIgLoading(true);
    setIgStatus("Redirigiendo a Instagram...");
    window.location.href = "/api/instagram/connect";
  }

  async function handleInstagramUnlink() {
    if (!confirm("¿Seguro que quieres desvincular Instagram?")) return;
    setIgLoading(true);
    try {
      const res = await fetch("/api/instagram/unlink", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setIgLinked(false);
        setIgUsername("");
        setIgProfile(null);
        setIgStatus("🔓 Instagram desvinculado");
      } else { setIgStatus("❌ Error al desvincular"); }
    } catch { setIgStatus("⚠️ Error de conexión"); } 
    finally { setIgLoading(false); }
  }
  
  async function loadInstagramProfile() {
    setIgCheckingProfile(true);
    try {
      const res = await fetch("/api/instagram/profile");
      const data = await res.json();
      if (data.ok && data.profile) setIgProfile(data.profile);
    } catch (err) { console.error(err); } 
    finally { setIgCheckingProfile(false); }
  }

  async function handleInstagramRefresh() {
    if (igRefreshDisabled) return;
    await loadInstagramProfile();
    setIgRefreshDisabled(true);
    setTimeout(() => setIgRefreshDisabled(false), 5 * 60 * 1000);
  }

  // --- FUNCIONES FACEBOOK ---
  async function handleFacebookConnect() {
    setFbLoading(true);
    setFbStatus("Redirigiendo a Facebook...");
    window.location.href = "/api/facebook/connect";
  }

  async function handleFacebookUnlink() {
    if (!confirm("¿Seguro que quieres desvincular tu Página de Facebook?")) return;
    setFbLoading(true);
    try {
      const res = await fetch("/api/facebook/unlink", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setFbLinked(false);
        setFbPageName("");
        setFbProfile(null);
        setFbStatus("🔓 Facebook desvinculado");
      } else { setFbStatus("❌ Error al desvincular"); }
    } catch { setFbStatus("⚠️ Error de conexión"); } 
    finally { setFbLoading(false); }
  }

  async function loadFacebookProfile() {
    setFbCheckingProfile(true);
    try {
      const res = await fetch("/api/facebook/profile");
      const data = await res.json();
      if (data.ok && data.profile) setFbProfile(data.profile);
    } catch (err) { console.error(err); } 
    finally { setFbCheckingProfile(false); }
  }

  async function handleFacebookRefresh() {
    if (fbRefreshDisabled) return;
    await loadFacebookProfile();
    setFbRefreshDisabled(true);
    setTimeout(() => setFbRefreshDisabled(false), 5 * 60 * 1000);
  }

  // --- FUNCIONES TIKTOK ---
  async function handleTikTokConnect() {
    setTtLoading(true);
    setTtStatus("Redirigiendo a TikTok...");
    window.location.href = "/api/tiktok/connect";
  }

  async function handleTikTokUnlink() {
    if (!confirm("¿Seguro que quieres desvincular TikTok?")) return;
    setTtLoading(true);
    try {
      const res = await fetch("/api/tiktok/unlink", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setTtLinked(false);
        setTtUsername("");
        setTtProfile(null);
        setTtStatus("🔓 TikTok desvinculado");
        setTtExpired(false);
      } else { setTtStatus("❌ Error al desvincular"); }
    } catch { setTtStatus("⚠️ Error de conexión"); } 
    finally { setTtLoading(false); }
  }

  async function loadTikTokProfile() {
    setTtCheckingProfile(true);
    try {
      const res = await fetch("/api/tiktok/profile");
      const data = await res.json();
      if (data.ok && data.profile) setTtProfile(data.profile);
    } catch (err) { console.error(err); } 
    finally { setTtCheckingProfile(false); }
  }

  async function handleTikTokRefresh() {
    if (ttRefreshDisabled) return;
    await loadTikTokProfile();
    setTtRefreshDisabled(true);
    setTimeout(() => setTtRefreshDisabled(false), 5 * 60 * 1000);
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mx-auto animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1. BLUESKY */}
      <div className="relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl">
        {/* Fondo Logo */}
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none select-none">
            <Image src={BskyIcon} alt="Bluesky" width={120} height={120} />
        </div>
        
        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 relative z-10">
          Bluesky
        </h2>
        {checkingLinkStatus ? (
          <p className="text-slate-200/70 text-sm animate-pulse text-center relative z-10">🔄 Verificando...</p>
        ) : linked ? (
          <div className="relative z-10">
            <p className="text-green-400 font-semibold mb-4 text-sm truncate text-center">✅ {linkedUser}</p>
            {checkingProfile ? (
              <p className="text-slate-200/70 text-sm animate-pulse mb-4 text-center">⏳ Cargando perfil...</p>
            ) : profile && (
              <div className="bg-white/10 p-4 rounded-xl mb-4 text-left">
                <div className="flex items-center gap-3">
                  <img src={profile.avatar} className="w-12 h-12 rounded-full border border-white/20" alt="Avatar" />
                  <div className="overflow-hidden">
                    <p className="font-bold truncate">{profile.displayName}</p>
                    <p className="text-slate-200/70 text-xs truncate">@{profile.handle}</p>
                  </div>
                </div>
                <div className="flex justify-between mt-4 text-slate-200/90 text-center">
                  <div>
                    <p className="font-bold">{profile.followers}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Follows</p>
                  </div>
                  <div>
                    <p className="font-bold">{profile.posts}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Posts</p>
                  </div>
                </div>
                <button onClick={handleRefresh} disabled={refreshDisabled} className={`mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all ${refreshDisabled ? "bg-white/10 opacity-50" : "bg-green-500 hover:bg-green-600"}`}>{refreshDisabled ? "⏳ Espera..." : "🔄 Actualizar"}</button>
              </div>
            )}
            <button onClick={handleUnlink} disabled={loading} className="w-full bg-white/10 hover:bg-red-500/80 border border-white/20 py-2 rounded-lg text-sm transition">{loading ? "..." : "Desvincular"}</button>
          </div>
        ) : (
          <div className="relative z-10">
            <p className="text-sm text-slate-200/60 mb-4 text-center">Conecta mediante App Password.</p>
            <input type="text" placeholder="Usuario" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full p-2 mb-2 text-sm rounded bg-black/20 border border-white/10 text-white" />
            <input type="password" placeholder="App Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 mb-4 text-sm rounded bg-black/20 border border-white/10 text-white" />
            <button onClick={handleCheckAndSave} disabled={loading} className="w-full bg-gradient-to-r from-sky-500 to-blue-600 py-2 rounded-lg font-semibold hover:opacity-90 transition">{loading ? "Verificando..." : "Conectar"}</button>
          </div>
        )}
        {status && <p className="mt-4 text-xs text-slate-200/80 text-center relative z-10">{status}</p>}
      </div>

      {/* 2. FACEBOOK */}
      <div className="relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl">
        {/* Fondo Logo */}
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none select-none">
            <Image src={FbIcon} alt="Facebook" width={120} height={120} />
        </div>

        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 relative z-10">Facebook</h2>
        {fbCheckingStatus ? (
          <p className="text-slate-200/70 text-sm animate-pulse text-center relative z-10">🔄 Verificando...</p>
        ) : fbLinked ? (
          <div className="relative z-10">
            <p className="text-blue-300 font-semibold mb-4 text-sm truncate text-center">✅ {fbPageName}</p>
            {fbCheckingProfile ? (
              <p className="text-slate-200/70 text-sm animate-pulse mb-4 text-center">⏳ Cargando perfil...</p>
            ) : fbProfile && (
              <div className="bg-white/10 p-4 rounded-xl mb-4 text-left">
                <div className="flex items-center gap-3">
                  <img src={fbProfile.picture?.data?.url || "https://cdn-icons-png.flaticon.com/512/5968/5968764.png"} className="w-12 h-12 rounded-full border border-white/20" alt="FB" />
                  <div className="overflow-hidden">
                    <p className="font-bold truncate">{fbProfile.name}</p>
                    <p className="text-slate-200/70 text-xs truncate">Página</p>
                  </div>
                </div>
                <div className="flex justify-between mt-4 text-slate-200/90 text-center">
                  <div>
                    <p className="font-bold">{fbProfile.followers_count ?? 0}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Seguidores</p>
                  </div>
                  <div>
                    <p className="font-bold">{fbProfile.fan_count ?? 0}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Likes</p>
                  </div>
                </div>
                <button onClick={handleFacebookRefresh} disabled={fbRefreshDisabled} className={`mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all ${fbRefreshDisabled ? "bg-white/10 opacity-50" : "bg-blue-600 hover:bg-blue-700"}`}>{fbRefreshDisabled ? "⏳ Espera..." : "🔄 Actualizar"}</button>
              </div>
            )}
            <button onClick={handleFacebookUnlink} disabled={fbLoading} className="w-full bg-white/10 hover:bg-red-500/80 border border-white/20 py-2 rounded-lg text-sm transition">{fbLoading ? "..." : "Desvincular"}</button>
          </div>
        ) : (
          <div className="relative z-10">
            <p className="text-sm text-slate-200/60 mb-6 text-center">Vincula una Página de Facebook.</p>
            <button onClick={handleFacebookConnect} disabled={fbLoading} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 py-3 rounded-lg font-semibold hover:opacity-90 transition shadow-lg">{fbLoading ? "Redirigiendo..." : "🔗 Conectar Página"}</button>
          </div>
        )}
        {fbStatus && <p className="mt-4 text-xs text-slate-200/80 text-center relative z-10">{fbStatus}</p>}
      </div>

      {/* 3. INSTAGRAM */}
      <div className="relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl">
        {/* Fondo Logo */}
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none select-none">
            <Image src={IgIcon} alt="Instagram" width={120} height={120} />
        </div>

        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 relative z-10">Instagram</h2>
        {igCheckingStatus ? (
          <p className="text-slate-200/70 text-sm animate-pulse text-center relative z-10">🔄 Verificando...</p>
        ) : igLinked ? (
          <div className="relative z-10">
            <p className="text-pink-300 font-semibold mb-4 text-sm truncate text-center">✅ @{igUsername}</p>
            {igCheckingProfile ? (
              <p className="text-slate-200/70 text-sm animate-pulse mb-4 text-center">⏳ Cargando perfil...</p>
            ) : igProfile && (
              <div className="bg-white/10 p-4 rounded-xl mb-4 text-left">
                <div className="flex items-center gap-3">
                  <img src={igProfile.profilePictureUrl || "https://cdn-icons-png.flaticon.com/512/733/733558.png"} className="w-12 h-12 rounded-full border border-white/20" alt="IG" />
                  <div className="overflow-hidden">
                    <p className="font-bold truncate">@{igProfile.username}</p>
                    <p className="text-slate-200/70 text-xs truncate">Instagram Business</p>
                  </div>
                </div>
                <div className="flex justify-between mt-4 text-slate-200/90 text-center">
                  <div>
                    <p className="font-bold">{igProfile.followers?.toLocaleString()}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Seguidores</p>
                  </div>
                  <div>
                    <p className="font-bold">{igProfile.posts?.toLocaleString()}</p>
                    <p className="text-[10px] uppercase text-slate-200/60">Posts</p>
                  </div>
                </div>
                <button onClick={handleInstagramRefresh} disabled={igRefreshDisabled} className={`mt-4 w-full py-2 rounded-lg text-sm font-semibold transition-all ${igRefreshDisabled ? "bg-white/10 opacity-50" : "bg-pink-500 hover:bg-pink-600"}`}>{igRefreshDisabled ? "⏳ Espera..." : "🔄 Actualizar"}</button>
              </div>
            )}
            <button onClick={handleInstagramUnlink} disabled={igLoading} className="w-full bg-white/10 hover:bg-red-500/80 border border-white/20 py-2 rounded-lg text-sm transition">{igLoading ? "..." : "Desvincular"}</button>
          </div>
        ) : (
          <div className="relative z-10">
            <p className="text-sm text-slate-200/60 mb-6 text-center">Conecta cuenta Profesional.</p>
            <button onClick={handleInstagramConnect} disabled={igLoading} className="w-full bg-gradient-to-r from-pink-500 to-orange-500 py-3 rounded-lg font-semibold hover:opacity-90 transition shadow-lg">{igLoading ? "Redirigiendo..." : "🔗 Conectar IG"}</button>
          </div>
        )}
        {igStatus && <p className="mt-4 text-xs text-slate-200/80 text-center relative z-10">{igStatus}</p>}
      </div>

      {/* 4. TIKTOK */}
      <div className="relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-8 shadow-xl">
        {/* Fondo Logo */}
        <div className="absolute -right-6 -top-6 opacity-10 pointer-events-none select-none">
            <Image src={TtIcon} alt="TikTok" width={120} height={120} />
        </div>

        <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 relative z-10">TikTok</h2>
        {ttCheckingStatus ? (
          <p className="text-slate-200/70 text-sm animate-pulse text-center relative z-10">🔄 Verificando...</p>
        ) : ttLinked ? (
          <div className="relative z-10">
            {ttExpired ? (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl mb-4 text-center">
                    <p className="text-red-200 font-bold text-sm mb-2">⚠️ Sesión Caducada</p>
                    <p className="text-xs text-red-200/70 mb-4">Por seguridad, debes iniciar sesión nuevamente en TikTok.</p>
                    <button onClick={handleTikTokConnect} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-bold transition shadow-lg">🔄 Reconectar</button>
                </div>
            ) : (
                <>
                    <p className="text-slate-200 font-semibold mb-4 text-sm truncate text-center">✅ {ttUsername}</p>
                    {ttCheckingProfile ? (
                    <p className="text-slate-200/70 text-sm animate-pulse text-center mb-4">⏳ Cargando perfil...</p>
                    ) : ttProfile && (
                    <div className="bg-black/20 p-4 rounded-xl mb-4 text-left border border-white/5">
                        <div className="flex items-center gap-3">
                        <img src={ttProfile.avatar_url || "https://cdn-icons-png.flaticon.com/512/3046/3046121.png"} className="w-12 h-12 rounded-full border border-white/10" alt="TikTok" />
                        <div className="overflow-hidden">
                            <p className="font-bold truncate text-slate-200">{ttProfile.display_name}</p>
                            <p className="text-slate-400 text-xs truncate">@{ttProfile.username}</p>
                        </div>
                        </div>
                        <div className="flex justify-between mt-4 text-slate-300 text-center">
                        <div>
                            <p className="font-bold">{ttProfile.follower_count}</p>
                            <p className="text-[10px] uppercase text-slate-500">Seguidores</p>
                        </div>
                        <div>
                            <p className="font-bold">{ttProfile.likes_count}</p>
                            <p className="text-[10px] uppercase text-slate-500">Likes</p>
                        </div>
                        </div>
                        <button onClick={handleTikTokRefresh} disabled={ttRefreshDisabled} className={`mt-4 w-full py-2 rounded-lg text-xs font-semibold transition-all ${ttRefreshDisabled ? "bg-white/5 text-slate-500" : "bg-white/10 hover:bg-white/20 text-white border border-white/10"}`}>{ttRefreshDisabled ? "⏳ Espera..." : "🔄 Actualizar datos"}</button>
                    </div>
                    )}
                </>
            )}
            <button onClick={handleTikTokUnlink} disabled={ttLoading} className="w-full bg-white/5 hover:bg-red-500/20 hover:text-red-200 text-slate-400 border border-white/10 py-2 rounded-lg text-sm transition">{ttLoading ? "..." : "Desvincular"}</button>
          </div>
        ) : (
          <div className="relative z-10">
            <p className="text-sm text-slate-200/60 mb-6 text-center">Sincroniza tu cuenta de TikTok.</p>
            <button onClick={handleTikTokConnect} disabled={ttLoading} className="w-full bg-gradient-to-r from-black to-gray-800 border border-white/20 py-3 rounded-lg font-semibold hover:opacity-90 transition shadow-lg text-white">{ttLoading ? "Redirigiendo..." : "🔗 Conectar TikTok"}</button>
          </div>
        )}
        {ttStatus && <p className="mt-4 text-xs text-slate-200/80 text-center relative z-10">{ttStatus}</p>}
      </div>

    </div>
  );
}