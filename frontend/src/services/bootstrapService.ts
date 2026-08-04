import { isApiError } from "@/api/errors";
import { env } from "@/config/env";
import { agentApiService } from "@/services/agentApiService";
import { authService } from "@/services/authService";
import { conversationApiService } from "@/services/conversationApiService";
import { inboxApiService } from "@/services/inboxApiService";
import { labelApiService } from "@/services/labelApiService";
import { roleApiService } from "@/services/roleApiService";
import { getCurrentAgentId } from "@/lib/authSession";
import { resolveInboxFilter, saveInboxFilter } from "@/lib/inboxFilterSession";
import { mergeAgentProfile, useAgentStore } from "@/store/agentStore";
import { useConversationStore } from "@/store/conversationStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useInboxStore } from "@/store/inboxStore";
import { useLabelStore } from "@/store/labelStore";
import { useRoleStore } from "@/store/roleStore";
import type { Role } from "@/types";

async function fetchRolesForBootstrap(): Promise<Role[]> {
  try {
    return await roleApiService.list();
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      console.warn("[bootstrap] GET /roles no disponible (API desactualizada); continuando sin lista de roles");
      return [];
    }
    throw error;
  }
}

async function fetchInboxConversations(inboxId: string | null) {
  return conversationApiService.list({
    inboxId,
    status: "all",
    assignee: "all",
  });
}

export async function refreshInboxDataFromApi(): Promise<void> {
  if (env.useMock) return;

  const [inboxes, settings] = await Promise.all([
    inboxApiService.listInboxes(),
    inboxApiService.listSettings(),
  ]);

  useInboxStore.getState().setInboxes(inboxes);
  useInboxSettingsStore.getState().setSettings(settings);
}

export async function bootstrapAppData(): Promise<void> {
  if (env.useMock) return;

  useConversationStore.getState().setAppDataBootstrapped(false);

  const [agents, inboxes, settings, labels, roles, me] = await Promise.all([
    agentApiService.list(),
    inboxApiService.listInboxes(),
    inboxApiService.listSettings(),
    labelApiService.listAll(),
    fetchRolesForBootstrap(),
    authService.getMe(),
  ]);

  useAgentStore.getState().setAgents(agents);
  useRoleStore.getState().setRoles(roles);
  useInboxStore.getState().setInboxes(inboxes);
  useInboxSettingsStore.getState().setSettings(settings);
  useLabelStore.getState().setLabels(labels);

  if (me) {
    mergeAgentProfile(me);
  }

  const agentId = getCurrentAgentId();
  const inboxIds = inboxes.map((inbox) => inbox.id);
  const inboxFilterId = agentId ? resolveInboxFilter(agentId, inboxIds) : inboxIds[0] ?? null;

  if (agentId && inboxFilterId) {
    saveInboxFilter(agentId, inboxFilterId);
  }

  useConversationStore.setState({
    filterInboxId: inboxFilterId,
    filterLabelId: null,
  });

  const conversations = await fetchInboxConversations(inboxFilterId);

  useConversationStore.getState().setConversations(conversations);
  useConversationStore.getState().setAppDataBootstrapped(true);
}

export async function refreshConversationsFromApi(): Promise<void> {
  if (env.useMock) return;
  const { filterInboxId } = useConversationStore.getState();

  const conversations = await fetchInboxConversations(filterInboxId);
  useConversationStore.getState().setConversations(conversations);
}
