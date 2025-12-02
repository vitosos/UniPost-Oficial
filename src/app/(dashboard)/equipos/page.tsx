"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

// --- TIPOS ---
type Metrics = {
    likes: number;
    comments: number;
    publishedPosts: number;
    organizationId: number;
};

type Organization = {
    id: number;
    name: string;
    plan: string;
};

type Member = {
    id: number;
    name: string;
    email: string;
    globalRoleId: number; // Rol del sistema (1-5)
    membershipRole: string; // Rol en la org ("Miembro" | "Manager")
    totalPosts: number;
    totalLikes: number;
    image?: string | null;
};

type OrphanUser = {
    id: number;
    name: string;
    email: string;
    roleId: number;
};

// Configuración de ordenamiento
type SortConfig = {
    key: keyof Member | "efficiency"; 
    direction: "asc" | "desc";
};

export default function EquiposPage() {
    const { data: session } = useSession();

    const [loading, setLoading] = useState(true);
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
    
    // Permisos
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>("None"); // Rol del usuario actual en la org (Miembro/Manager)

    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [orphanedUsers, setOrphanedUsers] = useState<OrphanUser[]>([]);

    const [selectedOrgId, setSelectedOrgId] = useState<number | "">("");
    const [targetOrgForOrphan, setTargetOrgForOrphan] = useState<{ [userId: number]: string }>({});
    
    // Estado para mover usuario
    const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
    const [targetOrgForMove, setTargetOrgForMove] = useState<string>("");

    // Estado para cambiar rol
    const [updatingRole, setUpdatingRole] = useState<{ [userId: number]: boolean }>({});

    const [newOrgName, setNewOrgName] = useState("");
    const [newOrgPlan, setNewOrgPlan] = useState("FREE");

    const [memberSearch, setMemberSearch] = useState("");
    const [orphanSearch, setOrphanSearch] = useState("");

    // Ordenamiento
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "totalPosts", direction: "desc" });

    useEffect(() => {
        fetchData();
    }, [selectedOrgId]);

    async function fetchData() {
        setLoading(true);
        let url = "/api/organizations";
        if (selectedOrgId) url += `?orgId=${selectedOrgId}`;

        try {
            const res = await fetch(url);
            const json = await res.json();

            if (json.ok) {
                setIsSuperAdmin(json.data.isSuperAdmin);
                setCurrentUserRole(json.data.currentUserRole || "None");
                
                if (json.data.organizations) setOrganizations(json.data.organizations);
                setMetrics(json.data.metrics || null);
                setMembers(json.data.members || []);
                setOrphanedUsers(json.data.orphanedUsers || []);
            } else {
                toast.error("Error cargando datos");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleSort = (key: SortConfig["key"]) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
        }));
    };

    const processedMembers = useMemo(() => {
        let filtered = members.filter(m =>
            m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
            m.email?.toLowerCase().includes(memberSearch.toLowerCase())
        );

        return filtered.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof Member];
            let valB: any = b[sortConfig.key as keyof Member];

            if (sortConfig.key === "efficiency") {
                valA = a.totalPosts > 0 ? a.totalLikes / a.totalPosts : 0;
                valB = b.totalPosts > 0 ? b.totalLikes / b.totalPosts : 0;
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [members, memberSearch, sortConfig]);

    const filteredOrphans = orphanedUsers.filter(u =>
        u.name?.toLowerCase().includes(orphanSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(orphanSearch.toLowerCase())
    );

    async function handleCreateOrg(e: React.FormEvent) {
        e.preventDefault();
        if (!newOrgName) return;
        setIsCreatingOrg(true);
        try {
            const res = await fetch("/api/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newOrgName, plan: newOrgPlan }),
            });
            if ((await res.json()).ok) { toast.success("Organización creada ✅"); setNewOrgName(""); fetchData(); }
        } catch { toast.error("Error de conexión"); } 
        finally { setIsCreatingOrg(false); }
    }

    async function handleDeleteOrg(id: number) {
        if (!confirm("¿Seguro? Esto podría romper usuarios asociados.")) return;
        const res = await fetch(`/api/organizations?id=${id}`, { method: "DELETE" });
        if ((await res.json()).ok) { toast.success("Eliminada 🗑️"); if (selectedOrgId === id) setSelectedOrgId(""); fetchData(); }
        else { toast.error("No se pudo eliminar"); }
    }

    async function handleMoveUser(userId: number) {
        if (!targetOrgForMove) return;
        const res = await fetch("/api/organizations", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, newOrgId: targetOrgForMove })
        });
        if ((await res.json()).ok) { toast.success("Usuario movido ✈️"); setEditingMemberId(null); setTargetOrgForMove(""); fetchData(); }
        else { toast.error("Error al mover"); }
    }

    async function handleAssignOrphan(userId: number) {
        const orgId = targetOrgForOrphan[userId]; if (!orgId) return;
        const res = await fetch("/api/organizations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, newOrgId: orgId }) });
        if ((await res.json()).ok) { toast.success("Usuario asignado ✅"); setTargetOrgForOrphan(prev => { const copy = { ...prev }; delete copy[userId]; return copy; }); fetchData(); }
        else { toast.error("Error al asignar"); }
    }

    // 🆕 Función para cambiar el rol de membresía
    async function handleChangeRole(userId: number, newRole: string) {
        if (!metrics?.organizationId) return;
        setUpdatingRole(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch("/api/organizations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, organizationId: metrics.organizationId, newRole })
            });
            if ((await res.json()).ok) {
                toast.success(`Rol actualizado a ${newRole}`);
                setMembers(prev => prev.map(m => m.id === userId ? { ...m, membershipRole: newRole } : m));
            } else {
                toast.error("No se pudo actualizar el rol");
            }
        } catch { toast.error("Error de conexión"); }
        finally { setUpdatingRole(prev => ({ ...prev, [userId]: false })); }
    }

    const currentOrgName = organizations.find(o => o.id === metrics?.organizationId)?.name || "Mi Organización";
    const SortIcon = ({ colKey }: { colKey: SortConfig["key"] }) => {
        if (sortConfig.key !== colKey) return <span className="text-slate-200/20 ml-1">↕</span>;
        return <span className="text-slate-200 ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10">

            {isSuperAdmin && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <span className="text-indigo-300 font-bold text-sm uppercase tracking-wider">🛡️ Panel de Administrador</span>
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-slate-300">Ver datos de:</label>
                        <select
                            className="p-2 bg-black/30 border border-white/20 rounded text-slate-200 text-sm focus:border-indigo-500 outline-none"
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                        >
                            <option value="">-- Mi Organización --</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name} (ID: {org.id})</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <section className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-end border-b border-white/20 pb-4 gap-4">
                    <div>
                        <h2 className="text-sm uppercase tracking-wider text-indigo-200 font-bold">Vista Operativa</h2>
                        <h1 className="text-4xl font-bold flex items-center gap-3">
                            🏢 {currentOrgName}
                            {metrics?.organizationId && isSuperAdmin && <span className="text-sm bg-white/10 px-2 rounded border border-white/20 text-base font-normal">ID: {metrics.organizationId}</span>}
                        </h1>
                    </div>
                </div>
                
                {loading ? <div className="text-center py-10 animate-pulse">Cargando...</div> : metrics ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-xl">
                                <p className="text-sm text-gray-300 font-bold">Total Likes</p>
                                <p className="text-4xl font-bold">{metrics.likes} ❤️</p>
                            </div>
                            <div className="backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-xl">
                                <p className="text-sm text-gray-300 font-bold">Comentarios</p>
                                <p className="text-4xl font-bold">{metrics.comments} 💬</p>
                            </div>
                            <div className="backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-xl">
                                <p className="text-sm text-gray-300 font-bold">Publicaciones</p>
                                <p className="text-4xl font-bold">{metrics.publishedPosts} 📒</p>
                            </div>
                        </div>

                        <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">👥 Miembros del Equipo</h2>
                                <input
                                    type="text" placeholder="Buscar usuario..."
                                    className="bg-black/20 border border-white/20 rounded-full px-4 py-2 text-sm text-slate-200 focus:outline-none w-64"
                                    value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                                />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-200/60 border-b border-white/10 text-sm uppercase cursor-pointer select-none">
                                            <th className="p-4 hover:text-slate-200" onClick={() => handleSort("name")}>Usuario <SortIcon colKey="name" /></th>
                                            <th className="p-4 hover:text-slate-200" onClick={() => handleSort("membershipRole")}>Rol <SortIcon colKey="membershipRole" /></th>
                                            <th className="p-4 text-center hover:text-slate-200" onClick={() => handleSort("totalPosts")}>Posts <SortIcon colKey="totalPosts" /></th>
                                            <th className="p-4 text-center hover:text-slate-200" onClick={() => handleSort("totalLikes")}>Likes <SortIcon colKey="totalLikes" /></th>
                                            <th className="p-4 text-center hover:text-slate-200" onClick={() => handleSort("efficiency")}>Eficiencia <SortIcon colKey="efficiency" /></th>
                                            <th className="p-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {processedMembers.length > 0 ? processedMembers.map((member) => (
                                            <tr key={member.id} className="hover:bg-white/5 transition">
                                                <td className="p-4 flex items-center gap-3">
                                                    <img
                                                        src={member.image || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                                        alt="avatar" className="w-10 h-10 rounded-full object-cover border border-white/20"
                                                    />
                                                    <div>
                                                        <div className="font-bold">{member.name}</div>
                                                        <div className="text-sm text-slate-200/50">{member.email}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {/* SELECTOR DE ROL: Solo para Super Admins */}
                                                    {isSuperAdmin ? (
                                                        <select 
                                                            value={member.membershipRole}
                                                            onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                                            disabled={updatingRole[member.id]}
                                                            className={`text-xs border px-2 py-1 rounded font-medium bg-black/30 outline-none cursor-pointer transition ${
                                                                member.membershipRole === "Manager" ? "border-purple-500/50 text-purple-200" : "border-white/20 text-slate-200"
                                                            }`}
                                                        >
                                                            <option value="Miembro">Miembro</option>
                                                            <option value="Manager">Manager</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`text-xs border px-2 py-1 rounded font-medium ${
                                                            member.membershipRole === "Manager" ? "bg-purple-500/30 border-purple-500/50 text-purple-200" : "bg-white/10 border-white/10 text-slate-200"
                                                        }`}>
                                                            {member.membershipRole}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-mono">{member.totalPosts}</td>
                                                <td className="p-4 text-center font-mono text-pink-300">{member.totalLikes}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-sm font-bold px-2 py-1 rounded ${(member.totalPosts > 0 ? member.totalLikes / member.totalPosts : 0) > 10 ? "bg-green-500/20 text-green-300" : "bg-white/5 text-slate-200/60"}`}>
                                                        {member.totalPosts > 0 ? (member.totalLikes / member.totalPosts).toFixed(1) : "0.0"}
                                                    </span>
                                                </td>

                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        
                                                        {/* 👁️ Botón Métricas: Visible para SuperAdmin O Manager de la org */}
                                                        {(isSuperAdmin || currentUserRole === "Manager") && (
                                                            <a
                                                                href={`/equipos/metricas/${member.id}`}
                                                                className="text-xs bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 px-3 py-1.5 rounded transition border border-blue-500/30 flex items-center gap-1"
                                                                title="Ver métricas de este usuario"
                                                            >
                                                                📊 <span className="hidden lg:inline">Métricas</span>
                                                            </a>
                                                        )}

                                                        {/* Mover Usuario: Solo SuperAdmin */}
                                                        {isSuperAdmin && (
                                                            editingMemberId === member.id ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <select
                                                                        className="text-sm bg-black/20 border border-white/30 rounded px-2 py-1 text-slate-200"
                                                                        value={targetOrgForMove}
                                                                        onChange={(e) => setTargetOrgForMove(e.target.value)}
                                                                    >
                                                                        <option value="">Destino...</option>
                                                                        {organizations.filter(o => o.id !== metrics.organizationId).map(o => (
                                                                            <option key={o.id} value={o.id}>{o.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button onClick={() => handleMoveUser(member.id)} disabled={!targetOrgForMove} className="bg-green-500 p-1 rounded">💾</button>
                                                                    <button onClick={() => setEditingMemberId(null)} className="bg-red-500/50 p-1 rounded">✕</button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => setEditingMemberId(member.id)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded">🔁 Mover</button>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={6} className="p-4 text-center text-slate-200/50">No se encontraron miembros.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-10 bg-white/5 rounded-xl border border-white/10"><p className="text-slate-200/70">Sin organización.</p></div>
                )}
            </section>

            {isSuperAdmin && (
                <section className="space-y-6 border-t-2 border-white/10 pt-10">
                    <div className="flex flex-col md:flex-row justify-between items-end">
                        <div>
                            <h2 className="text-sm uppercase tracking-wider text-orange-200 font-bold">Zona Administrativa</h2>
                            <h1 className="text-3xl font-bold">⚙️ Gestión de Organizaciones</h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-4">Organizaciones Activas</h3>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {organizations.map(org => (
                                    <div key={org.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                        <span className="font-medium">{org.name} <span className="text-xs text-gray-400">({org.plan})</span></span>
                                        <button onClick={() => handleDeleteOrg(org.id)} className="text-xs bg-red-500/20 hover:bg-red-500 text-red-200 px-2 py-1 rounded transition">Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-4">Crear Nueva</h3>
                            <form onSubmit={handleCreateOrg} className="space-y-3">
                                <input type="text" placeholder="Nombre..." className="w-full p-2 rounded bg-black/20 border border-white/20 text-slate-200" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} required />
                                <select className="w-full p-2 rounded bg-black/20 border border-white/20 text-slate-200" value={newOrgPlan} onChange={e => setNewOrgPlan(e.target.value)}>
                                    <option value="FREE">Plan FREE</option>
                                    <option value="PRO">Plan PRO</option>
                                    <option value="ENTERPRISE">Plan ENTERPRISE</option>
                                </select>
                                <button disabled={isCreatingOrg} className={`w-full font-bold py-2 rounded transition flex justify-center items-center gap-2 ${isCreatingOrg ? "bg-green-600/50 cursor-not-allowed text-slate-200/70" : "bg-green-600 hover:bg-green-500 text-slate-200"}`}>
                                    {isCreatingOrg ? <><span className="animate-spin text-lg">↻</span> Creando...</> : "+ Crear"}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/30 p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-orange-200">
                                ⚠️ Usuarios sin Organización
                                <span className="text-sm bg-orange-500/20 px-2 py-1 rounded-full text-slate-200">{orphanedUsers.length}</span>
                            </h2>
                            <input type="text" placeholder="Buscar huérfano..." className="bg-black/20 border border-orange-500/30 rounded-full px-4 py-1 text-sm text-slate-200 focus:outline-none w-48" value={orphanSearch} onChange={(e) => setOrphanSearch(e.target.value)} />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-orange-200/60 border-b border-orange-500/20 text-sm uppercase">
                                        <th className="p-3">Usuario</th>
                                        <th className="p-3">Rol</th>
                                        <th className="p-3 text-right">Asignar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-orange-500/10">
                                    {filteredOrphans.length > 0 ? filteredOrphans.map(user => (
                                        <tr key={user.id} className="hover:bg-orange-500/5 transition">
                                            <td className="p-3">
                                                <div className="font-bold">{user.name || "Sin nombre"}</div>
                                                <div className="text-sm text-slate-200/50">{user.email}</div>
                                            </td>
                                            <td className="p-3"><span className="text-xs border border-orange-500/30 px-2 py-1 rounded text-orange-200">{user.roleId}</span></td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select className="text-sm bg-black/20 border border-orange-500/30 rounded px-2 py-1 text-slate-200" value={targetOrgForOrphan[user.id] || ""} onChange={(e) => setTargetOrgForOrphan({ ...targetOrgForOrphan, [user.id]: e.target.value })}>
                                                        <option value="">Seleccionar Org...</option>
                                                        {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                                                    </select>
                                                    <button onClick={() => handleAssignOrphan(user.id)} disabled={!targetOrgForOrphan[user.id]} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-200 px-3 py-1 rounded text-sm font-bold">Asignar</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="p-4 text-center text-orange-200/50">No se encontraron usuarios huérfanos.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

        </div>
    );
}