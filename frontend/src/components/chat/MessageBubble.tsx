import { useEffect, useRef, useState } from "react";
import { cn, formatMessageTime } from "@/lib/utils";
import { WhatsAppFormattedText } from "@/lib/whatsappFormatting";
import { isUrlOnlyMessage } from "@/lib/detectUrls";
import { useMessageLinkPreview } from "@/hooks/useLinkPreview";
import { LinkPreviewCard } from "./LinkPreviewCard";
import type { Message, MessageReply } from "@/types";
import { useUIStore } from "@/store/uiStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  isOutboundMessage,
  messageSenderDisplayName,
} from "@/lib/messageSenderGroup";
import { Check, CheckCheck, Clock, MapPin, Mic, MoreVertical, Pause, Play, UserRound } from "lucide-react";
import { FileAttachmentCard } from "./FileAttachmentCard";
import {
  displayInboundMessageContent,
  isSharedContactMessageContent,
  parseSharedContactDisplay,
} from "@/lib/whatsappContactInfo";
import { WAVEFORM_BAR_COUNT, formatVoiceTime } from "@/hooks/useVoiceRecorder";

interface MessageBubbleProps {
  message: Message;
  isLastInGroup: boolean;
  contactName?: string;
  isHighlighted?: boolean;
  attachedToMessage?: Message;
  hasAttachedNotesAbove?: boolean;
  isMenuOpen?: boolean;
  isForwardSelectable?: boolean;
  isForwardSelected?: boolean;
  onForwardToggle?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onMenuOpen?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function MessageBubble({
  message,
  isLastInGroup,
  contactName,
  isHighlighted,
  attachedToMessage,
  hasAttachedNotesAbove,
  isMenuOpen,
  isForwardSelectable,
  isForwardSelected,
  onForwardToggle,
  onContextMenu,
  onMenuOpen,
}: MessageBubbleProps) {
  if (message.senderType === "system") {
    return (
      <div
        data-message-id={message.id}
        className="flex justify-center my-3 px-4"
      >
        <span className="max-w-[min(100%,28rem)] text-center text-[12px] leading-snug font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] px-3.5 py-1.5 rounded-full shadow-sm">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = isOutboundMessage(message);
  const isBot = message.senderType === "bot";
  const isPrivate = message.isPrivate;
  const isAttachedNote = isPrivate && !!message.attachedToMessageId;
  const noteAlignEnd =
    attachedToMessage?.senderType === "agent" ||
    attachedToMessage?.senderType === "bot";
  const showSenderAvatar = isLastInGroup && !isPrivate;
  const senderLabel = messageSenderDisplayName(message, contactName);

  if (isPrivate) {
    return (
      <div
        className={cn(
          "group flex px-4 animate-fade-in",
          noteAlignEnd ? "justify-end" : "justify-start",
          isAttachedNote ? "mb-0.5" : isLastInGroup ? "mb-3" : "mb-0.5"
        )}
      >
        <div
          className={cn(
            "flex items-start gap-1 max-w-[80%]",
            noteAlignEnd ? "flex-row" : "flex-row-reverse"
          )}
        >
          <MessageMenuButton
            isMenuOpen={isMenuOpen}
            onOpen={onMenuOpen}
          />
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu?.(e);
            }}
            className={cn(
              "bg-[var(--color-note-bg)] border-l-[3px] border-amber-500/60 rounded-lg px-3 py-2",
              isAttachedNote ? "max-w-[75%]" : "flex-1 min-w-0"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                Nota privada
              </span>
              <span className="text-[10px] text-amber-400/50 ml-auto">
                {formatMessageTime(message.createdAt)}
              </span>
            </div>
            <WhatsAppFormattedText
              text={message.content}
              linkClassName={incomingLinkClassName}
              className="text-[13px] text-[var(--color-text-primary)] leading-relaxed"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group flex px-4 animate-fade-in gap-3",
        isForwardSelectable
          ? "justify-start"
          : isAgent
            ? "justify-end"
            : "justify-start",
        hasAttachedNotesAbove ? "mb-0.5" : isLastInGroup ? "mb-3" : "mb-0.5",
        isHighlighted && "animate-message-highlight -mx-1 px-5",
        isForwardSelectable && "cursor-pointer",
        isForwardSelected && "bg-[var(--color-brand)]/5"
      )}
      onClick={
        isForwardSelectable && onForwardToggle
          ? (event) => {
              if ((event.target as HTMLElement).closest("button, a, audio, input")) return;
              onForwardToggle();
            }
          : undefined
      }
    >
      {isForwardSelectable && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onForwardToggle?.();
          }}
          className={cn(
            "mt-2 flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-full border transition-colors",
            isForwardSelected
              ? "border-[var(--control-selected-fg)] bg-[var(--control-selected-bg)] text-[var(--control-selected-fg)]"
              : "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]"
          )}
          aria-label={isForwardSelected ? "Quitar selección" : "Seleccionar mensaje"}
        >
          {isForwardSelected ? <Check className="h-3 w-3" /> : null}
        </button>
      )}
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] items-end gap-1.5",
          isForwardSelectable && isAgent && "ml-auto",
          !isForwardSelectable && isAgent && "ml-auto flex-row-reverse"
        )}
      >
        {showSenderAvatar ? (
          <Avatar
            name={senderLabel}
            size="xs"
            className="mb-0.5 shrink-0 shadow-sm ring-1 ring-black/5"
          />
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}
        <div className={cn("min-w-0 max-w-full", isLastInGroup ? "mb-0" : "")}>
        <div
          className={cn(
            "flex items-center gap-1",
            isAgent ? "flex-row" : "flex-row-reverse"
          )}
        >
          <MessageMenuButton
            isMenuOpen={isMenuOpen}
            onOpen={isForwardSelectable ? undefined : onMenuOpen}
          />
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu?.(e);
            }}
            className={cn(
              "text-sm leading-relaxed min-w-0",
              message.contentType === "sticker"
                ? "p-0 bg-transparent"
                : message.contentType === "file"
                  ? "p-1"
                  : message.contentType === "image" || message.contentType === "location"
                    ? "p-1.5"
                    : "px-3.5 py-2.5",
              message.contentType !== "sticker" &&
                (isBot
                  ? "bg-[var(--color-bubble-bot)] text-white rounded-2xl rounded-br-md"
                  : isAgent
                    ? "bg-[var(--color-bubble-out)] text-white rounded-2xl rounded-br-md"
                    : "bg-[var(--color-bubble-in)] text-[var(--color-text-primary)] rounded-2xl rounded-bl-md")
            )}
          >
            {message.replyTo && (
              <QuotedReply
                reply={message.replyTo}
                isAgent={isAgent}
                contactName={contactName}
              />
            )}
            <MessageContent message={message} isAgent={isAgent} />
          </div>
        </div>
        {isLastInGroup && (
          <div
            className={cn(
              "flex flex-col gap-0.5 mt-1",
              isAgent ? "items-end" : "items-start"
            )}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {formatMessageTime(message.createdAt)}
              </span>
              {isAgent && message.status && (
                <MessageStatus
                  status={message.status}
                  errorMessage={message.errorMessage}
                />
              )}
            </div>
            {isAgent && message.status === "failed" && message.errorMessage && (
              <p className="max-w-[260px] text-[10px] leading-snug text-red-400 text-right">
                {message.errorMessage}
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function MessageMenuButton({
  isMenuOpen,
  onOpen,
}: {
  isMenuOpen?: boolean;
  onOpen?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (!onOpen) return null;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(e);
      }}
      className={cn(
        "w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-all",
        "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        isMenuOpen && "opacity-100 bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
      )}
      title="Opciones del mensaje"
    >
      <MoreVertical className="w-4 h-4" />
    </button>
  );
}

function getReplyAuthorLabel(reply: MessageReply, contactName?: string): string {
  if (reply.senderType === "bot") return "Bot";
  if (reply.senderType === "agent") return reply.senderName || "Agente";
  return contactName?.trim() || reply.senderName || "Contacto";
}

const outgoingLinkClassName =
  "text-sky-200 underline underline-offset-2 hover:text-white break-all";
const incomingLinkClassName =
  "text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80 break-all";

function TextMessageContent({
  message,
  isAgent,
  linkClassName,
}: {
  message: Message;
  isAgent: boolean;
  linkClassName: string;
}) {
  const displayContent = displayInboundMessageContent(message.content);
  const { preview, loading } = useMessageLinkPreview(message);
  const hideUrlText = preview && isUrlOnlyMessage(displayContent);

  return (
    <>
      {preview ? (
        <LinkPreviewCard
          preview={preview}
          variant={isAgent ? "outgoing" : "incoming"}
          loading={loading}
        />
      ) : null}
      {!hideUrlText ? (
        <WhatsAppFormattedText
          text={displayContent}
          linkClassName={linkClassName}
          className="leading-relaxed"
        />
      ) : null}
    </>
  );
}

function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function LocationMessageContent({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const location = message.location;
  const title =
    location?.name?.trim() ||
    message.content?.trim() ||
    "Ubicación";
  const subtitle =
    location?.address?.trim() ||
    (location
      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
      : message.content === "[location]"
        ? "Ubicación no disponible"
        : undefined);
  const href =
    location != null ? mapsUrl(location.latitude, location.longitude) : undefined;

  const card = (
    <div
      className={cn(
        "flex items-start gap-2.5 min-w-[200px] max-w-[260px] rounded-xl px-3 py-2.5",
        isAgent ? "bg-black/15" : "bg-[var(--color-bg-primary)]/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isAgent ? "bg-white/15 text-white" : "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
        )}
      >
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isAgent ? "text-white" : "text-[var(--color-text-primary)]"
          )}
        >
          {title === "[location]" ? "Ubicación" : title}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "text-[11px] mt-0.5 line-clamp-2",
              isAgent ? "text-white/70" : "text-[var(--color-text-secondary)]"
            )}
          >
            {subtitle}
          </p>
        ) : null}
        {href ? (
          <span
            className={cn(
              "inline-block text-[11px] font-medium mt-1.5",
              isAgent ? "text-white/90 underline" : "text-[var(--color-brand)]"
            )}
          >
            Abrir en Maps
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  );
}

