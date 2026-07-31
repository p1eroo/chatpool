import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Users,
  Clock,
  Star,
  Download,
} from "lucide-react";

const stats = [
  { label: "Conversaciones", value: "847", change: "+12%", changeType: "up" as const, icon: TrendingUp },
  { label: "Resueltas", value: "792", change: "+8%", changeType: "up" as const, icon: Users },
  { label: "Tiempo de respuesta", value: "4.2m", change: "-15%", changeType: "down" as const, icon: Clock },
  { label: "CSAT Score", value: "4.8 ⭐", change: "+0.2", changeType: "up" as const, icon: Star },
];

interface BarData {
  label: string;
  value: number;
  color: string;
}

const weeklyData: BarData[] = [
  { label: "Lun", value: 120, color: "bg-[var(--color-brand)]" },
  { label: "Mar", value: 85, color: "bg-[var(--color-brand)]" },
  { label: "Mié", value: 140, color: "bg-[var(--color-brand)]" },
  { label: "Jue", value: 105, color: "bg-[var(--color-brand)]" },
  { label: "Vie", value: 160, color: "bg-[var(--color-brand)]" },
  { label: "Sáb", value: 70, color: "bg-[var(--color-brand)]" },
  { label: "Dom", value: 45, color: "bg-[var(--color-brand)]" },
];

const agentData: BarData[] = [
  { label: "Carlos M.", value: 80, color: "bg-[var(--color-brand)]" },
  { label: "Ana T.", value: 60, color: "bg-blue-500" },
  { label: "Luis G.", value: 40, color: "bg-emerald-500" },
];

export function ReportsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen bg-[var(--color-bg-primary)] overflow-y-auto">
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Reportes</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">
              Métricas de rendimiento del equipo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-4 hover:border-[var(--color-border-secondary)] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  {stat.label}
                </span>
                <stat.icon className="w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    stat.changeType === "up" ? "text-[var(--color-success)]" : "text-[var(--color-success)]"
                  )}
                >
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              Conversaciones por día
            </h3>
            <div className="flex items-end gap-3 h-40">
              {weeklyData.map((bar) => (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className={`w-full ${bar.color} rounded-t-md transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${(bar.value / 200) * 100}%` }}
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              Rendimiento por agente
            </h3>
            <div className="space-y-4">
              {agentData.map((agent) => (
                <div key={agent.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-[var(--color-text-secondary)]">{agent.label}</span>
                    <span className="text-[12px] font-medium text-[var(--color-text-primary)]">{agent.value}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${agent.color} rounded-full transition-all duration-500`}
                      style={{ width: `${agent.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
