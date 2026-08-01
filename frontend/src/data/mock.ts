import type {
  Agent,
  Inbox,
  Conversation,
  Message,
  Label,
  Contact,
  InboxSettings,
  IntegrationAccount,
} from "@/types";

export const agents: Agent[] = [
  {
    id: "agent-1",
    name: "Soporte",
    username: "soporte",
    password: "37>MNa&-39",
    avatar: "SP",
    status: "online",
    roleId: "role-admin",
  },
  {
    id: "agent-2",
    name: "Ana Torres",
    username: "ana.torres",
    password: "Chatpool123",
    phone: "+51 923 456 789",
    avatar: "AT",
    status: "away",
    roleId: "role-agent",
  },
  {
    id: "agent-3",
    name: "Luis García",
    username: "luis.garcia",
    password: "Chatpool123",
    phone: "+51 912 345 678",
    avatar: "LG",
    status: "offline",
    roleId: "role-agent",
  },
];

const currentUser: Agent = agents[0];

export const labels: Label[] = [
  { id: "label-1", name: "soporte", color: "purple", inboxId: "inbox-1" },
  { id: "label-2", name: "urgente", color: "red", inboxId: "inbox-1" },
  { id: "label-4", name: "envío", color: "orange", inboxId: "inbox-1" },
  { id: "label-5", name: "consulta", color: "green", inboxId: "inbox-1" },
  { id: "label-6", name: "reclamo", color: "yellow", inboxId: "inbox-1" },
  { id: "label-3", name: "facturación", color: "blue", inboxId: "inbox-2" },
  { id: "label-7", name: "consulta", color: "green", inboxId: "inbox-2" },
  { id: "label-8", name: "consulta", color: "green", inboxId: "inbox-3" },
  { id: "label-9", name: "reclamo", color: "yellow", inboxId: "inbox-3" },
  { id: "label-10", name: "soporte", color: "purple", inboxId: "inbox-4" },
  { id: "label-11", name: "consulta", color: "green", inboxId: "inbox-4" },
  { id: "label-12", name: "consulta", color: "green", inboxId: "inbox-5" },
];

export function getLabelsForInbox(inboxId: string): Label[] {
  return labels.filter((label) => label.inboxId === inboxId);
}

export const inboxes: Inbox[] = [
  { id: "inbox-1", name: "WhatsApp Support", channelType: "whatsapp", unreadCount: 5, icon: "whatsapp" },
  { id: "inbox-2", name: "Correo Electrónico", channelType: "email", unreadCount: 3, icon: "email" },
  { id: "inbox-3", name: "Facebook Messenger", channelType: "facebook", unreadCount: 2, icon: "facebook" },
  { id: "inbox-4", name: "Chat Web", channelType: "website", unreadCount: 1, icon: "website" },
  { id: "inbox-5", name: "Instagram DM", channelType: "instagram", unreadCount: 1, icon: "instagram" },
];

export const inboxSettings: InboxSettings[] = [
  {
    inboxId: "inbox-1",
    detail: "+51 987 654 321",
    status: "active",
    provider: "meta",
    providerResource: "PoolTech Support",
    webhookUrl: "https://api.chatpool.app/webhooks/meta/inbox-1",
    assignedAgentIds: ["agent-1", "agent-2"],
    description: "Soporte general por WhatsApp",
  },
  {
    inboxId: "inbox-2",
    detail: "soporte@chatpool.com",
    status: "active",
    provider: "email",
    providerResource: "SMTP Chatpool",
    assignedAgentIds: ["agent-1", "agent-3"],
    description: "Consultas y facturación por correo",
  },
  {
    inboxId: "inbox-3",
    detail: "PoolTech Oficial",
    status: "active",
    provider: "meta",
    providerResource: "PoolTech Oficial",
    webhookUrl: "https://api.chatpool.app/webhooks/meta/inbox-3",
    assignedAgentIds: ["agent-2"],
    description: "Mensajes de Facebook Messenger",
  },
  {
    inboxId: "inbox-4",
    detail: "app.chatpool.com",
    status: "active",
    provider: "website",
    providerResource: "Widget embebido",
    assignedAgentIds: ["agent-1", "agent-2", "agent-3"],
    description: "Chat en vivo del sitio web",
  },
  {
    inboxId: "inbox-5",
    detail: "@pooltech_oficial",
    status: "pending",
    provider: "meta",
    providerResource: "@pooltech_oficial",
    webhookUrl: "https://api.chatpool.app/webhooks/meta/inbox-5",
    assignedAgentIds: ["agent-2"],
    description: "Mensajes directos de Instagram",
  },
];

