import { useEffect, useRef, useState } from "react";
import { cn, formatMessageTime } from "@/lib/utils";
import type { Message, MessageReply } from "@/types";
import { useUIStore } from "@/store/uiStore";
import { Check, CheckCheck, Mic, MoreVertical, Pause, Play } from "lucide-react";
import { FileAttachmentCard } from "./FileAttachmentCard";
import { WAVEFORM_BAR_COUNT, formatVoiceTime } from "@/hooks/useVoiceRecorder";

interface MessageBubbleProps {
  message: Message;
  isLastInGroup: boolean;
  isHighlighted?: boolean;
  attachedToMessage?: Message;
  hasAttachedNotesAbove?: boolean;
  isMenuOpen?: boolean;
  onContextMenu?: (event: React.MouseEvent) => void;
  onMenuOpen?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function MessageBubble({
  message,
  isLastInGroup,
  isHighlighted,
  attachedToMessage,
  hasAttachedNotesAbove,
  isMenuOpen,
  onContextMenu,
  onMenuOpen,
}: MessageBubbleProps) {
  if (message.senderType === "system") {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = message.senderType === "agent";
  const isPrivate = message.isPrivate;
  const isAttachedNote = isPrivate && !!message.attachedToMessageId;
  const noteAlignEnd = attachedToMessage?.senderType === "agent";

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
            <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group flex px-4 animate-fade-in",
        isAgent ? "justify-end" : "justify-start",
        hasAttachedNotesAbove ? "mb-0.5" : isLastInGroup ? "mb-3" : "mb-0.5",
        isHighlighted && "animate-message-highlight -mx-1 px-5"
      )}
    >
      <div className={cn("max-w-[75%]", isLastInGroup ? "mb-0" : "")}>
        <div
          className={cn(
            "flex items-center gap-1",
            isAgent ? "flex-row" : "flex-row-reverse"
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
              "text-sm leading-relaxed min-w-0",
              message.contentType === "file"
                ? "p-1"
                : message.contentType === "image"
                  ? "p-1.5"
                  : "px-3.5 py-2.5",
              isAgent
                ? "bg-[var(--color-bubble-out)] text-white rounded-2xl rounded-br-md"
                : "bg-[var(--color-bubble-in)] text-[var(--color-text-primary)] rounded-2xl rounded-bl-md"
            )}
          >
            {message.replyTo && (
              <QuotedReply reply={message.replyTo} isAgent={isAgent} />
            )}
            <MessageContent message={message} isAgent={isAgent} />
          </div>
        </div>
        {isLastInGroup && (
          <div
            className={cn(
              "flex items-center gap-1 mt-1",
              isAgent ? "justify-end" : "justify-start"
            )}
          >
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {formatMessageTime(message.createdAt)}
            </span>
            {isAgent && message.status && (
              <MessageStatus status={message.status} />
            )}
          </div>
        )}
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

function getReplyAuthorLabel(reply: MessageReply): string {
  if (reply.senderType === "agent") return "Tú";
  return reply.senderName || "Contacto";
}

function MessageContent({ message, isAgent }: { message: Message; isAgent: boolean }) {
  const openLightbox = useUIStore((s) => s.openLightbox);

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
          <p className={cn("text-sm leading-relaxed px-0.5", isAgent ? "text-white" : "")}>
            {caption}
          </p>
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
              className="w-full max-w-[220px] object-cover"
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
        {caption && <p className="text-sm leading-relaxed">{caption}</p>}
      </div>
    );
  }

  return <p>{message.content}</p>;
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

function QuotedReply({ reply, isAgent }: { reply: MessageReply; isAgent: boolean }) {
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
        {getReplyAuthorLabel(reply)}
      </p>
      <p
        className={cn(
          "text-xs leading-snug line-clamp-3",
          isAgent ? "text-white/70" : "text-[var(--color-text-secondary)]"
        )}
      >
        {reply.content}
      </p>
    </button>
  );
}

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return <Check className="w-3 h-3 text-[var(--color-text-muted)]" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-[var(--color-text-muted)]" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-[var(--color-brand)]" />;
    default:
      return null;
  }
}
