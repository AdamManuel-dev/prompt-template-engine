/**
 * @fileoverview Figma Integration demo page for testing new components
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: URL input, design tokens display, preview, template mapping
 * Main APIs: FigmaUrlInput, DesignTokenDisplay, FigmaPreview integration
 * Constraints: Development/demo purposes, real API integration ready
 * Patterns: State management, component composition, error boundaries
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  Link as LinkIcon,
  Palette,
  Visibility,
  PlayArrow,
  CheckCircle
} from '@mui/icons-material';
import { 
  FigmaUrlInfo, 
  FigmaFileInfo, 
  DesignToken, 
  FigmaPreview,
  FigmaTemplateParameter 
} from '@cursor-prompt/shared';
import { FigmaUrlInput } from '../figma/FigmaUrlInput';
import { DesignTokenDisplay } from '../figma/DesignTokenDisplay';
import { FigmaPreview as FigmaPreviewComponent } from '../figma/FigmaPreview';
import { useFigmaApi } from '../../hooks/useFigmaApi';

const DEMO_STEPS = [
  {
    id: 'url',
    label: 'Enter Figma URL',
    description: 'Paste a Figma file URL to begin extraction',
    icon: <LinkIcon />
  },
  {
    id: 'tokens',
    label: 'Extract Design Tokens',
    description: 'View and select design tokens from your Figma file',
    icon: <Palette />
  },
  {
    id: 'preview',
    label: 'Visual Preview',
    description: 'See a preview of your Figma design',
    icon: <Visibility />
  },
  {
    id: 'mapping',
    label: 'Template Mapping',
    description: 'Map tokens to template parameters',
    icon: <PlayArrow />
  }
];

interface FigmaIntegrationState {
  urlInfo: FigmaUrlInfo | null;
  fileInfo: FigmaFileInfo | null;
  tokens: DesignToken[];
  preview: FigmaPreview | null;
  mappings: FigmaTemplateParameter[];
  activeStep: number;
  loading: {
    fileInfo: boolean;
    tokens: boolean;
    preview: boolean;
  };
  errors: {
    fileInfo: string | null;
    tokens: string | null;
    preview: string | null;
  };
}

export const FigmaIntegrationPage: React.FC = () => {
  const [state, setState] = useState<FigmaIntegrationState>({
    urlInfo: null,
    fileInfo: null,
    tokens: [],
    preview: null,
    mappings: [],
    activeStep: 0,
    loading: {
      fileInfo: false,
      tokens: false,
      preview: false
    },
    errors: {
      fileInfo: null,
      tokens: null,
      preview: null
    }
  });

  const { getDesignTokens, getPreview } = useFigmaApi();

  const handleUrlChange = useCallback((urlInfo: FigmaUrlInfo, fileInfo: FigmaFileInfo | null) => {
    setState(prev => ({
      ...prev,
      urlInfo,
      fileInfo,
      activeStep: urlInfo.isValid && fileInfo ? 1 : 0,
      tokens: [],
      preview: null,
      mappings: [],
      errors: {
        fileInfo: null,
        tokens: null,
        preview: null
      }
    }));

    // Auto-load tokens and preview if valid
    if (urlInfo.isValid && urlInfo.fileId && fileInfo) {
      loadDesignTokens(urlInfo.fileId);
      loadPreview(urlInfo.fileId, urlInfo.nodeId);
    }
  }, []);

  const loadDesignTokens = async (fileId: string) => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, tokens: true },
      errors: { ...prev.errors, tokens: null }
    }));

    try {
      const tokens = await getDesignTokens(fileId);
      setState(prev => ({
        ...prev,
        tokens,
        activeStep: Math.max(prev.activeStep, 1),
        loading: { ...prev.loading, tokens: false }
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, tokens: false },
        errors: { ...prev.errors, tokens: error.message || 'Failed to load design tokens' }
      }));
    }
  };

  const loadPreview = async (fileId: string, nodeId?: string) => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, preview: true },
      errors: { ...prev.errors, preview: null }
    }));

    try {
      const preview = await getPreview(fileId, nodeId);
      setState(prev => ({
        ...prev,
        preview,
        activeStep: Math.max(prev.activeStep, 2),
        loading: { ...prev.loading, preview: false }
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, preview: false },
        errors: { ...prev.errors, preview: error.message || 'Failed to load preview' }
      }));
    }
  };

  const handleTokenMapping = useCallback((mappings: FigmaTemplateParameter[]) => {
    setState(prev => ({
      ...prev,
      mappings,
      activeStep: Math.max(prev.activeStep, 3)
    }));
  }, []);

  const handleExportTokens = useCallback((format: 'json' | 'css' | 'scss') => {
    const exportData = {
      fileId: state.urlInfo?.fileId,
      fileName: state.fileInfo?.name,
      tokens: state.tokens,
      format,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `figma-tokens-${state.urlInfo?.fileId}.${format === 'json' ? 'json' : 'css'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>
          Figma Integration Demo
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Test the Figma MCP integration by pasting a Figma URL to extract design tokens,
          view previews, and map them to template parameters.
        </Typography>
      </Box>

      {/* Progress Stepper */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stepper activeStep={state.activeStep} orientation="horizontal">
            {DEMO_STEPS.map((step, index) => (
              <Step key={step.id}>
                <StepLabel
                  icon={index < state.activeStep ? <CheckCircle /> : step.icon}
                  optional={
                    <Typography variant="caption">{step.description}</Typography>
                  }
                >
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* Left Column - Input & Controls */}
        <Grid item xs={12} lg={4}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            {/* URL Input */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  1. Figma URL Input
                </Typography>
                <FigmaUrlInput
                  onChange={handleUrlChange}
                  showPreview={false}
                  placeholder="https://www.figma.com/file/..."
                />
              </CardContent>
            </Card>

            {/* File Info */}
            {state.fileInfo && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    File Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Name:</strong> {state.fileInfo.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Version:</strong> {state.fileInfo.version}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Last Modified:</strong>{' '}
                      {new Date(state.fileInfo.lastModified).toLocaleDateString()}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={`File ID: ${state.urlInfo?.fileId}`}
                        size="small"
                        variant="outlined"
                      />
                      {state.urlInfo?.nodeId && (
                        <Chip
                          label={`Node: ${state.urlInfo.nodeId}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Template Mappings */}
            {state.mappings.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Template Mappings ({state.mappings.length})
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {state.mappings.map((mapping, index) => (
                      <Box
                        key={index}
                        sx={{
                          p: 1,
                          mb: 1,
                          backgroundColor: 'action.hover',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium">
                          {mapping.key}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mapping.value.toString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                    startIcon={<PlayArrow />}
                  >
                    Apply to Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>

        {/* Right Column - Tokens & Preview */}
        <Grid item xs={12} lg={8}>
          {/* Design Tokens */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                2. Design Tokens
                {state.loading.tokens && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Typography>
              
              {state.errors.tokens && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {state.errors.tokens}
                </Alert>
              )}

              <DesignTokenDisplay
                tokens={state.tokens}
                loading={state.loading.tokens}
                error={state.errors.tokens}
                onTokenSelect={(token) => console.log('Token selected:', token)}
                onMapToTemplate={handleTokenMapping}
                onExport={handleExportTokens}
                showMapping={true}
                compact={false}
              />
            </CardContent>
          </Card>

          {/* Visual Preview */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                3. Visual Preview
                {state.loading.preview && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Typography>

              {state.errors.preview && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {state.errors.preview}
                </Alert>
              )}

              {state.urlInfo?.fileId && (
                <FigmaPreviewComponent
                  fileId={state.urlInfo.fileId}
                  nodeId={state.urlInfo.nodeId}
                  preview={state.preview}
                  loading={state.loading.preview}
                  error={state.errors.preview}
                  onPreviewLoad={(preview) => {
                    setState(prev => ({ ...prev, preview }));
                  }}
                  onError={(error) => {
                    setState(prev => ({
                      ...prev,
                      errors: { ...prev.errors, preview: error }
                    }));
                  }}
                  showControls={true}
                  showFullscreenButton={true}
                  maxWidth={700}
                  maxHeight={500}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Demo Instructions */}
      <Card sx={{ mt: 4, backgroundColor: 'info.light', color: 'info.contrastText' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📝 Demo Instructions
          </Typography>
          <Typography variant="body2" paragraph>
            This is a demo page to test the Phase 3 Figma integration features:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>🔗 URL Input:</strong> Validates Figma URLs and extracts file/node IDs
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>🎨 Design Tokens:</strong> Extracts colors, typography, spacing from Figma
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>👁️ Preview:</strong> Shows Figma file/node screenshots with zoom controls
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>📋 Mapping:</strong> Maps design tokens to template parameters
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2, borderColor: 'info.dark' }} />
          <Typography variant="caption">
            Note: This demo currently uses mock data. The MCP server integration is ready but requires
            the Figma MCP server to be running and configured with proper API tokens.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};