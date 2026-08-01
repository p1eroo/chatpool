import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { LabelColorDot } from "@/components/settings/LabelColorDot";
import { cn } from "@/lib/utils";
import { useLabelStore } from "@/store/labelStore";
import { useInboxStore } from "@/store/inboxStore";
import { useInboxSettingsStore } from "@/store/inboxSettingsStore";
import { InboxRowMenu } from "@/components/settings/InboxRowMenu";
import { InboxStatusBadge } from "@/components/settings/SettingsSection";

export function InboxesListPage() {
  const navigate = useNavigate();
  const inboxes = useInboxStore((s) => s.inboxes);
  const getByInboxId = useInboxSettingsStore((s) => s.getByInboxId);
  const getLabelsForInbox = useLabelStore((s) => s.getLabelsForInbox);

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-primary)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Bandejas ({inboxes.length})
          </h3>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
            Cada bandeja agrupa canal, etiquetas, agentes e integración
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/settings/inboxes/new")}
          className="h-8 px-3 text-xs font-medium bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-light)] transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva
        </button>
      </div>

      <div className="divide-y divide-[var(--color-border-primary)]">
        {inboxes.map((inbox) => {
          const config = getByInboxId(inbox.id);
          const inboxLabels = getLabelsForInbox(inbox.id);
          const status = config?.status ?? "active";

          return (
            <div
              key={inbox.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/settings/inboxes/${inbox.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/settings/inboxes/${inbox.id}`);
                }
              }}
              className="px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{inbox.name}</p>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      {inbox.channelType}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    {config?.detail ?? inbox.channelType}
                  </p>
                  {config?.description && (
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{config.description}</p>
                  )}
                  {inboxLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {inboxLabels.map((label) => (
                        <span
                          key={label.id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                        >
                          <LabelColorDot color={label.color} className="w-1.5 h-1.5" />
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <InboxStatusBadge status={status} />
                  <InboxRowMenu inboxId={inbox.id} status={status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
