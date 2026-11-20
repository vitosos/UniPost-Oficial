"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Avatar, Button, Card, EmptyState, Field, LoadingState, PageHeader, buttonClass, inputClass } from "@/components/ui";

type Metrics = { likes: number; comments: number; publishedPosts: number; organizationId: number };
type Organization = { id: number; name: string; plan: string };
type Member = {
  id: number;
  name: string;
  email: string;
  globalRoleId: number;
  membershipRole: string; // "Miembro" | "Manager"
  totalPosts: number;
  totalLikes: number;
  image?: string | null;
};
type OrphanUser = { id: number; name: string | null; email: string; roleID: number | null };
type SortKey = "name" | "membershipRole" | "totalPosts" | "totalLikes" | "efficiency";

const efficiency = (m: Member) => (m.totalPosts > 0 ? m.totalLikes / m.totalPosts : 0);
const fmt = (n: number) => n.toLocaleString("es-CL");

async function sendJson(method: string, body?: unknown, query = "") {
  const res = await fetch(`/api/organizations${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return Boolean(json.ok);
}

export default function EquiposPage() {
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("None");
  const [userOrgName, setUserOrgName] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orphanedUsers, setOrphanedUsers] = useState<OrphanUser[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | "">("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetch(`/api/organizations${selectedOrgId ? `?orgId=${selectedOrgId}` : ""}`).then((r) => r.json());
      if (!json.ok) throw new Error();
      const d = json.data;
      setIsSuperAdmin(Boolean(d.isSuperAdmin));
      setCurrentUserRole(d.currentUserRole || "None");
      setUserOrgName(d.userOrgName || d.organizations?.find((o: Organization) => o.id === d.userOrgId)?.name || "");
      if (d.organizations) setOrganizations(d.organizations);
      setMetrics(d.metrics || null);
      setMembers(d.members || []);
      setOrphanedUsers(d.orphanedUsers || []);
    } catch {
      toast.error("No se pudieron cargar los datos del equipo");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentOrgName = (isSuperAdmin && selectedOrgId ? organizations.find((o) => o.id === selectedOrgId)?.name : userOrgName) || "Mi organización";
  const canSeeMemberMetrics = isSuperAdmin || currentUserRole === "Manager";

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        title={currentOrgName}
        description="Rendimiento de tu organización y de cada miembro del equipo."
        actions={
          isSuperAdmin && (
            <div className="flex items-center gap-2">
              <label htmlFor="org-select" className="text-sm text-slate-400">Ver organización</label>
              <select id="org-select" className={`${inputClass} w-auto`} value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Mi organización</option>
                {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </div>
          )
        }
      />

      {loading ? (
        <LoadingState label="Cargando equipo..." />
      ) : !metrics ? (
        <EmptyState icon="🏢" title="Aún no perteneces a una organización" description="Un administrador de la plataforma debe asignarte a una organización para ver las métricas del equipo." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Publicaciones realizadas" value={metrics.publishedPosts} />
            <Stat label="Me gusta totales" value={metrics.likes} />
            <Stat label="Comentarios totales" value={metrics.comments} />
          </div>
          <MembersTable
            members={members}
            isSuperAdmin={isSuperAdmin}
            canSeeMemberMetrics={canSeeMemberMetrics}
            organizations={organizations}
            orgId={metrics.organizationId}
            onMembersChange={setMembers}
            onReload={fetchData}
          />
        </>
      )}

      {isSuperAdmin && !loading && (
        <AdminZone
          organizations={organizations}
          orphanedUsers={orphanedUsers}
          onReload={fetchData}
          onDeleted={(id) => selectedOrgId === id && setSelectedOrgId("")}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{fmt(value)}</p>
    </Card>
  );
}

function MembersTable({
  members, isSuperAdmin, canSeeMemberMetrics, organizations, orgId, onMembersChange, onReload,
}: {
  members: Member[];
  isSuperAdmin: boolean;
  canSeeMemberMetrics: boolean;
  organizations: Organization[];
  orgId: number;
  onMembersChange: (fn: (prev: Member[]) => Member[]) => void;
  onReload: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "totalPosts", dir: "desc" });
  const [updatingRole, setUpdatingRole] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const value = (m: Member) => (sort.key === "efficiency" ? efficiency(m) : m[sort.key]);
    return members
      .filter((m) => !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .sort((a, b) => {
        const [va, vb] = [value(a), value(b)];
        const cmp = typeof va === "string" ? va.localeCompare(String(vb), "es") : (va as number) - (vb as number);
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [members, search, sort]);

  async function changeRole(userId: number, newRole: string) {
    setUpdatingRole(userId);
    if (await sendJson("PATCH", { userId, organizationId: orgId, newRole })) {
      toast.success(`Rol actualizado a ${newRole}`);
      onMembersChange((prev) => prev.map((m) => (m.id === userId ? { ...m, membershipRole: newRole } : m)));
    } else {
      toast.error("No se pudo actualizar el rol");
    }
    setUpdatingRole(null);
  }

  async function moveUser(userId: number) {
    if (!moveTarget) return;
    if (await sendJson("PUT", { userId, newOrgId: Number(moveTarget) })) {
      toast.success("Usuario movido");
      setMovingId(null);
      setMoveTarget("");
      onReload();
    } else {
      toast.error("No se pudo mover al usuario");
    }
  }

  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "center" }) => (
    <th scope="col" className={`px-4 py-3 font-medium ${align === "center" ? "text-center" : ""}`} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
        className="inline-flex items-center gap-1 hover:text-white"
      >
        {label}
        <span aria-hidden="true" className={sort.key === k ? "text-slate-200" : "text-slate-600"}>{sort.key === k ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <Card className="p-0">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">Miembros <span className="text-sm font-normal text-slate-400">({members.length})</span></h2>
        <input type="search" placeholder="Buscar por nombre o correo" aria-label="Buscar miembros" className={`${inputClass} sm:w-72`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-white/10">
              <Th k="name" label="Usuario" />
              <Th k="membershipRole" label="Rol" />
              <Th k="totalPosts" label="Publicaciones" align="center" />
              <Th k="totalLikes" label="Me gusta" align="center" />
              <Th k="efficiency" label="Me gusta / post" align="center" />
              <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No se encontraron miembros.</td></tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={m.image} name={m.name} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{m.name}</p>
                        <p className="truncate text-xs text-slate-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <select
                        aria-label={`Rol de ${m.name}`}
                        value={m.membershipRole}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        disabled={updatingRole === m.id}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        <option value="Miembro">Miembro</option>
                        <option value="Manager">Manager</option>
                      </select>
                    ) : (
                      <RoleBadge role={m.membershipRole} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{fmt(m.totalPosts)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{fmt(m.totalLikes)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{efficiency(m).toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canSeeMemberMetrics && (
                        <Link href={`/equipos/metricas/${m.id}`} className={buttonClass("secondary", "sm")}>Ver métricas</Link>
                      )}
                      {isSuperAdmin &&
                        (movingId === m.id ? (
                          <>
                            <select aria-label="Organización de destino" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                              <option value="">Destino…</option>
                              {organizations.filter((o) => o.id !== orgId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            <Button size="sm" onClick={() => moveUser(m.id)} disabled={!moveTarget}>Mover</Button>
                            <Button size="sm" variant="ghost" onClick={() => setMovingId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setMovingId(m.id); setMoveTarget(""); }}>Cambiar org.</Button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  const manager = role === "Manager";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${manager ? "border-purple-400/40 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-300"}`}>
      {role}
    </span>
  );
}

