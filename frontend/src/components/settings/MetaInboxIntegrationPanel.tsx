import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SecretInput } from "@/components/ui/SecretInput";
import { useVerifyMetaConnection } from "@/hooks/useIntegrations";
import { env } from "@/config/env";
import { inboxApiService } from "@/services/inboxApiService";
import type { InboxSettings } from "@/types";

interface MetaInboxIntegrationPanelProps {
  inboxId: string;
  config: InboxSettings;
  onVerified: (message: string) => void;
  onError: (message: string) => void;
}

export function MetaInboxIntegrationPanel({
  inboxId,
  config,
  onVerified,
  onError,
}: MetaInboxIntegrationPanelProps) {
  const verifyMutation = useVerifyMetaConnection(inboxId);

  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId ?? "");
  const [businessAccountId, setBusinessAccountId] = useState(config.businessAccountId ?? "");
  const [accessToken, setAccessToken] = useState(config.apiKey ?? "");
  const [tokenLoaded, setTokenLoaded] = useState(Boolean(config.apiKey));
  const [syncWhatsAppContacts, setSyncWhatsAppContacts] = useState(true);

  useEffect(() => {
    setPhoneNumberId(config.phoneNumberId ?? "");
    setBusinessAccountId(config.businessAccountId ?? "");
  }, [config.phoneNumberId, config.businessAccountId]);

  useEffect(() => {
    if (env.useMock) {
      const token = config.apiKey ?? "";
      setAccessToken(token);
      setTokenLoaded(Boolean(token));
      return;
    }

    let cancelled = false;
    void inboxApiService.getMetaCredentials(inboxId).then((credentials) => {
      if (cancelled) return;
      const token = credentials.accessToken ?? "";
      setAccessToken(token);
      setTokenLoaded(Boolean(token));
    });

    return () => {
      cancelled = true;
    };
  }, [inboxId, config.apiKey]);

  const handleVerify = () => {
    verifyMutation.mutate(
      {
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId.trim(),
        accessToken: accessToken.trim(),
        syncWhatsAppContacts,
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            const syncNote = result.contactSyncRequested
              ? " Sincronización de contactos solicitada (puede tardar unos minutos)."
              : result.contactSyncError
                ? ` Sync de contactos no disponible: ${result.contactSyncError}`
                : "";
            onVerified(
              (result.phoneNumber
                ? `Conectado: ${result.phoneNumber}${result.verifiedName ? ` (${result.verifiedName})` : ""}`
                : "Conexión verificada con Meta API") + syncNote
            );
            setAccessToken("");
            setTokenLoaded(false);
            if (!env.useMock) {
              void inboxApiService.getMetaCredentials(inboxId).then((credentials) => {
                const token = credentials.accessToken ?? "";
                setAccessToken(token);
                setTokenLoaded(Boolean(token));
              });
            }
          } else {
            onError(result.error ?? "No se pudo verificar la conexión");
          }
        },
        onError: () => onError("Error al verificar con Meta API. Revisa token e IDs."),
      }
    );
  };

  const tokenPlaceholder = "Pega aquí un token nuevo de Meta";

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border-primary)] space-y-3">
      <div>
        <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
          Meta Cloud API
        </h4>
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Conecta el número con Phone Number ID, WhatsApp Business Account ID y token de acceso.
          El webhook se registrará en tu backend al verificar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-1">
          <span className="text-[11px] text-[var(--color-text-muted)] mb-1 block">
            Phone Number ID
          </span>
          <input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Ej. 123456789012345"
            className={fieldClass}
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-[11px] text-[var(--color-text-muted)] mb-1 block">
            WABA ID
          </span>
          <input
            type="text"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="Ej. 987654321098765"
            className={fieldClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-[var(--color-text-muted)] mb-1 block">
            Token de acceso
          </span>
          <SecretInput
            value={accessToken}
            onChange={setAccessToken}
            defaultVisible={tokenLoaded}
            placeholder={tokenPlaceholder}
            className={fieldClass}
            revealLabel="Mostrar token de acceso"
            hideLabel="Ocultar token de acceso"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={syncWhatsAppContacts}
          onChange={(e) => setSyncWhatsAppContacts(e.target.checked)}
          className="mt-0.5 rounded border-[var(--color-border-primary)]"
        />
        <span className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
          Sincronizar contactos de WhatsApp Business App al conectar (coexistencia).
          Meta enviará la agenda en los próximos minutos vía webhook.
        </span>
      </label>

      <button
        type="button"
        onClick={handleVerify}
        disabled={verifyMutation.isPending}
        className="h-9 px-4 text-sm font-medium rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] disabled:opacity-60 transition-colors inline-flex items-center gap-2"
      >
        {verifyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Verificar y conectar con Meta
      </button>
    </div>
  );
}

const fieldClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)]";
