/**
 * @fileoverview Multi-step template execution wizard
 * @lastmodified 2025-08-28T12:50:00Z
 *
 * Features: Multi-step execution, form persistence, progress tracking
 * Main APIs: TemplateWizard component with complete execution flow
 * Constraints: Requires Template with schema, handles all execution stages
 * Patterns: Wizard pattern, state persistence, component orchestration
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Alert,
  Card,
  CardContent,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Settings,
  PlayArrow,
  Code,
  CheckCircle,
  ArrowBack,
} from '@mui/icons-material';
import { Template, ExecutionRequest } from '@cursor-prompt/shared';
import { useTemplateExecution } from '../../hooks/useTemplateExecution';
import TemplateForm from './TemplateForm';
import ProgressTracker from './ProgressTracker';
import CodeViewer from '../editor/CodeViewer';

interface TemplateWizardProps {
  template: Template;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
}

interface WizardStep {
  label: string;
  description: string;
  icon: React.ReactElement;
}

const wizardSteps: WizardStep[] = [
  {
    label: 'Configure',
    description: 'Set up template parameters and options',
    icon: <Settings />,
  },
  {
    label: 'Execute',
    description: 'Run template generation with real-time progress',
    icon: <PlayArrow />,
  },
  {
    label: 'Results',
    description: 'View and download generated code',
    icon: <Code />,
  },
];

const TemplateWizard: React.FC<TemplateWizardProps> = ({
  template,
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [executionOptions] = useState({
    format: 'markdown' as const,
    includeGit: false,
    includeFiles: false,
    filePatterns: [] as string[],
    contextFiles: [] as string[],
  });

  const {
    state: executionState,
    executeTemplate,
    cancelExecution,
    clearResult,
  } = useTemplateExecution();

  // Auto-advance to results when execution completes
  useEffect(() => {
    if (executionState.stage === 'completed' && activeStep === 1) {
      setActiveStep(2);
      if (onComplete) {
        onComplete(executionState.result);
      }
    }
  }, [executionState.stage, activeStep, onComplete, executionState.result]);

  const handleNext = () => {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  };

  const handleFormSubmit = async (values: Record<string, unknown>) => {
    setFormData(values);

    // Prepare execution request
    const executionRequest: ExecutionRequest = {
      templateId: template.id,
      variables: values,
      options: executionOptions,
    };

    // Move to execution step and start execution
    handleNext();
    await executeTemplate(executionRequest);
  };

  const handleRestart = () => {
    clearResult();
    setActiveStep(0);
    setFormData({});
  };

  const handleCancelExecution = () => {
    cancelExecution();
    if (onCancel) {
      onCancel();
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            {/* Template Overview */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {template.displayName || template.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {template.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip
                    label={template.category}
                    size="small"
                    variant="outlined"
                  />
                  {template.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>

                <Typography variant="body2" color="text.secondary">
                  <strong>Author:</strong> {template.author?.name || 'Unknown'}
                  {template.author?.verified && ' ✓'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Version:</strong> {template.version || '1.0.0'}
                </Typography>
              </CardContent>
            </Card>

            {/* Template Form */}
            <TemplateForm
              schema={template.schema}
              initialValues={formData}
              onSubmit={handleFormSubmit}
              isSubmitting={executionState.isExecuting}
              submitLabel="Execute Template"
            />
          </Box>
        );

      case 1:
        return (
          <Box>
            {/* Execution Configuration Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom>
                Execution Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Template:</strong>{' '}
                {template.displayName || template.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Variables:</strong> {Object.keys(formData).length}{' '}
                configured
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Format:</strong> {executionOptions.format}
              </Typography>
            </Paper>

            {/* Progress Tracker */}
            <ProgressTracker
              state={executionState}
              onCancel={handleCancelExecution}
              templateName={template.displayName || template.name}
            />

            {/* Error Display */}
            {executionState.stage === 'error' && executionState.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Execution Failed:</strong> {executionState.error}
                </Typography>
                <Button
                  size="small"
                  onClick={() => setActiveStep(0)}
                  sx={{ mt: 1 }}
                >
                  Back to Configuration
                </Button>
              </Alert>
            )}
          </Box>
        );

      case 2: {
        const { result } = executionState;
        const hasResult = result && result.content;

        return (
          <Box>
            {/* Results Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom>
                Execution Results
              </Typography>
              {result && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Status:</strong> {result.status}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Execution Time:</strong>{' '}
                    {result.metadata?.executionTime || 0}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Content Length:</strong>{' '}
                    {result.metadata?.contentLength ||
                      result.content?.length ||
                      0}{' '}
                    characters
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Created:</strong>{' '}
                    {new Date(result.createdAt).toLocaleString()}
                  </Typography>
                </>
              )}
            </Paper>

            {/* Code Viewer */}
            {hasResult ? (
              <CodeViewer
                content={result.content}
                title="Generated Code"
                language="markdown"
                theme="dark"
                height="400px"
                readOnly
                showLineNumbers
                minimap={false}
              />
            ) : (
              <Alert severity="warning">
                No content was generated. Please check the execution logs above.
              </Alert>
            )}

            {/* Action Buttons */}
            <Box
              sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}
            >
              <Button
                variant="outlined"
                onClick={handleRestart}
                startIcon={<ArrowBack />}
              >
                Execute Another Template
              </Button>

              {hasResult && (
                <Button
                  variant="contained"
                  onClick={() => onComplete?.(result)}
                  startIcon={<CheckCircle />}
                >
                  Complete
                </Button>
              )}
            </Box>
          </Box>
        );
      }

      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Template Execution Wizard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure and execute your template with guided assistance
        </Typography>
      </Box>

      {/* Progress Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {wizardSteps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                icon={step.icon}
                error={executionState.stage === 'error' && index === 1}
              >
                <Typography variant="body1">{step.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Loading bar for active execution */}
        {executionState.isExecuting && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={executionState.progress}
            />
            <Typography
              variant="caption"
              sx={{ mt: 1, display: 'block', textAlign: 'center' }}
            >
              {executionState.message}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Step Content */}
      <Paper sx={{ p: 3 }}>{getStepContent(activeStep)}</Paper>

      {/* Navigation Buttons */}
      {activeStep < 2 && !executionState.isExecuting && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
          >
            Back
          </Button>

          {onCancel && (
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default TemplateWizard;
