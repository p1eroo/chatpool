import { env } from "@/config/env";
import { agentApiService } from "@/services/agentApiService";
import { conversationApiService } from "@/services/conversationApiService";
import { inboxApiService } from "@/services/inboxApiService";
import { labelApiService } from "@/services/labelApiService";
import { getCurrentAgentId } from "@/lib/authSession";
import { resolveInboxFilter, saveInboxFilter } from "@/lib/inboxFilterSession";
import { useAgentStore } from "@/store/agentStore";
import { useConversationStore } from "@/store/conversationStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { useInboxStore } from "@/store/inboxStore";
import { useLabelStore } from "@/store/labelStore";

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

  const [agents, inboxes, settings, labels] = await Promise.all([
    agentApiService.list(),
    inboxApiService.listInboxes(),
    inboxApiService.listSettings(),
    labelApiService.listAll(),
  ]);

  useAgentStore.getState().setAgents(agents);
  useInboxStore.getState().setInboxes(inboxes);
  useInboxSettingsStore.getState().setSettings(settings);
  useLabelStore.getState().setLabels(labels);

  const agentId = getCurrentAgentId();
  const inboxIds = inboxes.map((inbox) => inbox.id);
  const inboxFilterId = agentId ? resolveInboxFilter(agentId, inboxIds) : inboxIds[0] ?? null;

  if (agentId) {
    saveInboxFilter(agentId, inboxFilterId);
  }

  const { filterStatus, filterAssignee } = useConversationStore.getState();
  useConversationStore.setState({
    filterInboxId: inboxFilterId,
    filterLabelId: null,
  });

  const conversations = await conversationApiService.list({
    inboxId: inboxFilterId,
    status: filterStatus,
    assignee: filterAssignee,
  });

  useConversationStore.getState().setConversations(conversations);
  useConversationStore.getState().setAppDataBootstrapped(true);
}

export async function refreshConversationsFromApi(options?: { broad?: boolean }): Promise<void> {
  if (env.useMock) return;
  const { filterStatus, filterAssignee, filterInboxId, filterLabelId } =
    useConversationStore.getState();

  const conversations = await conversationApiService.list({
    inboxId: filterInboxId,
    status: options?.broad ? "all" : filterStatus,
    assignee: options?.broad ? "all" : filterAssignee,
    labelId: options?.broad ? null : filterLabelId,
  });

  useConversationStore.getState().setConversations(conversations);
}