export const integrationAccounts: IntegrationAccount[] = [
  {
    id: "integration-meta",
    name: "Meta API",
    provider: "meta",
    description: "WhatsApp, Facebook e Instagram",
    connected: true,
    webhookUrl: "https://api.chatpool.app/webhooks/meta",
  },
  {
    id: "integration-email",
    name: "Correo SMTP",
    provider: "email",
    description: "Bandejas de correo electrónico",
    connected: true,
  },
  {
    id: "integration-website",
    name: "Chat Web",
    provider: "website",
    description: "Widget en sitio propio",
    connected: true,
  },
];

export function getInboxSettings(inboxId: string): InboxSettings | undefined {
  return inboxSettings.find((settings) => settings.inboxId === inboxId);
}

export function getInboxesForProvider(provider: IntegrationProvider): InboxSettings[] {
  return inboxSettings.filter((settings) => settings.provider === provider);
}

export function getInboxById(inboxId: string): Inbox | undefined {
  return inboxes.find((inbox) => inbox.id === inboxId);
}

function makeMessages(conversationId: string): Message[] {
  const now = Date.now();
  return [
    {
      id: `msg-${conversationId}-1`,
      conversationId,
      content: "Hola, tengo un problema con el pedido #4521 que hice la semana pasada. No me ha llegado y ya pasó la fecha estimada de entrega.",
      senderType: "contact",
      senderId: "contact-1",
      senderName: "Maria Lopez",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(now - 3600000),
      status: "read",
    },
    {
      id: `msg-${conversationId}-2`,
      conversationId,
      content: "¡Hola Maria! Claro, déjame revisar tu pedido #4521 en el sistema. Dame un momento por favor.",
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(now - 3500000),
      status: "delivered",
    },
    {
      id: `msg-${conversationId}-3`,
      conversationId,
      content: "Revisar si el pedido #4521 fue despachado por el almacén Norte. El cliente reporta que no ha llegado. Posible retraso con el transportista.",
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
      isPrivate: true,
      contentType: "text",
      createdAt: new Date(now - 3400000),
    },
    {
      id: `msg-${conversationId}-4`,
      conversationId,
      content: "Gracias, espero tu respuesta.",
      senderType: "contact",
      senderId: "contact-1",
      senderName: "Maria Lopez",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(now - 3000000),
      status: "read",
    },
  ];
}

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    inboxId: "inbox-1",
    contact: { id: "contact-1", inboxId: "inbox-1", name: "Maria Lopez", email: "maria@email.com", phone: "+51 987 654 321", avatar: "ML", lastSeen: new Date(Date.now() - 120000) },
    assignee: agents[0],
    lastMessage: null,
    unreadCount: 2,
    status: "open",
    priority: "high",
    labels: [labels[0], labels[1]],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 120000),
    isTyping: false,
    channelType: "whatsapp",
  },
  {
    id: "conv-2",
    inboxId: "inbox-2",
    contact: { id: "contact-2", inboxId: "inbox-2", name: "Carlos Ruiz", email: "carlosr@email.com", phone: "+51 912 345 678", avatar: "CR", lastSeen: new Date(Date.now() - 3600000) },
    assignee: undefined,
    lastMessage: null,
    unreadCount: 0,
    status: "open",
    priority: "medium",
    labels: [labels[5], labels[6]],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 3600000),
    isTyping: false,
    channelType: "email",
  },
  {
    id: "conv-3",
    inboxId: "inbox-3",
    contact: { id: "contact-3", inboxId: "inbox-3", name: "Juan Pérez", email: "juan@email.com", avatar: "JP" },
    assignee: agents[1],
    lastMessage: null,
    unreadCount: 0,
    status: "open",
    priority: "low",
    labels: [labels[7]],
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 10800000),
    isTyping: false,
    channelType: "facebook",
  },
  {
    id: "conv-4",
    inboxId: "inbox-1",
    contact: { id: "contact-4", inboxId: "inbox-1", name: "Ana Torres", email: "anat@email.com", phone: "+51 923 456 789", avatar: "AT" },
    assignee: agents[0],
    lastMessage: null,
    unreadCount: 0,
    status: "open",
    priority: "urgent",
    labels: [labels[1], labels[2]],
    createdAt: new Date(Date.now() - 43200000),
    updatedAt: new Date(Date.now() - 18000000),
    isTyping: false,
    channelType: "whatsapp",
  },
  {
    id: "conv-5",
    inboxId: "inbox-4",
    contact: { id: "contact-5", inboxId: "inbox-4", name: "Diana Castillo", email: "diana@email.com", avatar: "DC" },
    assignee: undefined,
    lastMessage: null,
    unreadCount: 1,
    status: "open",
    priority: "medium",
    labels: [labels[9], labels[10]],
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 600000),
    isTyping: true,
    channelType: "website",
  },
  {
    id: "conv-6",
    inboxId: "inbox-2",
    contact: { id: "contact-6", inboxId: "inbox-2", name: "Pedro Sánchez", email: "pedro@email.com", avatar: "PS" },
    assignee: agents[2],
    lastMessage: null,
    unreadCount: 0,
    status: "resolved",
    priority: "none",
    labels: [labels[5]],
    createdAt: new Date(Date.now() - 345600000),
    updatedAt: new Date(Date.now() - 86400000),
    isTyping: false,
    channelType: "email",
  },
  {
    id: "conv-7",
    inboxId: "inbox-5",
    contact: { id: "contact-7", inboxId: "inbox-5", name: "Sofia Martínez", email: "sofia@email.com", avatar: "SM" },
    assignee: agents[1],
    lastMessage: null,
    unreadCount: 0,
    status: "open",
    priority: "low",
    labels: [labels[11]],
    createdAt: new Date(Date.now() - 518400000),
    updatedAt: new Date(Date.now() - 172800000),
    isTyping: false,
    channelType: "instagram",
  },
  {
    id: "conv-8",
    inboxId: "inbox-1",
    contact: { id: "contact-8", inboxId: "inbox-1", name: "Roberto Díaz", email: "roberto@email.com", phone: "+51 998 112 3344", avatar: "RD" },
    assignee: undefined,
    lastMessage: null,
    unreadCount: 3,
    status: "open",
    priority: "high",
    labels: [labels[1]],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 300000),
    isTyping: false,
    channelType: "whatsapp",
  },
];

