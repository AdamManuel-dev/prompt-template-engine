/**
 * @fileoverview Real-time progress tracking for template execution
 * @lastmodified 2025-08-28T12:40:00Z
 *
 * Features: Progress visualization, stage indicators, cancellation
 * Main APIs: ProgressTracker component with execution state
 * Constraints: Requires ExecutionState from useTemplateExecution hook
 * Patterns: Real-time UI updates, visual progress indicators
 */

import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  PlayArrow,
  Settings,
  Code,
  CheckCircle,
  Error,
  Cancel,
} from '@mui/icons-material';
import { ExecutionState } from '../../hooks/useTemplateExecution';

interface ProgressTrackerProps {
  state: ExecutionState;
  onCancel?: () => void;
  templateName?: string;
}

const stageIcons = {
  idle: <Settings />,
  initializing: <PlayArrow />,
  processing: <Settings />,
  rendering: <Code />,
  completed: <CheckCircle />,
  error: <Error />,
};

const stageLabels = {
  idle: 'Ready',
  initializing: 'Initializing',
  processing: 'Processing Template',
  rendering: 'Generating Output',
  completed: 'Completed',
  error: 'Error',
};

const stageDescriptions = {
  idle: 'Waiting to start execution',
  initializing: 'Setting up execution environment and validating parameters',
  processing: 'Processing template logic and applying variables',
  rendering: 'Generating final output and formatting content',
  completed: 'Template execution completed successfully',
  error: 'An error occurred during execution',
};

const getActiveStep = (stage: ExecutionState['stage']): number => {
  switch (stage) {
    case 'idle':
      return -1;
    case 'initializing':
      return 0;
    case 'processing':
      return 1;
    case 'rendering':
      return 2;
    case 'completed':
      return 3;
    case 'error':
      return -1;
    default:
      return -1;
  }
};

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  state,
  onCancel,
  templateName,
}) => {
  const { isExecuting, progress, stage, message, error } = state;
  const activeStep = getActiveStep(stage);
  const isError = stage === 'error';
  const isCompleted = stage === 'completed';

  const getProgressColor = (): 'primary' | 'error' | 'success' => {
    if (isError) return 'error';
    if (isCompleted) return 'success';
    return 'primary';
  };

  const getStatusChipColor = ():
    | 'default'
    | 'primary'
    | 'success'
    | 'error'
    | 'warning' => {
    switch (stage) {
      case 'idle':
        return 'default';
      case 'initializing':
      case 'processing':
      case 'rendering':
        return 'primary';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!isExecuting && stage === 'idle') {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            {templateName ? `Executing: ${templateName}` : 'Template Execution'}
          </Typography>
          <Chip
            icon={stageIcons[stage]}
            label={stageLabels[stage]}
            color={getStatusChipColor()}
            variant={isExecuting ? 'filled' : 'outlined'}
          />
        </Box>

        {isExecuting && onCancel && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ minWidth: 50 }}
          >
            {progress}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={getProgressColor()}
            sx={{
              flexGrow: 1,
              mx: 2,
              height: 8,
              borderRadius: 4,
            }}
          />
          {isExecuting && (
            <CircularProgress size={16} color={getProgressColor()} />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary">
          {message || stageDescriptions[stage]}
        </Typography>
      </Box>

      {/* Error Message */}
      {isError && error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Execution Failed:</strong> {error}
          </Typography>
        </Alert>
      )}

      {/* Execution Steps */}
      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel
            error={stage === 'error' && activeStep <= 0}
            icon={stageIcons.initializing}
          >
            <Typography variant="body1">{stageLabels.initializing}</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              {stageDescriptions.initializing}
            </Typography>
          </StepContent>
        </Step>

        <Step>
          <StepLabel
            error={stage === 'error' && activeStep <= 1}
            icon={stageIcons.processing}
          >
            <Typography variant="body1">{stageLabels.processing}</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              {stageDescriptions.processing}
            </Typography>
          </StepContent>
        </Step>

        <Step>
          <StepLabel
            error={stage === 'error' && activeStep <= 2}
            icon={stageIcons.rendering}
          >
            <Typography variant="body1">{stageLabels.rendering}</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              {stageDescriptions.rendering}
            </Typography>
          </StepContent>
        </Step>

        <Step>
          <StepLabel
            icon={isCompleted ? stageIcons.completed : stageIcons.rendering}
          >
            <Typography variant="body1">{stageLabels.completed}</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              {stageDescriptions.completed}
            </Typography>
          </StepContent>
        </Step>
      </Stepper>

      {/* Completion Message */}
      {isCompleted && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Success!</strong> Template execution completed. You can view
            the results below.
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

export default ProgressTracker;
