import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from '../pages/LoginPage';

// Placeholder components for other routes
const Dashboard = () => <div><h2>Dashboard</h2><p>Welcome to the Observability Platform Dashboard.</p></div>;
const IncidentsList = () => <div><h2>Incidents</h2><p>List of all incidents will appear here.</p></div>;
const IncidentDetail = () => <div><h2>Incident Detail</h2><p>Details for the specific incident will appear here.</p></div>;

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="incidents" element={<IncidentsList />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