conversations.forEach((conv) => {
  conv.lastMessage = makeMessages(conv.id).at(-1) || null;
});

export function getMessages(_conversationId: string): Message[] {
  return [
    {
      id: "msg-1",
      conversationId: "conv-1",
      content: "Hola, tengo un problema con el pedido #4521 que hice la semana pasada. No me ha llegado y ya pasó la fecha estimada de entrega.",
      senderType: "contact",
      senderId: "contact-1",
      senderName: "Maria Lopez",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(Date.now() - 3600000),
      status: "read",
    },
    {
      id: "msg-2",
      conversationId: "conv-1",
      content: "¡Hola Maria! Claro, déjame revisar tu pedido #4521 en el sistema. Dame un momento por favor.",
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(Date.now() - 3500000),
      status: "delivered",
    },
    {
      id: "msg-3",
      conversationId: "conv-1",
      content: "Revisar si el pedido #4521 fue despachado por el almacén Norte. El cliente reporta que no ha llegado.",
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
      isPrivate: true,
      contentType: "text",
      createdAt: new Date(Date.now() - 3400000),
      status: "sent",
    },
    {
      id: "msg-4",
      conversationId: "conv-1",
      content: "Gracias, espero tu respuesta.",
      senderType: "contact",
      senderId: "contact-1",
      senderName: "Maria Lopez",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(Date.now() - 3000000),
      status: "read",
    },
    {
      id: "msg-5",
      conversationId: "conv-1",
      content: "Maria, ya encontré tu pedido. Salió del almacén el lunes pero el transportista tuvo un retraso. Llega mañana antes del mediodía. Te pido disculpas por el inconveniente.",
      senderType: "agent",
      senderId: "agent-1",
      senderName: "Carlos Mendoza",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(Date.now() - 2800000),
      status: "delivered",
    },
    {
      id: "msg-6",
      conversationId: "conv-1",
      content: "¡Muchas gracias por la rápida gestión! Muy amable.",
      senderType: "contact",
      senderId: "contact-1",
      senderName: "Maria Lopez",
      isPrivate: false,
      contentType: "text",
      createdAt: new Date(Date.now() - 120000),
      status: "read",
    },
  ];
}

