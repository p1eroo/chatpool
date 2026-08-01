import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  MessagesSquare,
} from "lucide-react";
import type { ChannelType, IntegrationProvider } from "@/types";

export function getProviderForChannel(channel: ChannelType): IntegrationProvider {
  if (channel === "whatsapp" || channel === "facebook" || channel === "instagram") {
    return "meta";
  }
  if (channel === "email") {
    return "email";
  }
  return "website";
}

export interface ChannelWizardOption {
  value: ChannelType;
  label: string;
  description: string;
  icon: LucideIcon;
  detailLabel: string;
  detailPlaceholder: string;
}

export const channelWizardOptions: ChannelWizardOption[] = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    description: "WhatsApp Cloud con Meta",
    icon: MessageCircle,
    detailLabel: "Número de teléfono",
    detailPlaceholder: "+51 999 888 777",
  },
  {
    value: "email",
    label: "Correo electrónico",
    description: "Soporte por email",
    icon: Mail,
    detailLabel: "Dirección de correo",
    detailPlaceholder: "soporte@empresa.com",
  },
  {
    value: "facebook",
    label: "Messenger",
    description: "Facebook Messenger",
    icon: MessagesSquare,
    detailLabel: "Página de Facebook",
    detailPlaceholder: "Mi Empresa Oficial",
  },
  {
    value: "instagram",
    label: "Instagram",
    description: "Mensajes directos",
    icon: Camera,
    detailLabel: "Usuario de Instagram",
    detailPlaceholder: "@miempresa",
  },
  {
    value: "website",
    label: "Chat web",
    description: "Widget en tu sitio",
    icon: Globe,
    detailLabel: "Dominio o widget",
    detailPlaceholder: "app.miempresa.com",
  },
];

export function getChannelOption(channel: ChannelType) {
  return channelWizardOptions.find((option) => option.value === channel) ?? channelWizardOptions[0];
}

/** @deprecated use channelWizardOptions */
export const channelOptions = channelWizardOptions.map(({ value, label, detailLabel, detailPlaceholder }) => ({
  value,
  label,
  detailLabel,
  detailPlaceholder,
}));

export const wizardSteps = [
  {
    id: 1,
    title: "Elegir canal",
    description: "Elige el proveedor que quieres integrar",
  },
  {
    id: 2,
    title: "Crear bandeja de entrada",
    description: "Autentica y configura el canal",
  },
  {
    id: 3,
    title: "Añadir agentes",
    description: "Agentes con acceso a esta bandeja",
  },
  {
    id: 4,
    title: "Voilà!",
    description: "Todo listo para empezar",
  },
];
