import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConversationStore } from "@/store/conversationStore";
import { useInboxStore } from "@/store/inboxStore";
import { allContacts } from "@/data/mock";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatTime } from "@/lib/utils";
import {
  Search,
  MessageCircle,
  History,
  Camera,
  MessageCircleMore,
  Globe,
  Mail,
  User,
  Activity,
  Tag,
  ChevronDown,
  Ban,
  Send,
} from "lucide-react";
import type { Contact, Conversation, Inbox } from "@/types";

const messageTemplates = [
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
];

function groupByLetter(contacts: Contact[]) {
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const groups: { letter: string; contacts: Contact[] }[] = [];
  for (const c of sorted) {
    const letter = c.name.charAt(0).toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) {
      last.contacts.push(c);
    } else {
      groups.push({ letter, contacts: [c] });
    }
  }
  return groups;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function formatPhoneDisplay(phone?: string) {
  if (!phone) return "Sin teléfono";
  return phone;
}

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  facebook: MessageCircleMore,
  instagram: Camera,
  website: Globe,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-emerald-400",
  email: "text-blue-400",
  facebook: "text-blue-500",
  instagram: "text-pink-400",
  website: "text-violet-400",
};

const inboxChannelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
  facebook: "Facebook",
  instagram: "Instagram",
  website: "Web",
};

const CONTACT_LIST_WIDTH = 340;

type SidePanelTab = "history" | "compose";

