/**
 * @fileoverview Template details page with execution wizard integration
 * @lastmodified 2025-08-28T12:55:00Z
 *
 * Features: Template display, wizard integration, execution management
 * Main APIs: Template details with execution flow
 * Constraints: Requires template ID param, handles loading and error states
 * Patterns: Data fetching, wizard orchestration, navigation
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Button,
  Breadcrumbs,
  Link,
  Chip,
  Grid,
  Card,
  CardContent,
  Rating,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  Download,
  Favorite,
  Share,
  Info,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { Template } from '@cursor-prompt/shared';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/api-client';
import TemplateWizard from '../template/TemplateWizard';

const TemplateDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Template ID is required');
      setLoading(false);
      return;
    }

    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const templateData = await apiClient.getTemplate(id);
        setTemplate(templateData);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch template:', err);
        setError(
          err.response?.data?.error?.message || 'Failed to load template'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [id]);

  const handleExecute = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = (_result: any) => {
    setShowWizard(false);
    toast.success('Template executed successfully!');
    // Navigate to execution history or results page
    navigate('/executions');
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  const handleBackToCatalog = () => {
    navigate('/templates');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading template details...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBackToCatalog}
          sx={{ mb: 2 }}
        >
          Back to Templates
        </Button>
        <Alert severity="error">
          <Typography variant="h6">Failed to Load Template</Typography>
          <Typography variant="body2">{error}</Typography>
          <Button
            size="small"
            onClick={() => window.location.reload()}
            sx={{ mt: 1 }}
          >
            Retry
          </Button>
        </Alert>
      </Box>
    );
  }

  if (!template) {
    return (
      <Alert severity="warning">
        Template not found. Please check the URL and try again.
      </Alert>
    );
  }

  if (showWizard) {
    return (
      <TemplateWizard
        template={template}
        onComplete={handleWizardComplete}
        onCancel={handleWizardCancel}
      />
    );
  }

  const { schema } = template;
  const requiredVars = schema.variables.filter(v => v.required);
  const optionalVars = schema.variables.filter(v => !v.required);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToCatalog}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          Templates
        </Link>
        <Typography color="text.primary">
          {template.displayName || template.name}
        </Typography>
      </Breadcrumbs>

      {/* Template Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Box
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4" gutterBottom>
                  {template.displayName || template.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {template.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip
                    label={template.category}
                    variant="outlined"
                    color="primary"
                  />
                  {template.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Rating
                  value={template.rating?.average || 0}
                  readOnly
                  precision={0.1}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  ({template.rating?.total || 0} reviews)
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {(template.stats?.downloads || 0).toLocaleString()} downloads
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Author:</strong> {template.author?.name || 'Unknown'}
                {template.author?.verified && ' ✓'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Version:</strong> {template.version || '1.0.0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Updated:</strong>{' '}
                {new Date(template.updatedAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={handleExecute}
                fullWidth
              >
                Execute Template
              </Button>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Favorite />}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  Favorite
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Share />}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  Share
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  size="small"
                >
                  Export
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Template Schema Information */}
      <Grid container spacing={3}>
        {/* Required Parameters */}
        {requiredVars.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  Required Parameters ({requiredVars.length})
                </Typography>
                {requiredVars.map(variable => (
                  <Box key={variable.name} sx={{ mb: 2 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {variable.name} *
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type: {variable.type}
                    </Typography>
                    {variable.description && (
                      <Typography variant="body2" color="text.secondary">
                        {variable.description}
                      </Typography>
                    )}
                    {variable.options && (
                      <Typography variant="body2" color="text.secondary">
                        Options: {variable.options.join(', ')}
                      </Typography>
                    )}
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Optional Parameters */}
        {optionalVars.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Optional Parameters ({optionalVars.length})
                </Typography>
                {optionalVars.map(variable => (
                  <Box key={variable.name} sx={{ mb: 2 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {variable.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type: {variable.type}
                    </Typography>
                    {variable.description && (
                      <Typography variant="body2" color="text.secondary">
                        {variable.description}
                      </Typography>
                    )}
                    {variable.defaultValue !== undefined && (
                      <Typography variant="body2" color="text.secondary">
                        Default: {String(variable.defaultValue)}
                      </Typography>
                    )}
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Examples */}
        {schema.examples && schema.examples.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Examples
                </Typography>
                <Grid container spacing={2}>
                  {schema.examples.map((example, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography
                          variant="body1"
                          fontWeight="medium"
                          gutterBottom
                        >
                          {example.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          paragraph
                        >
                          {example.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Variables: {Object.keys(example.variables).join(', ')}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Dependencies */}
        {schema.dependencies && schema.dependencies.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>Dependencies:</strong> This template requires the
                following dependencies: {schema.dependencies.join(', ')}
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* Action Bar */}
      <Paper
        sx={{
          p: 2,
          mt: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button startIcon={<ArrowBack />} onClick={handleBackToCatalog}>
          Back to Templates
        </Button>

        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={handleExecute}
          size="large"
        >
          Execute Template
        </Button>
      </Paper>
    </Box>
  );
};

export default TemplateDetailsPage;
