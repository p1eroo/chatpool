import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppDataBootstrap } from "@/components/auth/AppDataBootstrap";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { ProtectedRoute, PublicAuthRoute } from "@/components/auth/ProtectedRoute";
import {
  RequirePermission,
  RequireSettingsAccess,
} from "@/components/auth/RequirePermission";
import { useAuthStore } from "@/store/authStore";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { InboxPage } from "@/pages/inbox/InboxPage";
import { ContactsPage } from "@/pages/contacts/ContactsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { DocumentationPage } from "@/pages/documentation/DocumentationPage";
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
import { BrowserNotificationsBridge } from "@/components/notifications/BrowserNotificationsBridge";
import { AppUpdateModal } from "@/components/system/AppUpdateModal";
import { ApiProgressBar } from "@/components/system/ApiProgressBar";
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
        <ApiProgressBar />
        <BrowserNotificationsBridge />
        <AppUpdateModal />
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
            <Route element={<RequirePermission anyOf={["viewReports"]} />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
            <Route element={<RequireSettingsAccess />}>
              <Route path="/documentation" element={<DocumentationPage />} />
            </Route>
            <Route path="/profile" element={<ProfileSettingsPage />} />
            <Route path="/settings" element={<RequireSettingsAccess />}>
              <Route element={<SettingsLayout />}>
                <Route index element={<SettingsIndexRedirect />} />
                <Route element={<RequirePermission anyOf={["manageInboxes"]} />}>
                  <Route path="inboxes" element={<InboxesListPage />} />
                  <Route path="inboxes/new" element={<CreateInboxWizardPage />} />
                  <Route path="inboxes/:inboxId" element={<InboxDetailPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["manageAgents"]} />}>
                  <Route path="agents" element={<AgentsSettingsPage />} />
                  <Route path="roles" element={<RolesSettingsPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["manageIntegrations"]} />}>
                  <Route path="integrations" element={<IntegrationsSettingsPage />} />
                </Route>
              </Route>
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
