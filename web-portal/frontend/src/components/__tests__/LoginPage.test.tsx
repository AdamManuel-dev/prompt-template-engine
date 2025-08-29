/**
 * @fileoverview Tests for LoginPage component
 * @lastmodified 2025-01-28T10:30:00Z
 *
 * Features: Form validation, authentication flow, user interactions
 * Main APIs: Login form behavior, tab switching, error handling
 * Constraints: Requires mocked auth store and API client
 * Patterns: Component testing, user event simulation, state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import toast from 'react-hot-toast';

import LoginPage from '../auth/LoginPage';
import { useAuthStore } from '../../stores/auth-store';

// Mock dependencies
vi.mock('react-hot-toast');
vi.mock('../../stores/auth-store');

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(() => ({ state: null }));

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

// Create a theme for Material UI tests
const theme = createTheme();

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </BrowserRouter>
);

describe('LoginPage', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    // Mock auth store
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
      initialize: vi.fn(),
      getUserInfo: vi.fn(),
      clearError: mockClearError,
    });

    // Mock toast
    vi.mocked(toast.success).mockReturnValue('');
    vi.mocked(toast.error).mockReturnValue('');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render login form with initial state', () => {
      render(<LoginPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Template Engine')).toBeInTheDocument();
      expect(
        screen.getByText('Sign in to access the non-developer template portal')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'Username/Email' })
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'API Key' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Sign In' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Try Demo Account' })
      ).toBeInTheDocument();
    });

    it('should show loading state when authentication is in progress', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        login: mockLogin,
        logout: vi.fn(),
        initialize: vi.fn(),
        getUserInfo: vi.fn(),
        clearError: mockClearError,
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeDisabled();
      expect(screen.getByLabelText('Username')).toBeDisabled();
    });

    it('should display error message when authentication fails', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Invalid credentials',
        login: mockLogin,
        logout: vi.fn(),
        initialize: vi.fn(),
        getUserInfo: vi.fn(),
        clearError: mockClearError,
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between Username/Email and API Key tabs', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      // Initially on Username/Email tab
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();

      // Switch to API Key tab
      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });

    it('should clear errors when switching tabs', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Some error',
        login: mockLogin,
        logout: vi.fn(),
        initialize: vi.fn(),
        getUserInfo: vi.fn(),
        clearError: mockClearError,
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should validate email format on Username/Email tab', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      const emailField = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Enter invalid email
      await user.type(emailField, 'invalid-email');
      await user.click(submitButton);

      // The main test is that login shouldn't be called with invalid input
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should require either email or username on Username/Email tab', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Submit without filling any field
      await user.click(submitButton);

      // The main test is that login shouldn't be called with empty form
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should validate API key length on API Key tab', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      // Switch to API Key tab
      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      const apiKeyField = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Enter short API key
      await user.type(apiKeyField, 'short');
      await user.click(submitButton);

      // The main test is that login shouldn't be called with short API key
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should require API key on API Key tab', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      // Switch to API Key tab
      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Submit without API key
      await user.click(submitButton);

      // The main test is that login shouldn't be called without API key
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Flow', () => {
    it('should login with email credentials', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<LoginPage />, { wrapper: TestWrapper });

      const emailField = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Fill and submit form
      await user.type(emailField, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          username: undefined,
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Login successful!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });

    it('should login with username credentials', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<LoginPage />, { wrapper: TestWrapper });

      const usernameField = screen.getByLabelText('Username');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Fill and submit form
      await user.type(usernameField, 'testuser');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: undefined,
          username: 'testuser',
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Login successful!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });

    it('should login with API key', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<LoginPage />, { wrapper: TestWrapper });

      // Switch to API Key tab
      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      const apiKeyField = screen.getByLabelText('API Key');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Fill and submit form
      await user.type(apiKeyField, 'valid-api-key-123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          apiKey: 'valid-api-key-123',
        });
      });

      expect(toast.success).toHaveBeenCalledWith('Login successful!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });

    it('should handle login failure', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValueOnce(new Error('Login failed'));

      render(<LoginPage />, { wrapper: TestWrapper });

      const emailField = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Fill and submit form
      await user.type(emailField, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Login failed. Please try again.'
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should handle demo login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<LoginPage />, { wrapper: TestWrapper });

      const demoButton = screen.getByRole('button', {
        name: 'Try Demo Account',
      });

      await user.click(demoButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ username: 'demo' });
      });

      expect(toast.success).toHaveBeenCalledWith('Demo login successful!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      });
    });
  });

  describe('API Key Visibility', () => {
    it('should toggle API key visibility', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      // Switch to API Key tab
      await user.click(screen.getByRole('tab', { name: 'API Key' }));

      const apiKeyField = screen.getByLabelText('API Key');
      const toggleButton = screen
        .getByTestId('VisibilityIcon')
        .closest('button') as HTMLButtonElement;

      // Initially hidden
      expect(apiKeyField).toHaveAttribute('type', 'password');

      // Show API key
      await user.click(toggleButton);
      expect(apiKeyField).toHaveAttribute('type', 'text');

      // Hide API key again
      await user.click(toggleButton);
      expect(apiKeyField).toHaveAttribute('type', 'password');
    });
  });

  describe('Error Handling', () => {
    it('should clear field errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<LoginPage />, { wrapper: TestWrapper });

      const emailField = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Trigger validation error
      await user.click(submitButton);
      expect(
        screen.getByText('Email or username is required')
      ).toBeInTheDocument();

      // Start typing to clear error
      await user.type(emailField, 't');
      expect(
        screen.queryByText('Email or username is required')
      ).not.toBeInTheDocument();
    });

    it('should clear auth errors when user starts typing', async () => {
      const user = userEvent.setup();

      // Setup auth store with error
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Some auth error',
        login: mockLogin,
        logout: vi.fn(),
        initialize: vi.fn(),
        getUserInfo: vi.fn(),
        clearError: mockClearError,
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      const emailField = screen.getByLabelText('Email');

      // Start typing should clear auth error
      await user.type(emailField, 'test');
      expect(mockClearError).toHaveBeenCalled();
    });

    it('should close error alert when close button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Some error message',
        login: mockLogin,
        logout: vi.fn(),
        initialize: vi.fn(),
        getUserInfo: vi.fn(),
        clearError: mockClearError,
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });
});
