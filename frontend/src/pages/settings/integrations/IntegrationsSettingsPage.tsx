import { Link } from "react-router-dom";
import { Copy, ExternalLink, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderWebhookHelp } from "@/lib/integrationProviders";
import type { IntegrationAccountDto } from "@/types/api";
import { useIntegrationAccounts, useProviderInboxes } from "@/hooks/useIntegrations";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useUIStore } from "@/store/uiStore";
import { InboxStatusBadge, SettingsSection } from "@/components/settings/SettingsSection";

const providerIcons: Record<string, string> = {
  meta: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
};

export function IntegrationsSettingsPage() {
  const showToast = useUIStore((s) => s.showToast);
  const getByInboxId = useInboxSettingsStore((s) => s.getByInboxId);
  const getInboxById = useInboxStore((s) => s.getInboxById);
  const { data: accounts = [] } = useIntegrationAccounts();

  const copyWebhook = (url: string) => {
    void navigator.clipboard.writeText(url);
    showToast("Webhook copiado");
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-text-secondary)]">
        Proveedores disponibles en tu instancia. Cuando se despliegue una integración nueva,
        aparecerá aquí automáticamente.
      </p>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-tertiary)]">
            <Plug className="h-6 w-6 text-[var(--color-text-muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Sin integraciones activas
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)] max-w-md">
              Aún no hay proveedores desplegados. Cuando configures una bandeja con un canal
              soportado, verás su webhook y bandejas vinculadas en esta pantalla.
            </p>
          </div>
        </div>
      ) : (
        accounts.map((account) => (
          <ProviderSection
            key={account.id}
            account={account}
            getInboxById={getInboxById}
            getByInboxId={getByInboxId}
            onCopyWebhook={copyWebhook}
          />
        ))
      )}
    </div>
  );
}

function ProviderSection({
  account,
  getInboxById,
  getByInboxId,
  onCopyWebhook,
}: {
  account: IntegrationAccountDto;
  getInboxById: ReturnType<typeof useInboxStore.getState>["getInboxById"];
  getByInboxId: ReturnType<typeof useInboxSettingsStore.getState>["getByInboxId"];
  onCopyWebhook: (url: string) => void;
}) {
  const { data: linkedInboxes = [] } = useProviderInboxes(account.provider);
  const webhookHelp = getProviderWebhookHelp(account.provider);

  return (
    <SettingsSection
      title={account.name}
      description={account.description}
      action={
        <span
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full font-medium",
            account.connected
              ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
          )}
        >
          {account.connected ? "Conectado" : "Pendiente"}
        </span>
      }
    >
      <div className="space-y-4">
        {account.webhookUrl && (
          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              Webhook global
            </h4>
            <div className="flex items-center justify-between gap-2">
              <code className="text-[12px] text-[var(--color-text-secondary)] truncate">
                {account.webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => onCopyWebhook(account.webhookUrl!)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
                title="Copiar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            {webhookHelp ? (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-2">{webhookHelp}</p>
            ) : null}
          </div>
        )}

        <div>
          <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2.5">
            Bandejas vinculadas ({linkedInboxes.length})
          </h4>
          <div className="space-y-2">
            {linkedInboxes.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-muted)] px-1 py-2">
                Ninguna bandeja usa este proveedor todavía.
              </p>
            ) : null}
            {linkedInboxes.map((settings) => {
              const inbox = getInboxById(settings.inboxId);
              const liveStatus = getByInboxId(settings.inboxId)?.status ?? settings.status;

              return (
                <div
                  key={settings.inboxId}
                  className="flex items-center justify-between gap-3 p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--color-text-primary)] truncate">
                      {inbox?.name ?? settings.inboxId}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {settings.detail} · {settings.providerResource}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <InboxStatusBadge status={liveStatus} />
                    <Link
                      to={`/settings/inboxes/${settings.inboxId}?section=integration`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                      title="Configurar bandeja"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {account.provider === "meta" && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]/40">
            {providerIcons.meta && (
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d={providerIcons.meta} />
                </svg>
              </div>
            )}
            <p className="text-[12px] text-[var(--color-text-secondary)]">
              {linkedInboxes.length}{" "}
              {linkedInboxes.length === 1 ? "bandeja usa" : "bandejas usan"} Meta API en esta
              cuenta.
            </p>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
