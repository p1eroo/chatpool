import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppDataBootstrap } from "@/components/auth/AppDataBootstrap";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { ProtectedRoute, PublicAuthRoute } from "@/components/auth/ProtectedRoute";
import { useAuthStore } from "@/store/authStore";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { InboxPage } from "@/pages/inbox/InboxPage";
import { ContactsPage } from "@/pages/contacts/ContactsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import {
  SettingsLayout,
  SettingsIndexRedirect,
} from "@/pages/settings/SettingsLayout";
import { InboxesListPage } from "@/pages/settings/inboxes/InboxesListPage";
import { InboxDetailPage } from "@/pages/settings/inboxes/InboxDetailPage";
import { CreateInboxWizardPage } from "@/pages/settings/inboxes/CreateInboxWizardPage";
import { AgentsSettingsPage } from "@/pages/settings/agents/AgentsSettingsPage";
import { RolesSettingsPage } from "@/pages/settings/roles/RolesSettingsPage";
import { IntegrationsSettingsPage } from "@/pages/settings/integrations/IntegrationsSettingsPage";
import { ProfileSettingsPage } from "@/pages/profile/ProfileSettingsPage";
import { RealtimeProvider } from "@/providers/RealtimeProvider";

function FallbackRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? "/inbox" : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSessionProvider>
        <RealtimeProvider>
        <Routes>
        <Route element={<PublicAuthRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <AppDataBootstrap>
                <AppLayout />
              </AppDataBootstrap>
            }
          >
            <Route path="/" element={<Navigate to="/inbox" replace />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfileSettingsPage />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<SettingsIndexRedirect />} />
              <Route path="inboxes" element={<InboxesListPage />} />
              <Route path="inboxes/new" element={<CreateInboxWizardPage />} />
              <Route path="inboxes/:inboxId" element={<InboxDetailPage />} />
              <Route path="agents" element={<AgentsSettingsPage />} />
              <Route path="roles" element={<RolesSettingsPage />} />
              <Route path="integrations" element={<IntegrationsSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<FallbackRedirect />} />
        </Routes>
        </RealtimeProvider>
      </AuthSessionProvider>
    </BrowserRouter>
  );
}
