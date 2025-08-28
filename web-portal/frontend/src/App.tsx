/**
 * @fileoverview Main React application component with routing
 * @lastmodified 2025-08-28T11:50:00Z
 *
 * Features: React Router setup, authentication, layout, navigation
 * Main APIs: Route definitions, auth guards, layout components
 * Constraints: Handles authentication state, protected routes
 * Patterns: Layout pattern, route guards, context providers
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, Container, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from './stores/auth-store';
import apiClient from './services/api-client';

// Layout components
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';

// Page components
import DashboardPage from './components/pages/DashboardPage';
import TemplateCatalogPage from './components/pages/TemplateCatalogPage';
import TemplateDetailsPage from './components/pages/TemplateDetailsPage';
import ExecutionPage from './components/pages/ExecutionPage';
import ExecutionHistoryPage from './components/pages/ExecutionHistoryPage';
import ProfilePage from './components/pages/ProfilePage';
import SettingsPage from './components/pages/SettingsPage';
import { FigmaIntegrationPage } from './components/pages/FigmaIntegrationPage';

// Loading component
const LoadingScreen: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    bgcolor="background.default"
  >
    <CircularProgress size={60} />
  </Box>
);

// Error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Application Error</strong>
          </Alert>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
              {this.state.error?.stack}
            </pre>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  // Health check query
  const { data: healthStatus, error: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  });

  // Initialize auth on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Log health status in development
  useEffect(() => {
    if (import.meta.env.DEV && healthStatus) {
      console.log('[Health Check]', healthStatus);
    }
  }, [healthStatus]);

  // Show loading screen during initial auth check
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show health error if backend is not available
  if (healthError && !isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Backend Service Unavailable</strong>
        </Alert>
        <Box sx={{ p: 2 }}>
          Unable to connect to the backend service. Please ensure the server is
          running on port 3001.
        </Box>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginPage />
              )
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route
                      index
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* Template routes */}
                    <Route path="templates" element={<TemplateCatalogPage />} />
                    <Route
                      path="templates/:id"
                      element={<TemplateDetailsPage />}
                    />
                    <Route
                      path="templates/:id/execute"
                      element={<ExecutionPage />}
                    />

                    {/* Execution routes */}
                    <Route
                      path="executions"
                      element={<ExecutionHistoryPage />}
                    />
                    <Route path="executions/:id" element={<ExecutionPage />} />

                    {/* User routes */}
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    
                    {/* Figma integration demo */}
                    <Route path="figma" element={<FigmaIntegrationPage />} />

                    {/* Catch all route */}
                    <Route
                      path="*"
                      element={<Navigate to="/dashboard" replace />}
                    />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ErrorBoundary>
  );
};

export default App;
