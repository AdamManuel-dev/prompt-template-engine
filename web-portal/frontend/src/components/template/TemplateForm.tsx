/**
 * @fileoverview Dynamic form generation from template schemas
 * @lastmodified 2025-08-28T12:30:00Z
 *
 * Features: Dynamic field generation, validation, form state management
 * Main APIs: TemplateForm component with onSubmit callback
 * Constraints: Supports all TemplateVariable types, real-time validation
 * Patterns: Controlled components, React Hook Form integration
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import {
  Box,
  TextField,
  FormControl,
  FormLabel,
  FormControlLabel,
  FormHelperText,
  Switch,
  Select,
  MenuItem,
  Chip,
  Typography,
  Button,
  Alert,
  Grid,
  Paper,
} from '@mui/material';
import { TemplateVariable, TemplateSchema } from '@cursor-prompt/shared';

interface TemplateFormProps {
  schema: TemplateSchema;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

interface FormFieldProps {
  variable: TemplateVariable;
  control: any;
  errors: any;
}

const FormField: React.FC<FormFieldProps> = ({ variable, control, errors }) => {
  const { name, type, description, required, options, validation } = variable;
  const error = errors[name];

  const renderField = () => {
    switch (type) {
      case 'string':
        if (options && options.length > 0) {
          // Select dropdown
          return (
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!error}>
                  <FormLabel required={required}>
                    {variable.displayName || name}
                  </FormLabel>
                  <Select
                    {...field}
                    displayEmpty
                    renderValue={value => value || `Select ${name}`}
                  >
                    <MenuItem value="">
                      <em>Select {name}</em>
                    </MenuItem>
                    {options.map(option => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                  {description && (
                    <FormHelperText>{description}</FormHelperText>
                  )}
                  {error && (
                    <FormHelperText error>{error.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          );
        }
        // Text field
        return (
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={variable.displayName || name}
                required={required}
                error={!!error}
                helperText={error?.message || description}
                multiline={
                  validation?.maxLength ? validation.maxLength > 100 : false
                }
                rows={
                  validation?.maxLength && validation.maxLength > 100 ? 4 : 1
                }
                inputProps={{
                  minLength: validation?.minLength,
                  maxLength: validation?.maxLength,
                  pattern: validation?.pattern,
                }}
              />
            )}
          />
        );

      case 'number':
        return (
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={variable.displayName || name}
                required={required}
                error={!!error}
                helperText={error?.message || description}
                inputProps={{
                  min: validation?.min,
                  max: validation?.max,
                  step: type === 'number' ? 'any' : 1,
                }}
              />
            )}
          />
        );

      case 'boolean':
        return (
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!error}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value || false}
                      onChange={e => field.onChange(e.target.checked)}
                    />
                  }
                  label={variable.displayName || name}
                />
                {description && <FormHelperText>{description}</FormHelperText>}
                {error && (
                  <FormHelperText error>{error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        );

      case 'array':
        return (
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!error}>
                <FormLabel required={required}>
                  {variable.displayName || name}
                </FormLabel>
                <TextField
                  value={
                    Array.isArray(field.value) ? field.value.join(', ') : ''
                  }
                  onChange={e => {
                    const values = e.target.value
                      .split(',')
                      .map(v => v.trim())
                      .filter(v => v.length > 0);
                    field.onChange(values);
                  }}
                  fullWidth
                  placeholder="Enter comma-separated values"
                  helperText={description || 'Enter values separated by commas'}
                />
                {Array.isArray(field.value) && field.value.length > 0 && (
                  <Box
                    sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                  >
                    {field.value.map((value, index) => (
                      <Chip
                        key={index}
                        label={value}
                        size="small"
                        onDelete={() => {
                          const newValues = [...field.value];
                          newValues.splice(index, 1);
                          field.onChange(newValues);
                        }}
                      />
                    ))}
                  </Box>
                )}
                {error && (
                  <FormHelperText error>{error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        );

      case 'object':
        return (
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={
                  typeof field.value === 'object'
                    ? JSON.stringify(field.value, null, 2)
                    : field.value || ''
                }
                onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    field.onChange(parsed);
                  } catch {
                    field.onChange(e.target.value);
                  }
                }}
                fullWidth
                multiline
                rows={4}
                label={variable.displayName || name}
                required={required}
                error={!!error}
                helperText={error?.message || description || 'Enter valid JSON'}
              />
            )}
          />
        );

      default:
        return (
          <TextField
            disabled
            fullWidth
            label={variable.displayName || name}
            value="Unsupported field type"
            helperText={`Field type '${type}' is not supported`}
          />
        );
    }
  };

  return (
    <Grid item xs={12} sm={type === 'boolean' ? 6 : 12}>
      {renderField()}
    </Grid>
  );
};

const TemplateForm: React.FC<TemplateFormProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Execute Template',
}) => {
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};

    schema.variables.forEach(variable => {
      const key = variable.name;
      if (initialValues[key] !== undefined) {
        values[key] = initialValues[key];
      } else if (variable.defaultValue !== undefined) {
        values[key] = variable.defaultValue;
      } else {
        // Set appropriate default values based on type
        switch (variable.type) {
          case 'boolean':
            values[key] = false;
            break;
          case 'array':
            values[key] = [];
            break;
          case 'object':
            values[key] = {};
            break;
          case 'number':
            values[key] = variable.validation?.min || 0;
            break;
          default:
            values[key] = '';
        }
      }
    });

    return values;
  }, [schema.variables, initialValues]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm({
    defaultValues,
    mode: 'onChange',
  });

  // Reset form when schema changes
  useEffect(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

  const onSubmitForm = (data: FieldValues) => {
    onSubmit(data);
  };

  const requiredVariables = schema.variables.filter(v => v.required);
  const optionalVariables = schema.variables.filter(v => !v.required);
  const hasExamples = schema.examples && schema.examples.length > 0;

  return (
    <Box>
      {/* Schema Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          Template Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Fill out the form below to configure and execute this template.
          Required fields are marked with an asterisk (*).
        </Typography>
        {schema.dependencies && schema.dependencies.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Dependencies:</strong> {schema.dependencies.join(', ')}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Examples Section */}
      {hasExamples && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Examples
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {schema.examples.map((example, index) => (
              <Chip
                key={index}
                label={example.name}
                clickable
                onClick={() =>
                  reset({ ...defaultValues, ...example.variables })
                }
                sx={{ mb: 1 }}
              />
            ))}
          </Box>
        </Paper>
      )}

      <form onSubmit={handleSubmit(onSubmitForm)}>
        {/* Required Fields */}
        {requiredVariables.length > 0 && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="error">
              Required Fields
            </Typography>
            <Grid container spacing={2}>
              {requiredVariables.map(variable => (
                <FormField
                  key={variable.name}
                  variable={variable}
                  control={control}
                  errors={errors}
                />
              ))}
            </Grid>
          </Paper>
        )}

        {/* Optional Fields */}
        {optionalVariables.length > 0 && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Optional Fields
            </Typography>
            <Grid container spacing={2}>
              {optionalVariables.map(variable => (
                <FormField
                  key={variable.name}
                  variable={variable}
                  control={control}
                  errors={errors}
                />
              ))}
            </Grid>
          </Paper>
        )}

        {/* Submit Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!isValid || isSubmitting}
            sx={{ minWidth: 200 }}
          >
            {isSubmitting ? 'Executing...' : submitLabel}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default TemplateForm;
