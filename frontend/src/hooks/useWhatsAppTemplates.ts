import { useCallback, useEffect, useState } from "react";
import { env } from "@/config/env";
import { inboxApiService } from "@/services/inboxApiService";
import { MOCK_WHATSAPP_TEMPLATES } from "@/lib/whatsappTemplates";
import type { WhatsAppTemplate } from "@/types/whatsappTemplate";

export function useWhatsAppTemplates(inboxId: string | null | undefined) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!inboxId) {
      setTemplates([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (env.useMock) {
        setTemplates(MOCK_WHATSAPP_TEMPLATES);
        return;
      }

      const rows = await inboxApiService.listWhatsAppTemplates(inboxId);
      setTemplates(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar las plantillas";
      setError(message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [inboxId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { templates, loading, error, reload };
}
