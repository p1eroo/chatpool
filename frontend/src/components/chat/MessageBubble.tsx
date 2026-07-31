import { cn, formatMessageTime } from "@/lib/utils";
import type { Message, MessageReply } from "@/types";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  isLastInGroup: boolean;
  attachedToMessage?: Message;
  hasAttachedNotesAbove?: boolean;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export function MessageBubble({
  message,
  isLastInGroup,
  attachedToMessage,
  hasAttachedNotesAbove,
  onContextMenu,
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
          "flex px-4 animate-fade-in",
          noteAlignEnd ? "justify-end" : "justify-start",
          isAttachedNote ? "mb-0.5" : isLastInGroup ? "mb-3" : "mb-0.5"
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
      >
        <div
          className={cn(
            "bg-[var(--color-note-bg)] border-l-[3px] border-amber-500/60 rounded-lg px-3 py-2",
            isAttachedNote ? "max-w-[75%]" : "max-w-[80%]"
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
    );
  }

  return (
    <div
      className={cn(
        "flex px-4 animate-fade-in",
        isAgent ? "justify-end" : "justify-start",
        hasAttachedNotesAbove ? "mb-0.5" : isLastInGroup ? "mb-3" : "mb-0.5"
      )}
    >
      <div className={cn("max-w-[75%]", isLastInGroup ? "mb-0" : "")}>
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(e);
          }}
          className={cn(
            "px-3.5 py-2.5 text-sm leading-relaxed",
            isAgent
              ? "bg-[var(--color-bubble-out)] text-white rounded-2xl rounded-br-md"
              : "bg-[var(--color-bubble-in)] text-[var(--color-text-primary)] rounded-2xl rounded-bl-md"
          )}
        >
          {message.replyTo && (
            <QuotedReply reply={message.replyTo} isAgent={isAgent} />
          )}
          <p>{message.content}</p>
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

function getReplyAuthorLabel(reply: MessageReply): string {
  if (reply.senderType === "agent") return "Tú";
  return reply.senderName || "Contacto";
}

function QuotedReply({ reply, isAgent }: { reply: MessageReply; isAgent: boolean }) {
  return (
    <div
      className={cn(
        "mb-2 rounded-md border-l-[3px] px-2.5 py-1.5",
        isAgent
          ? "border-white/60 bg-black/20"
          : "border-[var(--color-brand)] bg-[var(--color-bg-primary)]/40"
      )}
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
    </div>
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
