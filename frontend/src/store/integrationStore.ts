import { create } from "zustand";
import { integrationAccounts as seedAccounts } from "@/data/mock";
import { buildProviderWebhookUrl } from "@/lib/webhooks";
import type { IntegrationAccount } from "@/types";

const STORAGE_KEY = "chatpool-integrations";

function loadAccounts(): IntegrationAccount[] {
  if (typeof window === "undefined") return seedAccounts;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as IntegrationAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore invalid storage
  }

  return seedAccounts;
}

function saveAccounts(accounts: IntegrationAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

interface IntegrationState {
  accounts: IntegrationAccount[];
  setConnected: (provider: IntegrationAccount["provider"], connected: boolean) => void;
  getAccountByProvider: (provider: IntegrationAccount["provider"]) => IntegrationAccount | undefined;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  accounts: loadAccounts(),

  setConnected: (provider, connected) => {
    const accounts = get().accounts.map((account) =>
      account.provider === provider ? { ...account, connected } : account
    );
    saveAccounts(accounts);
    set({ accounts });
  },

  getAccountByProvider: (provider) =>
    get().accounts.find((account) => account.provider === provider),
}));

export function getIntegrationWebhookUrl(account: IntegrationAccount): string | undefined {
  if (account.webhookUrl) return account.webhookUrl;
  if (account.provider === "meta") {
    return buildProviderWebhookUrl(account.provider);
  }
  return undefined;
}
