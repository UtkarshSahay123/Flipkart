import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RoadGuardProvider } from './context/RoadGuardContext';
import { LandingPage } from './pages/LandingPage';
import { AdminLayout } from './layouts/AdminLayout';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { IssueManagementPage } from './pages/admin/IssueManagementPage';
import { LiveIssueMapPage } from './features/map/LiveIssueMapPage';
import { EmployeeManagementPage } from './pages/admin/EmployeeManagementPage';
import { AccessControlPage } from './pages/admin/AccessControlPage';
import { TaskAssignmentsPage } from './pages/admin/TaskAssignmentsPage';
import { AnalyticsReportsPage } from './pages/admin/AnalyticsReportsPage';
import { NotificationsPage } from './pages/admin/NotificationsPage';
import { ResolvedIssuesPage } from './pages/admin/ResolvedIssuesPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { OrganisationSettingsPage } from './pages/admin/OrganisationSettingsPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { UserReportsPage } from './pages/admin/UserReportsPage';
import { EmployeePortalPage } from './pages/EmployeePortalPage';

export function App() {
  return (
    <>
      <RoadGuardProvider>
        <BrowserRouter>
          <Routes>
          {/* Main Landing / Command Overview Preview */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/employee" element={<EmployeePortalPage />} />

          {/* Admin Portal Section */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminOverviewPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="issues" element={<IssueManagementPage />} />
            <Route path="map" element={<LiveIssueMapPage />} />
            <Route path="employees" element={<EmployeeManagementPage />} />
            <Route path="access-control" element={<AccessControlPage />} />
            <Route path="tasks" element={<TaskAssignmentsPage />} />
            <Route path="analytics" element={<AnalyticsReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="user-reports" element={<UserReportsPage />} />
            <Route path="resolved" element={<ResolvedIssuesPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<OrganisationSettingsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RoadGuardProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
