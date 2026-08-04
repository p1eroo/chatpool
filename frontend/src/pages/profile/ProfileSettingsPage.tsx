import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AgentPhoneField } from "@/components/settings/AgentPhoneField";
import { phoneToInputValue } from "@/lib/agentPhone";
import { useAuthStore } from "@/store/authStore";
import { useAgentStore } from "@/store/agentStore";
import { useUIStore } from "@/store/uiStore";

export function ProfileSettingsPage() {
  const showToast = useUIStore((s) => s.showToast);
  const currentAgent = useAuthStore((s) => s.getCurrentAgent());
  const updateAgent = useAgentStore((s) => s.updateAgent);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!currentAgent) return;
    setName(currentAgent.name);
    setPhone(phoneToInputValue(currentAgent.phone || ""));
  }, [currentAgent]);

  const handleSave = async () => {
    if (!currentAgent || !name.trim()) return;

    const ok = await updateAgent(currentAgent.id, {
      name: name.trim(),
      phone,
    });

    showToast(ok ? "Perfil actualizado" : "No se pudo guardar el perfil");
  };

  if (!currentAgent) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-xl w-full p-6">
        <Link
          to="/inbox"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inbox
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <Avatar name={name || currentAgent.name} size="xl" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Ajustes del perfil
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Actualiza tu nombre y teléfono de contacto
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Usuario: @{currentAgent.username}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand)]"
            />
          </div>

          <AgentPhoneField value={phone} required={false} onChange={setPhone} />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-light)] transition-colors"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
