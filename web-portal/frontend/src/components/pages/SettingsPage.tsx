/**
 * @fileoverview Application settings page with user preferences
 * @lastmodified 2025-08-29T11:19:00Z
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  TextField,
  Button,
  Divider,
  Alert,
  Tab,
  Tabs,
  Select,
  MenuItem,
  SelectChangeEvent,
  Grid,
} from '@mui/material';
import { Save, Restore } from '@mui/icons-material';
import { useAuthStore } from '../../stores/auth-store';
import { apiClient } from '../../services/api-client';
import toast from 'react-hot-toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface SettingsData {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    desktop: boolean;
    executionComplete: boolean;
    systemUpdates: boolean;
  };
  templates: {
    defaultTimeout: number;
    autoSave: boolean;
    showAdvancedOptions: boolean;
    maxConcurrentExecutions: number;
  };
  integrations: {
    figmaApiKey: string;
    figmaAutoSync: boolean;
  };
}

const SettingsPage: React.FC = () => {
  const { user, getUserInfo } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const [settings, setSettings] = useState<SettingsData>({
    theme: 'system',
    notifications: {
      email: true,
      desktop: false,
      executionComplete: true,
      systemUpdates: false,
    },
    templates: {
      defaultTimeout: 300,
      autoSave: true,
      showAdvancedOptions: false,
      maxConcurrentExecutions: 3,
    },
    integrations: {
      figmaApiKey: '',
      figmaAutoSync: true,
    },
  });

  const [originalSettings, setOriginalSettings] =
    useState<SettingsData>(settings);

  useEffect(() => {
    // Load settings from user preferences
    if (user?.preferences) {
      const userPrefs = user.preferences as any;
      const loadedSettings = {
        theme: userPrefs.theme || 'system',
        notifications: {
          email: userPrefs.notifications?.email !== false,
          desktop: userPrefs.notifications?.desktop || false,
          executionComplete:
            userPrefs.notifications?.executionComplete !== false,
          systemUpdates: userPrefs.notifications?.systemUpdates || false,
        },
        templates: {
          defaultTimeout: userPrefs.templates?.defaultTimeout || 300,
          autoSave: userPrefs.templates?.autoSave !== false,
          showAdvancedOptions:
            userPrefs.templates?.showAdvancedOptions || false,
          maxConcurrentExecutions:
            userPrefs.templates?.maxConcurrentExecutions || 3,
        },
        integrations: {
          figmaApiKey: userPrefs.integrations?.figmaApiKey || '',
          figmaAutoSync: userPrefs.integrations?.figmaAutoSync !== false,
        },
      };
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    }
  }, [user]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      theme: event.target.value as 'light' | 'dark' | 'system',
    });
  };

  const handleNotificationChange =
    (key: keyof SettingsData['notifications']) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSettings({
        ...settings,
        notifications: {
          ...settings.notifications,
          [key]: event.target.checked,
        },
      });
    };

  const handleTemplateChange =
    (key: keyof SettingsData['templates']) =>
    (
      event: React.ChangeEvent<HTMLInputElement> | SelectChangeEvent<number>
    ) => {
      const value =
        'type' in event.target && event.target.type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : event.target.value;

      setSettings({
        ...settings,
        templates: {
          ...settings.templates,
          [key]: value,
        },
      });
    };

  const handleIntegrationChange =
    (key: keyof SettingsData['integrations']) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value;

      setSettings({
        ...settings,
        integrations: {
          ...settings.integrations,
          [key]: value,
        },
      });
    };

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiClient.updateProfile({
        preferences: settings,
      });

      await getUserInfo();
      setOriginalSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    toast('Settings reset to last saved state');
  };

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="General" />
          <Tab label="Templates" />
          <Tab label="Notifications" />
          <Tab label="Integrations" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Theme</FormLabel>
                <RadioGroup
                  value={settings.theme}
                  onChange={handleThemeChange}
                  row
                >
                  <FormControlLabel
                    value="light"
                    control={<Radio />}
                    label="Light"
                  />
                  <FormControlLabel
                    value="dark"
                    control={<Radio />}
                    label="Dark"
                  />
                  <FormControlLabel
                    value="system"
                    control={<Radio />}
                    label="System"
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Alert severity="info">
              Theme changes will be applied in a future update. Currently using
              system default.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Template Settings
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Default Timeout (seconds)"
                  value={settings.templates.defaultTimeout}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      templates: {
                        ...settings.templates,
                        defaultTimeout: parseInt(e.target.value) || 300,
                      },
                    })
                  }
                  helperText="Maximum time for template execution"
                  inputProps={{ min: 60, max: 3600 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <FormLabel>Max Concurrent Executions</FormLabel>
                  <Select
                    value={settings.templates.maxConcurrentExecutions}
                    onChange={handleTemplateChange('maxConcurrentExecutions')}
                  >
                    <MenuItem value={1}>1</MenuItem>
                    <MenuItem value={2}>2</MenuItem>
                    <MenuItem value={3}>3</MenuItem>
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.templates.autoSave}
                    onChange={handleTemplateChange('autoSave')}
                  />
                }
                label="Auto-save template parameters"
              />
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.templates.showAdvancedOptions}
                    onChange={handleTemplateChange('showAdvancedOptions')}
                  />
                }
                label="Show advanced options by default"
              />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              Control when and how you receive notifications about system
              events.
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.email}
                    onChange={handleNotificationChange('email')}
                  />
                }
                label="Email notifications"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.desktop}
                    onChange={handleNotificationChange('desktop')}
                  />
                }
                label="Desktop notifications"
              />

              <Divider />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.executionComplete}
                    onChange={handleNotificationChange('executionComplete')}
                  />
                }
                label="Notify when template execution completes"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.systemUpdates}
                    onChange={handleNotificationChange('systemUpdates')}
                  />
                }
                label="System updates and announcements"
              />
            </Box>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Integration Settings
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              Configure integrations with external services.
            </Alert>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Figma Integration
              </Typography>

              <TextField
                fullWidth
                type="password"
                label="Figma API Key"
                value={settings.integrations.figmaApiKey}
                onChange={handleIntegrationChange('figmaApiKey')}
                helperText="Enter your Figma personal access token"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.integrations.figmaAutoSync}
                    onChange={handleIntegrationChange('figmaAutoSync')}
                  />
                }
                label="Auto-sync Figma design tokens"
              />
            </Box>

            {user?.role === 'admin' && (
              <>
                <Divider sx={{ my: 3 }} />

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Admin Settings
                  </Typography>

                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Administrator settings will be available in a future update.
                  </Alert>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Restore />}
          onClick={handleReset}
          disabled={!hasChanges}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          disabled={loading || !hasChanges}
          onClick={handleSave}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default SettingsPage;
