import type { AgentPermissions, AgentRole } from "@/types";

export const PERMISSION_GROUPS: {
  title: string;
  items: { key: keyof AgentPermissions; label: string; description: string }[];
}[] = [
  {
    title: "Configuración",
    items: [
      {
        key: "manageInboxes",
        label: "Gestionar bandejas",
        description: "Crear, editar y desactivar bandejas",
      },
      {
        key: "manageAgents",
        label: "Gestionar agentes",
        description: "Invitar y editar miembros del equipo",
      },
      {
        key: "manageIntegrations",
        label: "Gestionar integraciones",
        description: "Conectar proveedores y webhooks",
      },
    ],
  },
  {
    title: "Conversaciones",
    items: [
      {
        key: "sendMessages",
        label: "Enviar mensajes",
        description: "Responder y escribir a contactos",
      },
      {
        key: "assignConversations",
        label: "Asignar conversaciones",
        description: "Reasignar chats entre agentes",
      },
      {
        key: "resolveConversations",
        label: "Resolver conversaciones",
        description: "Marcar chats como resueltos o abiertos",
      },
      {
        key: "deleteConversations",
        label: "Eliminar conversaciones",
        description: "Borrar conversaciones de forma permanente",
      },
      {
        key: "manageLabels",
        label: "Gestionar etiquetas",
        description: "Crear y eliminar etiquetas de bandeja",
      },
      {
        key: "manageCannedResponses",
        label: "Respuestas predefinidas",
        description: "Crear y editar respuestas rápidas",
      },
    ],
  },
  {
    title: "Informes",
    items: [
      {
        key: "viewReports",
        label: "Ver informes",
        description: "Acceder a métricas y reportes",
      },
    ],
  },
];

export function getDefaultPermissions(role: AgentRole): AgentPermissions {
  if (role === "admin") {
    return {
      manageInboxes: true,
      manageAgents: true,
      manageIntegrations: true,
      viewReports: true,
      assignConversations: true,
      resolveConversations: true,
      deleteConversations: true,
      sendMessages: true,
      manageLabels: true,
      manageCannedResponses: true,
    };
  }

  return {
    manageInboxes: false,
    manageAgents: false,
    manageIntegrations: false,
    viewReports: false,
    assignConversations: true,
    resolveConversations: true,
    deleteConversations: false,
    sendMessages: true,
    manageLabels: true,
    manageCannedResponses: true,
  };
}

export function getRoleLabel(role: AgentRole) {
  return role === "admin" ? "Administrador" : "Agente";
}

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
