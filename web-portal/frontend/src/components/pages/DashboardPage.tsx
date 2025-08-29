/**
 * @fileoverview Dashboard page with overview and quick actions
 * @lastmodified 2025-08-28T12:05:00Z
 *
 * Features: Recent executions, template stats, quick actions, user activity
 * Main APIs: Dashboard data fetching, template metrics, execution history
 * Constraints: React Query caching, Material UI components
 * Patterns: Dashboard cards, metrics display, action buttons
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  ViewModule as TemplatesIcon,
  History as HistoryIcon,
  TrendingUp as TrendingIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import {
  ExecutionHistory as _ExecutionHistory,
  Template as _Template,
} from '@cursor-prompt/shared';
import apiClient from '../../services/api-client';
import { useAuthStore } from '../../stores/auth-store';

interface DashboardStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalTemplates: number;
  favoriteTemplates: number;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Fetch dashboard data
  const {
    data: templates = [],
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiClient.getTemplates(),
  });

  const {
    data: executionHistory = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['execution-history'],
    queryFn: () => apiClient.getExecutionHistory(),
  });

  // Calculate dashboard stats
  const stats: DashboardStats = React.useMemo(() => {
    const executions = Array.isArray(executionHistory)
      ? executionHistory
      : executionHistory?.executions || [];
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e: any) => e.status === 'success'
    ).length;
    const failedExecutions = executions.filter(
      (e: any) => e.status === 'error'
    ).length;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      totalTemplates: templates.length,
      favoriteTemplates: templates.filter(t => t.category === 'featured')
        .length,
    };
  }, [templates, executionHistory]);

  const successRate =
    stats.totalExecutions > 0
      ? (stats.successfulExecutions / stats.totalExecutions) * 100
      : 0;

  // Get recent executions (last 5)
  const recentExecutions = (
    Array.isArray(executionHistory)
      ? executionHistory
      : executionHistory?.executions || []
  )
    .sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  // Get popular templates (simplified - just first few)
  const popularTemplates = templates
    .filter(t => t.category === 'featured' || t.category === 'popular')
    .slice(0, 4);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'running':
        return <PendingIcon color="warning" />;
      default:
        return <PendingIcon color="action" />;
    }
  };

  const getStatusColor = (
    status: string
  ): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name || user?.username || 'User'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here&apos;s an overview of your template engine activity
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TemplatesIcon color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Templates
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.totalTemplates}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available templates
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ExecuteIcon color="success" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Executions
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.totalExecutions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total runs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingIcon color="info" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Success Rate
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {successRate.toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={successRate}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SuccessIcon color="success" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Successful
                </Typography>
              </Box>
              <Typography variant="h4" component="div" color="success.main">
                {stats.successfulExecutions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed successfully
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Popular Templates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6" component="h2">
                  Popular Templates
                </Typography>
                <Tooltip title="Refresh templates">
                  <IconButton onClick={() => refetchTemplates()} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              {templatesLoading ? (
                <LinearProgress />
              ) : popularTemplates.length > 0 ? (
                <Grid container spacing={2}>
                  {popularTemplates.map(template => (
                    <Grid item xs={12} key={template.id}>
                      <Card
                        variant="outlined"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/templates/${template.id}`)}
                      >
                        <CardContent sx={{ py: 1.5 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {template.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {template.description}
                              </Typography>
                            </Box>
                            <Chip
                              label={template.category}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  No popular templates available. Check back later!
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                size="small"
                onClick={() => navigate('/templates')}
                startIcon={<TemplatesIcon />}
              >
                View All Templates
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6" component="h2">
                  Recent Activity
                </Typography>
                <Tooltip title="Refresh history">
                  <IconButton onClick={() => refetchHistory()} size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              {historyLoading ? (
                <LinearProgress />
              ) : recentExecutions.length > 0 ? (
                <List>
                  {recentExecutions.map((execution: any, index: number) => (
                    <ListItem
                      key={execution.id}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                        ...(index < recentExecutions.length - 1 && {
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }),
                      }}
                      onClick={() => navigate(`/executions/${execution.id}`)}
                    >
                      <ListItemIcon>
                        {getStatusIcon(execution.status)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography variant="subtitle2">
                              {execution.templateName}
                            </Typography>
                            <Chip
                              label={execution.status}
                              size="small"
                              color={getStatusColor(execution.status)}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(
                              new Date(execution.createdAt),
                              { addSuffix: true }
                            )}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  No recent activity. Start by executing a template!
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                size="small"
                onClick={() => navigate('/executions')}
                startIcon={<HistoryIcon />}
              >
                View All History
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<TemplatesIcon />}
                onClick={() => navigate('/templates')}
              >
                Browse Templates
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<HistoryIcon />}
                onClick={() => navigate('/executions')}
              >
                View History
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<ExecuteIcon />}
                onClick={() => navigate('/templates')}
              >
                Start New Execution
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardPage;
