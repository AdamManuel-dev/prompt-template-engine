/**
 * @fileoverview Template execution page with dynamic forms and progress tracking
 * @lastmodified 2025-08-29T11:21:00Z
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  FormLabel,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Chip,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Download,
  Code,
  Visibility,
  ContentCopy,
  Refresh,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  category: string;
}

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  logs: string[];
  results?: {
    files: Array<{ name: string; content: string; language?: string }>;
    summary: string;
  };
  error?: string;
}

const steps = ['Configure', 'Execute', 'Results'];

const ExecutionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [execution, setExecution] = useState<ExecutionState>({
    status: 'idle',
    progress: 0,
    currentStep: '',
    logs: [],
  });
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);

      // Mock template data - replace with actual API call
      const mockTemplate: Template = {
        id: id || 'react-component',
        name: 'React Component Generator',
        description:
          'Generate a complete React component with TypeScript, tests, and Storybook stories',
        category: 'React',
        schema: {
          type: 'object',
          properties: {
            componentName: {
              type: 'string',
              title: 'Component Name',
              description: 'Name of the React component to generate',
              default: 'MyComponent',
            },
            componentType: {
              type: 'string',
              title: 'Component Type',
              enum: ['functional', 'class'],
              default: 'functional',
            },
            withTests: {
              type: 'boolean',
              title: 'Include Tests',
              description: 'Generate Jest test files',
              default: true,
            },
            withStorybook: {
              type: 'boolean',
              title: 'Include Storybook',
              description: 'Generate Storybook stories',
              default: true,
            },
            styling: {
              type: 'string',
              title: 'Styling Approach',
              enum: ['css-modules', 'styled-components', 'emotion', 'tailwind'],
              default: 'css-modules',
            },
            props: {
              type: 'array',
              title: 'Component Props',
              description: 'List of props for the component',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', title: 'Prop Name' },
                  type: { type: 'string', title: 'Prop Type' },
                  required: { type: 'boolean', title: 'Required' },
                },
              },
              default: [
                { name: 'title', type: 'string', required: true },
                { name: 'onClick', type: '() => void', required: false },
              ],
            },
          },
          required: ['componentName'],
        },
      };

      setTemplate(mockTemplate);

      // Initialize parameters with defaults
      const defaultParams: Record<string, any> = {};
      Object.entries(mockTemplate.schema.properties).forEach(
        ([key, prop]: [string, any]) => {
          if (prop.default !== undefined) {
            defaultParams[key] = prop.default;
          }
        }
      );
      setParameters(defaultParams);
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleExecute = async () => {
    try {
      setActiveStep(1);
      setExecution({
        status: 'running',
        progress: 0,
        currentStep: 'Validating parameters...',
        logs: ['Starting template execution...'],
      });

      // Simulate execution with progress updates
      const steps = [
        'Validating parameters...',
        'Generating component structure...',
        'Creating TypeScript interfaces...',
        'Writing component implementation...',
        'Generating test files...',
        'Creating Storybook stories...',
        'Finalizing output...',
      ];

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));

        setExecution(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / steps.length) * 100),
          currentStep: steps[i],
          logs: [...prev.logs, `✓ ${steps[i]}`],
        }));
      }

      // Mock results
      const results = {
        files: [
          {
            name: `${parameters.componentName}.tsx`,
            content: `import React from 'react';
import styles from './${parameters.componentName}.module.css';

interface ${parameters.componentName}Props {
  title: string;
  onClick?: () => void;
}

const ${parameters.componentName}: React.FC<${parameters.componentName}Props> = ({
  title,
  onClick,
}) => {
  return (
    <div className={styles.container} onClick={onClick}>
      <h2 className={styles.title}>{title}</h2>
    </div>
  );
};

export default ${parameters.componentName};`,
            language: 'typescript',
          },
          {
            name: `${parameters.componentName}.test.tsx`,
            content: `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${parameters.componentName} from './${parameters.componentName}';

describe('${parameters.componentName}', () => {
  it('renders title correctly', () => {
    render(<${parameters.componentName} title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
});`,
            language: 'typescript',
          },
          {
            name: `${parameters.componentName}.stories.tsx`,
            content: `import type { Meta, StoryObj } from '@storybook/react';
import ${parameters.componentName} from './${parameters.componentName}';

const meta: Meta<typeof ${parameters.componentName}> = {
  title: 'Components/${parameters.componentName}',
  component: ${parameters.componentName},
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Hello World',
  },
};`,
            language: 'typescript',
          },
        ],
        summary: `Generated ${parameters.componentName} component with TypeScript, tests, and Storybook stories.`,
      };

      setExecution(prev => ({
        ...prev,
        status: 'completed',
        results,
        logs: [...prev.logs, '🎉 Template execution completed successfully!'],
      }));

      setActiveStep(2);
      toast.success('Template executed successfully!');
    } catch (error) {
      console.error('Execution failed:', error);
      setExecution(prev => ({
        ...prev,
        status: 'failed',
        error:
          'Template execution failed. Please check your parameters and try again.',
        logs: [...prev.logs, '❌ Execution failed'],
      }));
      toast.error('Template execution failed');
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setExecution({
      status: 'idle',
      progress: 0,
      currentStep: '',
      logs: [],
    });
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const renderParameterField = (key: string, schema: any) => {
    const value = parameters[key];

    switch (schema.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={value || false}
                onChange={e => handleParameterChange(key, e.target.checked)}
              />
            }
            label={schema.title}
          />
        );

      case 'string':
        if (schema.enum) {
          return (
            <FormControl fullWidth>
              <FormLabel>{schema.title}</FormLabel>
              <Select
                value={value || ''}
                onChange={e => handleParameterChange(key, e.target.value)}
              >
                {schema.enum.map((option: string) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }

        return (
          <TextField
            fullWidth
            label={schema.title}
            value={value || ''}
            onChange={e => handleParameterChange(key, e.target.value)}
            helperText={schema.description}
            required={template?.schema.required?.includes(key)}
          />
        );

      default:
        return (
          <TextField
            fullWidth
            label={schema.title}
            value={JSON.stringify(value) || ''}
            onChange={e => {
              try {
                handleParameterChange(key, JSON.parse(e.target.value));
              } catch {
                // Handle invalid JSON gracefully
              }
            }}
            helperText={`${schema.description} (JSON format)`}
            multiline
            rows={3}
          />
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading template...</Typography>
      </Box>
    );
  }

  if (!template) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Template not found</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/')}>
          Back to Templates
        </Button>
      </Box>
    );
  }

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
        <Box>
          <Typography variant="h4" gutterBottom>
            {template.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {template.description}
          </Typography>
        </Box>
        <Chip label={template.category} variant="outlined" />
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep}>
            {steps.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {activeStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configure Parameters
            </Typography>

            <Grid container spacing={3}>
              {Object.entries(template.schema.properties).map(
                ([key, schema]: [string, any]) => (
                  <Grid item xs={12} md={6} key={key}>
                    {renderParameterField(key, schema)}
                  </Grid>
                )
              )}
            </Grid>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}
            >
              <Button onClick={() => navigate('/')}>Back to Templates</Button>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={handleExecute}
                disabled={!parameters.componentName}
              >
                Execute Template
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Executing Template
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="body2">{execution.currentStep}</Typography>
                <Typography variant="caption">{execution.progress}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={execution.progress}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Visibility />}
                onClick={() => setShowLogs(true)}
              >
                View Logs
              </Button>
              {execution.status === 'running' && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Stop />}
                  onClick={handleReset}
                >
                  Cancel
                </Button>
              )}
            </Box>

            {execution.status === 'failed' && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {execution.error}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {activeStep === 2 && execution.results && (
        <Card>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography variant="h6">Execution Results</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleReset}
                >
                  Run Again
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={() => {
                    execution.results?.files.forEach(file => {
                      downloadFile(file.name, file.content);
                    });
                  }}
                >
                  Download All
                </Button>
              </Box>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">
                {execution.results.summary}
              </Typography>
            </Alert>

            <Typography variant="subtitle1" gutterBottom>
              Generated Files ({execution.results.files.length})
            </Typography>

            <Stack spacing={2}>
              {execution.results.files.map((file, index) => (
                <Paper key={index} sx={{ p: 2 }} variant="outlined">
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Code fontSize="small" />
                      {file.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(file.content)}
                        >
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download file">
                        <IconButton
                          size="small"
                          onClick={() => downloadFile(file.name, file.content)}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'grey.50',
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {file.content}
                    </pre>
                  </Paper>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Logs Dialog */}
      <Dialog
        open={showLogs}
        onClose={() => setShowLogs(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Execution Logs</DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'grey.900',
              color: 'white',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, fontSize: '0.875rem' }}>
              {execution.logs.join('\n')}
            </pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogs(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExecutionPage;
