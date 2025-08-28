/**
 * @fileoverview Login page with form validation and authentication
 * @lastmodified 2025-08-28T12:00:00Z
 *
 * Features: Login form, validation, authentication state management
 * Main APIs: Login with username/email/apiKey, form validation
 * Constraints: Material UI forms, Zustand auth integration
 * Patterns: Form validation, loading states, error handling
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  InputAdornment,
  IconButton,
  Tab,
  Tabs,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Person as PersonIcon,
  Key as KeyIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuthStore } from '../../stores/auth-store';

interface LocationState {
  from: {
    pathname: string;
  };
}

interface LoginFormData {
  email: string;
  username: string;
  apiKey: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [tabValue, setTabValue] = useState(0);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    username: '',
    apiKey: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<LoginFormData>>({});

  const from =
    (location.state as LocationState)?.from?.pathname || '/dashboard';

  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (tabValue === 0) {
      // Email/Username login
      if (!formData.email && !formData.username) {
        errors.email = 'Email or username is required';
      } else if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    } else if (!formData.apiKey) {
      // API Key login - required
      errors.apiKey = 'API key is required';
    } else if (formData.apiKey.length < 10) {
      // API Key login - validation
      errors.apiKey = 'API key must be at least 10 characters long';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange =
    (field: keyof LoginFormData) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setFormData(prev => ({ ...prev, [field]: value }));

      // Clear field error when user starts typing
      if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: undefined }));
      }

      // Clear auth error
      if (error) {
        clearError();
      }
    };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setFormErrors({});
    clearError();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const credentials =
        tabValue === 0
          ? {
              email: formData.email || undefined,
              username: formData.username || undefined,
            }
          : { apiKey: formData.apiKey };

      await login(credentials);
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Login failed. Please try again.');
    }
  };

  const handleDemoLogin = async () => {
    try {
      await login({ username: 'demo' });
      toast.success('Demo login successful!');
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Demo login failed:', error);
      toast.error('Demo login failed. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            borderRadius: 3,
            overflow: 'visible',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'white',
                  mb: 2,
                }}
              >
                <HomeIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography
                variant="h4"
                component="h1"
                fontWeight={600}
                gutterBottom
              >
                Template Engine
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in to access the non-developer template portal
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
                {error}
              </Alert>
            )}

            {/* Login Tabs */}
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              centered
              sx={{ mb: 3 }}
            >
              <Tab label="Username/Email" />
              <Tab label="API Key" />
            </Tabs>

            {/* Login Form */}
            <Box component="form" onSubmit={handleSubmit}>
              {tabValue === 0 ? (
                <Box sx={{ space: 2 }}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    error={!!formErrors.email}
                    helperText={formErrors.email}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 2 }}
                  />

                  <Typography variant="body2" textAlign="center" sx={{ my: 1 }}>
                    OR
                  </Typography>

                  <TextField
                    fullWidth
                    label="Username"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                    error={!!formErrors.username}
                    helperText={formErrors.username}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 3 }}
                  />
                </Box>
              ) : (
                <TextField
                  fullWidth
                  label="API Key"
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={handleInputChange('apiKey')}
                  error={!!formErrors.apiKey}
                  helperText={formErrors.apiKey}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKey(!showApiKey)}
                          edge="end"
                        >
                          {showApiKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 3 }}
                />
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  mb: 2,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>

              <Divider sx={{ my: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  OR
                </Typography>
              </Divider>

              {/* Demo Login Button */}
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleDemoLogin}
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  textTransform: 'none',
                }}
              >
                Try Demo Account
              </Button>
            </Box>

            {/* Help Text */}
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                This is a development environment. In production, you would use
                your organization&apos;s authentication system.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;
