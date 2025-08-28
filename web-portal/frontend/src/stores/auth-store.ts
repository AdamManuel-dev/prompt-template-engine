/**
 * @fileoverview Authentication store using Zustand
 * @lastmodified 2025-08-28T11:30:00Z
 *
 * Features: User authentication state, token management, login/logout
 * Main APIs: login, logout, initialize, getUserInfo
 * Constraints: Handles token storage, auto-refresh
 * Patterns: Zustand store, localStorage integration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSession } from '@cursor-prompt/shared';
import { apiClient } from '../services/api-client';

interface AuthState {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: {
    email?: string;
    username?: string;
    apiKey?: string;
  }) => Promise<void>;
  logout: () => void;
  initialize: () => void;
  getUserInfo: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async credentials => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiClient.post('/auth/login', credentials);

          if (response.data.success) {
            const { user, token } = response.data.data;

            // Store token in API client
            apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;

            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.data.error?.message || 'Login failed');
          }
        } catch (error) {
          console.error('Login error:', error);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: () => {
        // Clear token from API client
        delete apiClient.defaults.headers.common.Authorization;

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      initialize: () => {
        const { token } = get();

        if (token) {
          // Restore token in API client
          apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;

          // Verify token is still valid
          get()
            .getUserInfo()
            .catch(() => {
              // Token is invalid, logout
              get().logout();
            });
        }
      },

      getUserInfo: async () => {
        try {
          set({ isLoading: true, error: null });

          const response = await apiClient.get('/auth/me');

          if (response.data.success) {
            const user = response.data.data;

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(
              response.data.error?.message || 'Failed to get user info'
            );
          }
        } catch (error) {
          console.error('Get user info error:', error);
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get user info',
          });

          // If unauthorized, logout
          if (error instanceof Error && error.message.includes('401')) {
            get().logout();
          }

          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-store',
      partialize: state => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