function SharedContactMessageContent({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const { title, subtitle } = parseSharedContactDisplay(message.content);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 min-w-[200px] max-w-[260px] rounded-xl px-3 py-2.5",
        isAgent ? "bg-black/15" : "bg-[var(--color-bg-primary)]/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isAgent ? "bg-white/15 text-white" : "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
        )}
      >
        <UserRound className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isAgent ? "text-white" : "text-[var(--color-text-primary)]"
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "text-[11px] mt-0.5 truncate",
              isAgent ? "text-white/70" : "text-[var(--color-text-secondary)]"
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MessageContent({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const openLightbox = useUIStore((s) => s.openLightbox);
  const linkClassName = isAgent ? outgoingLinkClassName : incomingLinkClassName;

  if (
    message.contentType === "location" ||
    message.content?.trim() === "[location]"
  ) {
    return <LocationMessageContent message={message} isAgent={isAgent} />;
  }

  if (isSharedContactMessageContent(message.content)) {
    return <SharedContactMessageContent message={message} isAgent={isAgent} />;
  }

  if (message.contentType === "audio") {
    return <AudioMessageContent message={message} isAgent={isAgent} />;
  }

  if (message.contentType === "file") {
    const fileName = message.fileName || message.content;
    const caption =
      message.fileName && message.content !== message.fileName ? message.content : undefined;

    return (
      <div className="space-y-2">
        <FileAttachmentCard
          fileName={fileName}
          fileSize={message.fileSize}
          fileUrl={message.fileUrl}
          attachmentUrl={message.attachmentUrl}
          variant={isAgent ? "outgoing" : "incoming"}
        />
        {caption && (
          <TextMessageContent
            message={{ ...message, content: caption }}
            isAgent={isAgent}
            linkClassName={linkClassName}
          />
        )}
      </div>
    );
  }

  if (message.contentType === "sticker") {
    return (
      <div className="select-none">
        {message.fileUrl ? (
          <img
            src={message.fileUrl}
            alt="Sticker"
            className="w-[140px] h-[140px] object-contain drop-shadow-sm"
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-[140px] h-[140px] rounded-xl bg-[var(--color-bg-hover)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
            Sticker
          </div>
        )}
      </div>
    );
  }

  if (message.contentType === "image") {
    const fileName = message.fileName || message.content;
    const caption =
      message.fileName && message.content !== message.fileName ? message.content : undefined;

    return (
      <div className="space-y-2">
        {message.fileUrl ? (
          <button
            type="button"
            onClick={() => openLightbox(message.id)}
            className={cn(
              "block rounded-lg overflow-hidden cursor-pointer transition-opacity hover:opacity-95",
              isAgent ? "ring-1 ring-white/20" : "ring-1 ring-[var(--color-border-primary)]"
            )}
            title="Ver imagen"
          >
            <img
              src={message.fileUrl}
              alt={fileName}
              className="w-full max-w-[220px] aspect-[4/3] object-cover bg-[var(--color-bg-hover)]"
              loading="lazy"
              decoding="async"
            />
          </button>
        ) : (
          <div
            className={cn(
              "w-full max-w-[220px] aspect-[4/3] rounded-lg flex items-center justify-center",
              isAgent ? "bg-white/10" : "bg-[var(--color-bg-hover)]"
            )}
          >
            <span className="text-xs opacity-60">{fileName}</span>
          </div>
        )}
        {caption && (
          <div className={cn("text-sm leading-relaxed", isAgent ? "text-white px-0.5" : "")}>
            <TextMessageContent
              message={{ ...message, content: caption }}
              isAgent={isAgent}
              linkClassName={linkClassName}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <TextMessageContent
      message={message}
      isAgent={isAgent}
      linkClassName={linkClassName}
    />
  );
}

function AudioMessageContent({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(message.audioDuration ?? 0);
  const audioUrl = message.audioUrl || message.fileUrl;

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(Math.max(1, Math.round(audio.duration)));
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime);
    };

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const progress = duration > 0 ? playbackTime / duration : 0;
  const activeIndex = Math.min(WAVEFORM_BAR_COUNT - 1, Math.floor(progress * WAVEFORM_BAR_COUNT));
  const totalSeconds = duration || message.audioDuration || 0;
  const displayDuration = totalSeconds
    ? formatVoiceTime(totalSeconds)
    : message.content;

  return (
    <div className="flex items-center gap-2.5 min-w-[200px]">
      <button
        type="button"
        onClick={togglePlayback}
        disabled={!audioUrl}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isAgent ? "bg-white/15 hover:bg-white/25" : "bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-primary)]",
          !audioUrl && "opacity-70 cursor-default"
        )}
        title={audioUrl ? (isPlaying ? "Pausar" : "Reproducir") : undefined}
      >
        {audioUrl ? (
          isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="flex-1 flex items-center gap-[4px] min-w-0 overflow-hidden">
        {audioUrl ? (
          Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "rounded-full shrink-0",
                index === activeIndex
                  ? "w-1.5 h-1.5 bg-current opacity-100"
                  : "w-1 h-1 bg-current opacity-35"
              )}
            />
          ))
        ) : (
          <span className="text-sm opacity-90">{displayDuration}</span>
        )}
      </div>

      {audioUrl && (
        <span className="text-[11px] tabular-nums opacity-80 shrink-0">
          {displayDuration}
        </span>
      )}
    </div>
  );
}

