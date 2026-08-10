import { OutgoingWebhooksPanel } from "@/components/settings/OutgoingWebhooksPanel";

export function IntegrationsSettingsPage() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-text-secondary)]">
        Conecta Chatpool con sistemas externos. Los canales WhatsApp / Meta se configuran en
        Bandejas; aquí solo gestionas webhooks salientes.
      </p>

      <OutgoingWebhooksPanel />
    </div>
  );
}
