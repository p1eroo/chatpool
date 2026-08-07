import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { wizardSteps } from "@/lib/inboxUtils";

interface InboxWizardStepperProps {
  currentStep: number;
}

export function InboxWizardStepper({ currentStep }: InboxWizardStepperProps) {
  return (
    <ol className="space-y-6">
      {wizardSteps.map((step) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;

        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0",
                  isComplete && "border-[var(--control-selected-fg)] bg-[var(--control-selected-bg)] text-[var(--control-selected-fg)]",
                  isActive && "border-[var(--control-selected-fg)] text-[var(--control-selected-fg)] bg-[var(--control-selected-bg)]",
                  !isComplete && !isActive && "border-[var(--color-border-secondary)] text-[var(--color-text-muted)]"
                )}
              >
                {isComplete ? <Check className="w-3.5 h-3.5" /> : step.id}
              </span>
              {step.id < wizardSteps.length && (
                <span
                  className={cn(
                    "w-0.5 flex-1 min-h-8 mt-2 rounded-full",
                    isComplete ? "bg-[var(--color-brand)]" : "bg-[var(--color-border-primary)]"
                  )}
                />
              )}
            </div>
            <div className="pt-0.5 pb-4">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isActive || isComplete
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {step.title}
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 max-w-[220px]">
                {step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