function QuotedReply({
  reply,
  isAgent,
  contactName,
}: {
  reply: MessageReply;
  isAgent: boolean;
  contactName?: string;
}) {
  const jumpToMessage = useUIStore((s) => s.jumpToMessage);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        jumpToMessage(reply.id);
      }}
      className={cn(
        "mb-2 w-full text-left rounded-md border-l-[3px] px-2.5 py-1.5 transition-opacity hover:opacity-90 cursor-pointer",
        isAgent
          ? "border-white/60 bg-black/20"
          : "border-[var(--color-brand)] bg-[var(--color-bg-primary)]/40"
      )}
      title="Ir al mensaje"
    >
      <p
        className={cn(
          "text-xs font-semibold mb-0.5",
          isAgent ? "text-white/90" : "text-[var(--color-brand)]"
        )}
      >
        {getReplyAuthorLabel(reply, contactName)}
      </p>
      <WhatsAppFormattedText
        text={reply.content}
        linkClassName={isAgent ? outgoingLinkClassName : incomingLinkClassName}
        className={cn(
          "text-xs leading-snug line-clamp-3",
          isAgent ? "text-white/70" : "text-[var(--color-text-secondary)]"
        )}
      />
    </button>
  );
}

function MessageStatus({
  status,
  errorMessage,
}: {
  status: string;
  errorMessage?: string;
}) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-[var(--color-text-muted)] animate-pulse" />;
    case "sent":
      return <Check className="w-3 h-3 text-[var(--color-text-muted)]" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-[var(--color-text-muted)]" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-[var(--color-brand)]" />;
    case "failed":
      return (
        <span
          className="text-[10px] text-red-400 font-medium"
          title={errorMessage ?? "Envío fallido"}
          aria-label={errorMessage ?? "Envío fallido"}
        >
          !
        </span>
      );
    default:
      return null;
  }
}