export function ContactsPage() {
  const navigate = useNavigate();
  const conversations = useConversationStore((s) => s.conversations);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const createConversation = useConversationStore((s) => s.createConversation);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const inboxes = useInboxStore((s) => s.inboxes);

  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("history");

  const contactGroups = useMemo(() => {
    let contacts = allContacts;
    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return groupByLetter(contacts);
  }, [search]);

  const selectedContact = allContacts.find((c) => c.id === selectedContactId) || null;

  const contactConversations = useMemo(() => {
    if (!selectedContact) return [];
    return conversations
      .filter((c) => c.contact.id === selectedContact.id)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [selectedContact, conversations]);

  useEffect(() => {
    setSidePanelTab("history");
  }, [selectedContactId]);

  const handleOpenChat = (conversationId: string) => {
    setActiveConversation(conversationId);
    navigate("/inbox");
  };

  const handleSendMessage = (message: string, inbox: Inbox) => {
    if (!selectedContact || !message.trim()) return;

    const existing = contactConversations.find((c) => c.inboxId === inbox.id);
    if (existing) {
      sendMessage(existing.id, message.trim(), false);
      setActiveConversation(existing.id);
    } else {
      createConversation(
        selectedContact,
        inbox.id,
        inbox.channelType,
        message.trim()
      );
    }

    setSidePanelTab("history");
    navigate("/inbox");
  };

  return (
    <div
      className="flex-1 h-screen bg-[var(--color-bg-primary)] grid min-h-0"
      style={{
        gridTemplateColumns: `${CONTACT_LIST_WIDTH}px minmax(0, 1fr)`,
      }}
    >
      <div
        className="bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-primary)] flex flex-col shrink-0 min-h-0"
        style={{ width: CONTACT_LIST_WIDTH }}
      >
        <div className="p-4 pb-3">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            Contactos
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Buscar contactos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded-lg pl-9 pr-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contactGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Search className="w-12 h-12 text-[var(--color-text-muted)] mb-3 opacity-40" />
              <p className="text-[var(--color-text-secondary)] text-sm">Sin resultados</p>
            </div>
          ) : (
            contactGroups.map((group) => (
              <div key={group.letter}>
                <div className="px-4 py-1.5 bg-[var(--color-bg-tertiary)] sticky top-0 z-10">
                  <span className="text-xs font-bold text-[var(--color-brand)]">
                    {group.letter}
                  </span>
                </div>
                {group.contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`w-full text-left px-4 py-2.5 border-b border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 ${
                      selectedContactId === contact.id
                        ? "bg-[var(--color-brand-bg)] border-l-[3px] border-l-[var(--color-brand)]"
                        : "border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <Avatar name={contact.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {formatPhoneDisplay(contact.phone)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedContact ? (
        <div className="flex min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-y-auto flex justify-center">
            <ContactDetail contact={selectedContact} />
          </div>
          <ContactSidePanel
            contact={selectedContact}
            conversations={contactConversations}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
            onOpenChat={handleOpenChat}
            onSendMessage={handleSendMessage}
            inboxes={inboxes}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-[var(--color-text-primary)] font-semibold mb-1">
              Chatpool
            </h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Selecciona un contacto para ver sus detalles
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactDetail({ contact }: { contact: Contact }) {
  const { firstName, lastName } = splitName(contact.name);
  const [form, setForm] = useState({
    firstName,
    lastName,
    phone: contact.phone || "",
    city: "",
    company: "",
  });

  useEffect(() => {
    const split = splitName(contact.name);
    setForm({
      firstName: split.firstName,
      lastName: split.lastName,
      phone: contact.phone || "",
      city: "",
      company: "",
    });
  }, [contact.id, contact.name, contact.phone]);

  return (
    <div className="w-full max-w-[640px] px-6 py-6 animate-fade-in">
      <div className="mb-5">
        <p className="text-xs text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-secondary)]">Contactos</span>
          <span className="mx-1.5">›</span>
          <span className="text-[var(--color-text-primary)] font-medium">
            {contact.name}
          </span>
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col items-center text-center pb-2">
          <Avatar name={contact.name} size="xl" className="mb-3 rounded-xl" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {contact.name}
          </h2>
          {contact.phone && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {contact.phone.replace(/\s/g, "")}@s.whatsapp.net
            </p>
          )}
          <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            Creado hace 4 meses · Última actividad hace 3 horas
          </p>
          <button className="mt-3 text-xs px-3 py-1 rounded-full border border-dashed border-[var(--color-border-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors flex items-center gap-1">
            <Tag className="w-3 h-3" />
            etiqueta
          </button>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Editar detalles del contacto
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              placeholder="Ingrese el nombre"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            />
            <FormInput
              placeholder="Ingrese el apellido"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            />
            <div className="col-span-2 flex gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg px-2 shrink-0">
                <span className="text-sm">🇵🇪</span>
                <span className="text-xs text-[var(--color-text-secondary)]">+51</span>
                <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
              </div>
              <FormInput
                placeholder="Número de teléfono"
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                className="flex-1"
              />
            </div>
            <FormInput
              placeholder="Introduzca el nombre de la ciudad"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              className="col-span-2"
            />
            <FormInput
              placeholder="Escriba el nombre de la empresa"
              value={form.company}
              onChange={(v) => setForm((f) => ({ ...f, company: v }))}
              className="col-span-2"
            />
          </div>
        </section>

        <button className="h-9 px-4 text-sm font-medium rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] transition-colors">
          Actualizar contacto
        </button>

        <section className="pt-4 border-t border-[var(--color-border-primary)] space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              Eliminar contacto
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Eliminar permanentemente este contacto. Esta acción es irreversible.
            </p>
            <button className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors">
              Eliminar contacto
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              Bloquear contacto
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Impide que este contacto te escriba o reciba mensajes tuyos.
            </p>
            <button className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5">
              <Ban className="w-4 h-4" />
              Bloquear contacto
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SendMessageComposer({
  contact,
  inboxes,
  onClose,
  onSend,
}: {
  contact: Contact;
  inboxes: Inbox[];
  onClose: () => void;
  onSend: (message: string, inbox: Inbox) => void;
}) {
  const defaultInbox = inboxes.find((i) => i.channelType === "whatsapp") || inboxes[0];
  const [selectedInbox, setSelectedInbox] = useState<Inbox>(defaultInbox);
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const isTemplateLocked = selectedTemplateId !== null;
  const selectedTemplate = messageTemplates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedInbox.channelType !== "whatsapp") {
      setSelectedTemplateId(null);
    }
  }, [selectedInbox.channelType]);

  const filteredTemplates = messageTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.preview.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message, selectedInbox);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const ChannelIcon = channelIcons[selectedInbox.channelType] || Globe;

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 animate-fade-in">
      <div className="px-4 py-3 border-b border-[var(--color-border-primary)] space-y-2.5 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-text-muted)] shrink-0">Para :</span>
          <span className="inline-flex items-center gap-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg px-2.5 py-1 text-xs text-[var(--color-text-primary)]">
            {contact.name}
            {contact.phone && (
              <span className="text-[var(--color-text-muted)]">({contact.phone.replace(/\s/g, "")})</span>
            )}
          </span>
        </div>

        <div className="flex items-start gap-2 text-xs">
          <span className="text-[var(--color-text-muted)] shrink-0 pt-1">Vía :</span>
          <div className="flex-1 min-w-0 relative">
            <button
              onClick={() => setInboxOpen(!inboxOpen)}
              className="inline-flex items-center gap-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] hover:border-[var(--color-brand)] transition-colors"
            >
              <ChannelIcon className={cn("w-3.5 h-3.5", channelColors[selectedInbox.channelType])} />
              {selectedInbox.name}
              <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
            </button>
            {inboxOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg shadow-lg py-1">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                  Mostrar bandejas de entrada
                </p>
                {inboxes.map((inbox) => {
                  const Icon = channelIcons[inbox.channelType] || Globe;
                  return (
                    <button
                      key={inbox.id}
                      onClick={() => {
                        setSelectedInbox(inbox);
                        setInboxOpen(false);
                        if (inbox.channelType !== "whatsapp") {
                          setSelectedTemplateId(null);
                        }
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-[var(--color-bg-hover)] transition-colors",
                        selectedInbox.id === inbox.id && "bg-[var(--color-brand-bg)]"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", channelColors[inbox.channelType])} />
                      <span className="text-[var(--color-text-primary)]">{inbox.name}</span>
                      <span className="text-[var(--color-text-muted)] ml-auto">
                        {inboxChannelLabels[inbox.channelType]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {isTemplateLocked && selectedTemplate && (
        <div className="px-4 pt-3 pb-1 shrink-0">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {selectedTemplate.name}
          </span>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => {
          if (!isTemplateLocked) setMessage(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Escribir..."
        readOnly={isTemplateLocked}
        className={cn(
          "flex-1 min-h-[160px] w-full text-sm text-[var(--color-text-primary)] px-4 py-3 outline-none resize-none placeholder:text-[var(--color-text-muted)]",
          isTemplateLocked
            ? "bg-[var(--color-bg-tertiary)] cursor-default text-[var(--color-text-secondary)]"
            : "bg-transparent"
        )}
        autoFocus={!isTemplateLocked}
      />

      <div className="px-4 py-3 border-t border-[var(--color-border-primary)] flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {selectedInbox.channelType === "whatsapp" && (
            <div className="relative">
              <button
                onClick={() => setTemplateOpen(!templateOpen)}
                className="h-8 px-2.5 text-xs rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                Seleccionar plantilla
              </button>
              {templateOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-20 w-[300px] max-w-[calc(100vw-120px)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-[var(--color-border-primary)]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                      <input
                        type="text"
                        placeholder="Buscar plantillas"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-primary)] rounded-lg pl-8 pr-3 py-2 outline-none border border-transparent focus:border-[var(--color-brand)]"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setMessage(template.preview);
                          setTemplateOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg-hover)] transition-colors border-b border-[var(--color-border-primary)] last:border-0"
                      >
                        <p className="text-xs font-medium text-[var(--color-text-primary)]">
                          {template.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-3 mt-0.5 leading-relaxed">
                          {template.preview}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => {
              setMessage("");
              setSelectedTemplateId(null);
              onClose();
            }}
            className="h-8 px-3 text-xs font-medium rounded-lg border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className={cn(
              "h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5",
              message.trim()
                ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            Enviar
            <span className="text-[10px] opacity-70">(⌘ + ↵)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FormInput({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]",
        className
      )}
    />
  );
}

function ContactSidePanel({
  contact,
  conversations,
  activeTab,
  onTabChange,
  onOpenChat,
  onSendMessage,
  inboxes,
}: {
  contact: Contact;
  conversations: Conversation[];
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onOpenChat: (id: string) => void;
  onSendMessage: (message: string, inbox: Inbox) => void;
  inboxes: Inbox[];
}) {
  return (
    <aside className="w-[clamp(280px,30vw,480px)] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] flex flex-col shrink-0 min-h-0 animate-slide-in-right">
      <div className="flex border-b border-[var(--color-border-primary)] shrink-0">
        <button
          onClick={() => onTabChange("history")}
          className={cn(
            "flex-1 px-4 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
            activeTab === "history"
              ? "text-[var(--color-brand)] border-[var(--color-brand)]"
              : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]"
          )}
        >
          <History className="w-3.5 h-3.5" />
          Historial
        </button>
        <button
          onClick={() => onTabChange("compose")}
          className={cn(
            "flex-1 px-4 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
            activeTab === "compose"
              ? "text-[var(--color-brand)] border-[var(--color-brand)]"
              : "text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]"
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Nuevo mensaje
        </button>
      </div>

      {activeTab === "compose" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <SendMessageComposer
            contact={contact}
            inboxes={inboxes}
            onClose={() => onTabChange("history")}
            onSend={onSendMessage}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-[var(--color-text-muted)] opacity-50" />
              </div>
              <p className="text-sm text-[var(--color-text-primary)] font-semibold mb-1">
                Sin conversaciones
              </p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {contact.name} aún no tiene historial de chat. Usa la pestaña{" "}
                <span className="text-[var(--color-text-secondary)] font-medium">Nuevo mensaje</span>{" "}
                para escribirle.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <HistoryItem
                key={conv.id}
                conversation={conv}
                contact={contact}
                onClick={() => onOpenChat(conv.id)}
              />
            ))
          )}
        </div>
      )}
    </aside>
  );
}

function HistoryItem({
  conversation,
  contact,
  onClick,
}: {
  conversation: Conversation;
  contact: Contact;
  onClick: () => void;
}) {
  const ChannelIcon = channelIcons[conversation.channelType] || Globe;
  const channelColor = channelColors[conversation.channelType] || "text-gray-400";
  const preview = conversation.lastMessage?.content?.slice(0, 80) || "Sin mensajes";
  const time = conversation.lastMessage
    ? formatTime(conversation.lastMessage.createdAt)
    : formatTime(conversation.updatedAt);

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)] transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar name={contact.name} size="md" />
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)]",
              channelColor
            )}
          >
            <ChannelIcon className="w-2.5 h-2.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {contact.name}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 ml-2">
              {time}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {preview}
          </p>
        </div>
      </div>
    </button>
  );
}
