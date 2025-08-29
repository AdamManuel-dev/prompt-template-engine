/**
 * @fileoverview Execution history page with filtering and search
 * @lastmodified 2025-08-29T11:20:00Z
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  LinearProgress,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Search,
  Visibility,
  Download,
  Refresh,
  PlayArrow,
  CheckCircle,
  Error,
  Pause,
  AccessTime,
} from '@mui/icons-material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Execution {
  id: string;
  templateId: string;
  templateName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  parameters: Record<string, any>;
  outputs?: any[];
  error?: string;
  progress?: number;
}

interface ExecutionHistoryData {
  executions: Execution[];
  total: number;
  page: number;
  totalPages: number;
}

const ExecutionHistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExecutionHistoryData>({
    executions: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const loadHistory = async () => {
    try {
      setLoading(true);

      // Mock data for now - replace with actual API call when backend is ready
      const mockData: ExecutionHistoryData = {
        executions: [
          {
            id: '1',
            templateId: 'react-component',
            templateName: 'React Component Generator',
            status: 'completed',
            startedAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date(Date.now() - 3580000).toISOString(),
            duration: 20000,
            parameters: { componentName: 'UserCard', withTests: true },
            outputs: [
              'UserCard.tsx',
              'UserCard.test.tsx',
              'UserCard.stories.tsx',
            ],
          },
          {
            id: '2',
            templateId: 'api-endpoint',
            templateName: 'API Endpoint Generator',
            status: 'failed',
            startedAt: new Date(Date.now() - 7200000).toISOString(),
            completedAt: new Date(Date.now() - 7180000).toISOString(),
            duration: 20000,
            parameters: { endpoint: '/api/users', method: 'POST' },
            error:
              'Template validation failed: Missing required parameter "schema"',
          },
          {
            id: '3',
            templateId: 'database-migration',
            templateName: 'Database Migration',
            status: 'running',
            startedAt: new Date(Date.now() - 300000).toISOString(),
            parameters: { table: 'users', operation: 'add_column' },
            progress: 65,
          },
          {
            id: '4',
            templateId: 'react-page',
            templateName: 'React Page Template',
            status: 'pending',
            startedAt: new Date(Date.now() - 60000).toISOString(),
            parameters: { pageName: 'Dashboard', withLayout: true },
          },
        ],
        total: 4,
        page: 1,
        totalPages: 1,
      };

      setData(mockData);
    } catch (error) {
      console.error('Failed to load execution history:', error);
      toast.error('Failed to load execution history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, search, statusFilter]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleStatusFilter = (event: any) => {
    setStatusFilter(event.target.value);
    setPage(1);
  };

  const handlePageChange = (
    _event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setPage(value);
  };

  const handleViewDetails = (execution: Execution) => {
    setSelectedExecution(execution);
    setShowDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'failed':
        return <Error />;
      case 'running':
        return <PlayArrow />;
      case 'pending':
        return <AccessTime />;
      case 'cancelled':
        return <Pause />;
      default:
        return <AccessTime />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Execution History</Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => loadHistory()}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems="center"
          >
            <TextField
              placeholder="Search templates or parameters..."
              variant="outlined"
              size="small"
              value={search}
              onChange={handleSearch}
              sx={{ minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={handleStatusFilter}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              {data.total} executions total
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Execution Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                ) : data.executions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Alert severity="info" sx={{ m: 2 }}>
                        No executions found. Run a template to see execution
                        history.
                      </Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.executions.map(execution => (
                    <TableRow key={execution.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">
                            {execution.templateName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {execution.templateId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(execution.status)}
                          label={execution.status.toUpperCase()}
                          color={getStatusColor(execution.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(execution.startedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatDuration(execution.duration)}
                      </TableCell>
                      <TableCell>
                        {execution.status === 'running' &&
                        execution.progress ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <LinearProgress
                              variant="determinate"
                              value={execution.progress}
                              sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption">
                              {execution.progress}%
                            </Typography>
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(execution)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        {execution.outputs && execution.outputs.length > 0 && (
                          <Tooltip title="Download Results">
                            <IconButton size="small">
                              <Download />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {data.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={data.totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Execution Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Execution Details - {selectedExecution?.templateName}
        </DialogTitle>
        <DialogContent>
          {selectedExecution && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Status
                </Typography>
                <Chip
                  icon={getStatusIcon(selectedExecution.status)}
                  label={selectedExecution.status.toUpperCase()}
                  color={getStatusColor(selectedExecution.status) as any}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Timeline
                </Typography>
                <Typography variant="body2">
                  Started: {formatDate(selectedExecution.startedAt)}
                </Typography>
                {selectedExecution.completedAt && (
                  <Typography variant="body2">
                    Completed: {formatDate(selectedExecution.completedAt)}
                  </Typography>
                )}
                <Typography variant="body2">
                  Duration: {formatDuration(selectedExecution.duration)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Parameters
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                    {JSON.stringify(selectedExecution.parameters, null, 2)}
                  </pre>
                </Paper>
              </Box>

              {selectedExecution.outputs && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Generated Files
                  </Typography>
                  <Stack spacing={1}>
                    {selectedExecution.outputs.map((file, index) => (
                      <Chip key={index} label={file} variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}

              {selectedExecution.error && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="error">
                    Error
                  </Typography>
                  <Alert severity="error">{selectedExecution.error}</Alert>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
          {selectedExecution?.outputs && (
            <Button variant="contained" startIcon={<Download />}>
              Download Results
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExecutionHistoryPage;
