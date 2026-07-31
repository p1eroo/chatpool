import { Outlet, Navigate } from "react-router-dom";
import { NavRail } from "@/components/nav-rail/NavRail";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <NavRail />
      <div className="flex-1 flex min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
