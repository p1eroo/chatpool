import { cn } from "@/lib/utils";
import type { WhatsAppTemplateButton } from "@/types/whatsappTemplate";

interface WhatsAppTemplateButtonPreviewProps {
  buttons: WhatsAppTemplateButton[];
  className?: string;
}

/** Botones de plantilla WhatsApp (QUICK_REPLY, URL, PHONE_NUMBER) como en la app. */
export function WhatsAppTemplateButtonPreview({
  buttons,
  className,
}: WhatsAppTemplateButtonPreviewProps) {
  if (!buttons.length) return null;

  return (
    <div className={cn("mt-2 -mx-1 space-y-px overflow-hidden rounded-lg", className)}>
      {buttons.map((button, index) => (
        <div
          key={`${button.type}-${button.text}-${index}`}
          className="border-t border-white/10 bg-black/10 px-3 py-2.5 text-center"
        >
          <span className="text-sm font-medium text-emerald-400">{button.text}</span>
        </div>
      ))}
    </div>
  );
}
