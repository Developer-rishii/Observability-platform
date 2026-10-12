import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { LandingPage } from '../pages/LandingPage';
import { DashboardOverview } from '../pages/DashboardOverview';
import { IncidentsList } from '../pages/IncidentsList';
import { IncidentDetailView } from '../pages/IncidentDetailView';
import { RcaWorkspacePage } from '../pages/RcaWorkspacePage';
import { InfrastructurePage } from '../pages/InfrastructurePage';
import { ResourceDetailPage } from '../pages/ResourceDetailPage';
import { MetricsExplorer } from '../pages/MetricsExplorer';
import { LogExplorer } from '../pages/LogExplorer';
import { ServicesPage } from '../pages/ServicesPage';
import { EventsPage } from '../pages/EventsPage';
import { SettingsPage } from '../pages/SettingsPage';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected operational workspace */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardOverview />} />
          <Route path="/incidents" element={<IncidentsList />} />
          <Route path="/incidents/:id" element={<IncidentDetailView />} />
          <Route path="/incidents/:id/rca" element={<RcaWorkspacePage />} />
          <Route path="/infrastructure" element={<InfrastructurePage />} />
          <Route path="/infrastructure/:id" element={<ResourceDetailPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:id" element={<ResourceDetailPage />} />
          <Route path="/metrics" element={<MetricsExplorer />} />
          <Route path="/logs" element={<LogExplorer />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
