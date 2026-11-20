"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import CuentasConectadas from "@/components/CuentasConectadas";
import { Avatar, Button, Card, Field, PageHeader, PasswordChecklist, inputClass } from "@/components/ui";
import { isStrongPassword } from "@/lib/password";

type Tab = "cuentas" | "perfil" | "seguridad";
const TABS: { key: Tab; label: string }[] = [
  { key: "cuentas", label: "Redes conectadas" },
  { key: "perfil", label: "Datos personales" },
  { key: "seguridad", label: "Contraseña" },
];

export default function PerfilPage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("cuentas");
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((json) => {
        const d = json.data;
        if (!json.ok || !d?.userOrgId) return setOrgName("Independiente");
        setOrgName(d.organizationName || d.userOrgName || d.organizations?.find((o: { id: number; name: string }) => o.id === d.userOrgId)?.name || "Mi organización");
      })
      .catch(() => setOrgName("Independiente"));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Cuentas y perfil" description="Conecta tus redes sociales y administra tu cuenta de UniPost." />

      <Card className="mb-6 flex items-center gap-4 p-5">
        <Avatar src={session?.user?.image} name={session?.user?.name || session?.user?.email} size={56} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">{session?.user?.name || "Mi cuenta"}</p>
          <p className="truncate text-sm text-slate-400">{session?.user?.email}</p>
        </div>
        {orgName && <span className="ml-auto hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 sm:inline">{orgName}</span>}
      </Card>

      <div className="mb-6 flex gap-1 border-b border-white/10" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${activeTab === t.key ? "border-indigo-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "cuentas" && <CuentasConectadas />}
        {activeTab === "perfil" && session?.user && (
          <ProfileForm
            initialName={session.user.name || ""}
            initialImage={session.user.image || null}
            email={session.user.email || ""}
            onSaved={async (name, image) => { await update({ user: { name, image } }); }}
          />
        )}
        {activeTab === "seguridad" && <PasswordForm />}
      </div>
    </div>
  );
}

function ProfileForm({ initialName, initialImage, email, onSaved }: { initialName: string; initialImage: string | null; email: string; onSaved: (name: string, image: string | null) => Promise<void> }) {
  const [name, setName] = useState(initialName);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialImage);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = name.trim() !== initialName || file !== null;
  const nameError = name.trim().length < 2 ? "Ingresa al menos 2 caracteres." : null;

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type) || f.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe ser JPG, PNG, WEBP o GIF de hasta 5 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (nameError) return;
    setSaving(true);
    const formData = new FormData();
    formData.append("name", name.trim());
    if (file) formData.append("file", file);
    try {
      const data = await fetch("/api/profile/update", { method: "PUT", body: formData }).then((r) => r.json());
      if (!data.ok) throw new Error(data.error);
      await onSaved(data.user.name, data.user.image);
      setFile(null);
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error((err as Error).message || "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar src={preview} name={name || email} size={72} />
          <div>
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Cambiar foto</Button>
            <p className="mt-1.5 text-xs text-slate-500">JPG, PNG, WEBP o GIF · máx. 5 MB</p>
          </div>
          <input type="file" ref={fileInputRef} className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImage} />
        </div>
        <Field label="Nombre" htmlFor="name" error={nameError}>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={60} aria-invalid={!!nameError} />
        </Field>
        <Field label="Correo electrónico" htmlFor="email" hint="El correo no se puede cambiar.">
          <input id="email" type="email" value={email} disabled className={inputClass} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty || !!nameError}>Guardar cambios</Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);

  const mismatch = confirmPass !== "" && confirmPass !== newPass;
  const canSubmit = currentPass && isStrongPassword(newPass) && newPass === confirmPass;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const json = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      }).then((r) => r.json());
      if (!json.ok) throw new Error(json.error);
      toast.success("Contraseña actualizada. Las demás sesiones se cerrarán en unos minutos.");
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
    } catch (err) {
      toast.error((err as Error).message || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Contraseña actual" htmlFor="current">
          <input id="current" type="password" autoComplete="current-password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Nueva contraseña" htmlFor="new">
          <input id="new" type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputClass} maxLength={72} />
        </Field>
        <PasswordChecklist password={newPass} />
        <Field label="Confirmar nueva contraseña" htmlFor="confirm" error={mismatch ? "Las contraseñas no coinciden." : null}>
          <input id="confirm" type="password" autoComplete="new-password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className={inputClass} aria-invalid={mismatch} maxLength={72} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={loading} disabled={!canSubmit}>Actualizar contraseña</Button>
        </div>
      </form>
    </Card>
  );
}