function AdminZone({ organizations, orphanedUsers, onReload, onDeleted }: { organizations: Organization[]; orphanedUsers: OrphanUser[]; onReload: () => void; onDeleted: (id: number) => void }) {
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState("FREE");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [orphanSearch, setOrphanSearch] = useState("");
  const [orphanTarget, setOrphanTarget] = useState<Record<number, string>>({});

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    if (await sendJson("POST", { name: newOrgName.trim(), plan: newOrgPlan })) {
      toast.success("Organización creada");
      setNewOrgName("");
      onReload();
    } else {
      toast.error("No se pudo crear la organización");
    }
    setCreating(false);
  }

  async function deleteOrg(id: number) {
    if (await sendJson("DELETE", undefined, `?id=${id}`)) {
      toast.success("Organización eliminada");
      onDeleted(id);
      onReload();
    } else {
      toast.error("No se pudo eliminar. Verifica que no tenga miembros ni publicaciones.");
    }
    setConfirmDelete(null);
  }

  async function assignOrphan(userId: number) {
    const orgId = orphanTarget[userId];
    if (!orgId) return;
    if (await sendJson("PUT", { userId, newOrgId: Number(orgId) })) {
      toast.success("Usuario asignado");
      onReload();
    } else {
      toast.error("No se pudo asignar al usuario");
    }
  }

  const q = orphanSearch.trim().toLowerCase();
  const orphans = orphanedUsers.filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <section className="space-y-6 border-t border-white/10 pt-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Administración de la plataforma</p>
        <h2 className="mt-1 text-xl font-bold text-white">Organizaciones</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-white">Organizaciones activas</h3>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {organizations.map((org) => (
              <li key={org.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                <span className="min-w-0 truncate text-sm text-slate-100">
                  {org.name} <span className="text-xs text-slate-500">· {org.plan}</span>
                </span>
                {confirmDelete === org.id ? (
                  <span className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteOrg(org.id)}>Eliminar</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(org.id)} aria-label={`Eliminar ${org.name}`}>Eliminar</Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-white">Crear organización</h3>
          <form onSubmit={createOrg} className="space-y-3">
            <Field label="Nombre" htmlFor="org-name">
              <input id="org-name" className={inputClass} value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Plan" htmlFor="org-plan">
              <select id="org-plan" className={inputClass} value={newOrgPlan} onChange={(e) => setNewOrgPlan(e.target.value)}>
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </Field>
            <Button type="submit" className="w-full" loading={creating} disabled={!newOrgName.trim()}>Crear organización</Button>
          </form>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-white">
            Usuarios sin organización <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">{orphanedUsers.length}</span>
          </h3>
          <input type="search" placeholder="Buscar usuario" aria-label="Buscar usuarios sin organización" className={`${inputClass} sm:w-64`} value={orphanSearch} onChange={(e) => setOrphanSearch(e.target.value)} />
        </div>
        {orphans.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No hay usuarios pendientes de asignar.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {orphans.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{u.name || "Sin nombre"}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Organización para ${u.email}`}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200"
                    value={orphanTarget[u.id] || ""}
                    onChange={(e) => setOrphanTarget((t) => ({ ...t, [u.id]: e.target.value }))}
                  >
                    <option value="">Elegir organización…</option>
                    {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                  <Button size="sm" onClick={() => assignOrphan(u.id)} disabled={!orphanTarget[u.id]}>Asignar</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