export { currentUser, agents as allAgents };

export interface ContactMediaItem {
  id: string;
  url: string;
}

export interface ContactFileItem {
  id: string;
  name: string;
  size: string;
}

import type { CannedResponse } from "@/types";

export type { CannedResponse };

export interface WhatsAppTemplate {
  id: string;
  name: string;
  preview: string;
}

export const cannedResponses: CannedResponse[] = [
  {
    id: "cr-1",
    title: "Saludo",
    content: "¡Hola! Gracias por escribirnos. ¿En qué puedo ayudarte hoy?",
  },
  {
    id: "cr-2",
    title: "Espera",
    content: "Un momento por favor, estoy revisando tu solicitud.",
  },
  {
    id: "cr-3",
    title: "Pedido",
    content: "Ya revisé tu pedido en el sistema. Te comparto el estado en breve.",
  },
  {
    id: "cr-4",
    title: "Despedida",
    content: "Gracias por contactarnos. Quedamos atentos si necesitas algo más.",
  },
];

export const whatsappTemplates: WhatsAppTemplate[] = [
  {
    id: "hello_world",
    name: "hello_world",
    preview:
      "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.",
  },
  {
    id: "order_update",
    name: "order_update",
    preview: "Hola {{1}}, tu pedido #{{2}} ha sido actualizado. Estado actual: {{3}}.",
  },
  {
    id: "appointment_reminder",
    name: "appointment_reminder",
    preview: "Hola {{1}}, te recordamos tu cita programada para el {{2}} a las {{3}}.",
  },
  {
    id: "demo_fail",
    name: "demo_fail (simula error Meta)",
    preview: "Plantilla de prueba que simula un rechazo de Meta al enviar.",
  },
];

export function getContactPhotoUrl(contactId: string): string {
  return `https://picsum.photos/seed/chatpool-${contactId}/640/360`;
}

export function getContactMedia(contactId: string): ContactMediaItem[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `${contactId}-media-${index}`,
    url: `https://picsum.photos/seed/${contactId}-media-${index}/320/320`,
  }));
}

export function getContactFiles(_contactId: string): ContactFileItem[] {
  return [
    { id: "file-1", name: "design-phase-1-approved.pdf", size: "12.5 MB" },
    { id: "file-2", name: "Image-1.jpg", size: "2.3 MB" },
    { id: "file-3", name: "cotizacion-final.pdf", size: "856 KB" },
  ];
}

