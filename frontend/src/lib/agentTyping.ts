export interface AgentTypingEntry {
  agentId: string;
  agentName: string;
}

export const EMPTY_AGENT_TYPERS: AgentTypingEntry[] = [];

export function formatAgentsTypingLabel(typers: AgentTypingEntry[]): string {
  const names = typers.map((item) => item.agentName.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} está escribiendo…`;
  if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más están escribiendo…`;
}