export const allContacts: Contact[] = [
  { id: "contact-1", inboxId: "inbox-1", name: "Maria Lopez", email: "maria@email.com", phone: "+51 987 654 321", avatar: "ML" },
  { id: "contact-2", inboxId: "inbox-2", name: "Carlos Ruiz", email: "carlosr@email.com", phone: "+51 912 345 678", avatar: "CR" },
  { id: "contact-3", inboxId: "inbox-3", name: "Juan Pérez", email: "juan@email.com", avatar: "JP" },
  { id: "contact-4", inboxId: "inbox-1", name: "Ana Torres", email: "anat@email.com", phone: "+51 923 456 789", avatar: "AT" },
  { id: "contact-5", inboxId: "inbox-4", name: "Diana Castillo", email: "diana@email.com", avatar: "DC" },
  { id: "contact-6", inboxId: "inbox-2", name: "Pedro Sánchez", email: "pedro@email.com", avatar: "PS" },
  { id: "contact-7", inboxId: "inbox-5", name: "Sofia Martínez", email: "sofia@email.com", avatar: "SM" },
  { id: "contact-8", inboxId: "inbox-1", name: "Roberto Díaz", email: "roberto@email.com", phone: "+51 998 112 3344", avatar: "RD" },
  { id: "contact-9", inboxId: "inbox-1", name: "Alejandro Vargas", email: "alejandro@email.com", avatar: "AV" },
  { id: "contact-10", inboxId: "inbox-2", name: "Beatriz Flores", email: "beatriz@email.com", avatar: "BF" },
  { id: "contact-11", inboxId: "inbox-3", name: "Camila Rojas", email: "camila@email.com", avatar: "CR" },
  { id: "contact-12", inboxId: "inbox-1", name: "Diego Navarro", email: "diego@email.com", phone: "+51 956 789 012", avatar: "DN" },
  { id: "contact-13", inboxId: "inbox-2", name: "Elena Vásquez", email: "elena@email.com", avatar: "EV" },
  { id: "contact-14", inboxId: "inbox-3", name: "Fernando López", email: "fernando@email.com", avatar: "FL" },
  { id: "contact-15", inboxId: "inbox-4", name: "Gabriela Mejía", email: "gabriela@email.com", phone: "+51 934 567 890", avatar: "GM" },
  { id: "contact-16", inboxId: "inbox-2", name: "Héctor Silva", email: "hector@email.com", avatar: "HS" },
  { id: "contact-17", inboxId: "inbox-3", name: "Isabel González", email: "isabel@email.com", avatar: "IG" },
  { id: "contact-18", inboxId: "inbox-4", name: "Jorge Castro", email: "jorge@email.com", avatar: "JC" },
  { id: "contact-19", inboxId: "inbox-5", name: "Karla Paredes", email: "karla@email.com", avatar: "KP" },
  { id: "contact-20", inboxId: "inbox-5", name: "Lucía Fernández", email: "lucia@email.com", avatar: "LF" },
  { id: "contact-21", inboxId: "inbox-1", name: "Manuel Ortega", email: "manuel@email.com", phone: "+51 945 678 901", avatar: "MO" },
  { id: "contact-22", inboxId: "inbox-2", name: "Natalia Herrera", email: "natalia@email.com", avatar: "NH" },
  { id: "contact-23", inboxId: "inbox-3", name: "Óscar Delgado", email: "oscar@email.com", avatar: "OD" },
  { id: "contact-24", inboxId: "inbox-4", name: "Patricia Molina", email: "patricia@email.com", avatar: "PM" },
  { id: "contact-25", inboxId: "inbox-5", name: "Ricardo Peña", email: "ricardo@email.com", avatar: "RP" },
  { id: "contact-26", inboxId: "inbox-1", name: "Susana Ríos", email: "susana@email.com", phone: "+51 944 555 666", avatar: "SR" },
  { id: "contact-27", inboxId: "inbox-2", name: "Tomás Guerrero", email: "tomas@email.com", avatar: "TG" },
  { id: "contact-28", inboxId: "inbox-3", name: "Valentina Cruz", email: "valentina@email.com", avatar: "VC" },
  { id: "contact-29", inboxId: "inbox-4", name: "Walter Jiménez", email: "walter@email.com", avatar: "WJ" },
  { id: "contact-30", inboxId: "inbox-5", name: "Ximena Aguilar", email: "ximena@email.com", avatar: "XA" },
];

export function getContactsForInbox(inboxId: string | null): Contact[] {
  if (!inboxId) return allContacts;
  return allContacts.filter((contact) => contact.inboxId === inboxId);
}
