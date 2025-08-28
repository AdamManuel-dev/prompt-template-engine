/**
 * @fileoverview Figma URL input component with validation and preview
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: URL validation, file preview, error handling, loading states
 * Main APIs: validateFigmaUrl, fetchFileInfo, onUrlChange
 * Constraints: Figma API rate limits, requires valid access token
 * Patterns: Real-time validation, debounced API calls, graceful fallbacks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Help,
  Refresh,
  OpenInNew,
  ContentCopy
} from '@mui/icons-material';
import { FigmaUrlInfo, FigmaFileInfo, FigmaApiError } from '@cursor-prompt/shared';
import { useFigmaApi } from '../../hooks/useFigmaApi';
import { useDebounce } from '../../hooks/useDebounce';

interface FigmaUrlInputProps {
  value?: string;
  onChange?: (urlInfo: FigmaUrlInfo, fileInfo: FigmaFileInfo | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showPreview?: boolean;
  showHelpText?: boolean;
  variant?: 'outlined' | 'filled' | 'standard';
  fullWidth?: boolean;
  className?: string;
}

const FIGMA_URL_PATTERNS = [
  /^https:\/\/www\.figma\.com\/file\/([a-zA-Z0-9]+)\/(.*)$/,
  /^https:\/\/www\.figma\.com\/design\/([a-zA-Z0-9]+)\/(.*)$/,
  /^https:\/\/figma\.com\/file\/([a-zA-Z0-9]+)\/(.*)$/,
  /^https:\/\/figma\.com\/design\/([a-zA-Z0-9]+)\/(.*)$/
];

const EXAMPLE_URLS = [
  'https://www.figma.com/file/abc123/Project-Name',
  'https://www.figma.com/design/xyz789/Design-System'
];

export const FigmaUrlInput: React.FC<FigmaUrlInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Paste Figma file URL here...',
  disabled = false,
  autoFocus = false,
  showPreview = true,
  showHelpText = true,
  variant = 'outlined',
  fullWidth = true,
  className
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [urlInfo, setUrlInfo] = useState<FigmaUrlInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { validateUrl, getFileInfo, loading, error } = useFigmaApi();
  const debouncedUrl = useDebounce(inputValue, 500);

  // Validate Figma URL format
  const validateFigmaUrl = useCallback((url: string): FigmaUrlInfo => {
    if (!url.trim()) {
      return {
        isValid: false,
        fileId: null,
        nodeId: null,
        originalUrl: url,
        cleanUrl: null,
        error: 'URL is required'
      };
    }

    // Check against known patterns
    let fileId: string | null = null;
    let nodeId: string | null = null;

    for (const pattern of FIGMA_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match) {
        fileId = match[1];
        break;
      }
    }

    if (!fileId) {
      return {
        isValid: false,
        fileId: null,
        nodeId: null,
        originalUrl: url,
        cleanUrl: null,
        error: 'Invalid Figma URL format'
      };
    }

    // Extract node ID if present
    const nodeMatch = url.match(/[?&]node-id=([^&]+)/);
    if (nodeMatch) {
      nodeId = decodeURIComponent(nodeMatch[1]);
    }

    // Create clean URL
    const cleanUrl = url.includes('/design/') 
      ? `https://www.figma.com/design/${fileId}/`
      : `https://www.figma.com/file/${fileId}/`;

    return {
      isValid: true,
      fileId,
      nodeId,
      originalUrl: url,
      cleanUrl,
      error: null
    };
  }, []);

  // Handle URL validation and file info fetching
  useEffect(() => {
    if (!debouncedUrl.trim()) {
      setUrlInfo(null);
      setValidationError(null);
      onChange?.(
        {
          isValid: false,
          fileId: null,
          nodeId: null,
          originalUrl: debouncedUrl,
          cleanUrl: null
        },
        null
      );
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    const urlValidation = validateFigmaUrl(debouncedUrl);
    setUrlInfo(urlValidation);

    if (!urlValidation.isValid) {
      setValidationError(urlValidation.error || 'Invalid URL');
      setIsValidating(false);
      onChange?.(urlValidation, null);
      return;
    }

    // Fetch file info from API
    if (urlValidation.fileId) {
      getFileInfo(urlValidation.fileId)
        .then((fileInfo) => {
          setIsValidating(false);
          onChange?.(urlValidation, fileInfo);
        })
        .catch((err) => {
          setIsValidating(false);
          const errorMessage = err instanceof FigmaApiError 
            ? err.message 
            : 'Failed to fetch file information';
          setValidationError(errorMessage);
          onChange?.(urlValidation, null);
        });
    }
  }, [debouncedUrl, validateFigmaUrl, getFileInfo, onChange]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleRefresh = () => {
    if (urlInfo?.fileId) {
      setIsValidating(true);
      getFileInfo(urlInfo.fileId, true) // Force refresh
        .then((fileInfo) => {
          setIsValidating(false);
          onChange?.(urlInfo, fileInfo);
        })
        .catch((err) => {
          setIsValidating(false);
          const errorMessage = err instanceof FigmaApiError 
            ? err.message 
            : 'Failed to refresh file information';
          setValidationError(errorMessage);
        });
    }
  };

  const handleCopyCleanUrl = () => {
    if (urlInfo?.cleanUrl) {
      navigator.clipboard.writeText(urlInfo.cleanUrl);
    }
  };

  const handleOpenInFigma = () => {
    if (urlInfo?.originalUrl) {
      window.open(urlInfo.originalUrl, '_blank');
    }
  };

  const getValidationIcon = () => {
    if (isValidating || loading) {
      return <CircularProgress size={20} />;
    }
    if (validationError || error) {
      return <Error color="error" />;
    }
    if (urlInfo?.isValid) {
      return <CheckCircle color="success" />;
    }
    return null;
  };

  const getHelperText = () => {
    if (validationError || error) {
      return validationError || error;
    }
    if (urlInfo?.isValid && urlInfo.fileId) {
      return `File ID: ${urlInfo.fileId}${urlInfo.nodeId ? ` | Node: ${urlInfo.nodeId}` : ''}`;
    }
    if (showHelpText) {
      return 'Supported: figma.com/file/... or figma.com/design/... URLs';
    }
    return '';
  };

  return (
    <Box className={className}>
      <TextField
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        variant={variant}
        fullWidth={fullWidth}
        error={!!(validationError || error)}
        helperText={getHelperText()}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {getValidationIcon()}
              {urlInfo?.isValid && (
                <>
                  <Tooltip title="Refresh file info">
                    <IconButton
                      onClick={handleRefresh}
                      disabled={isValidating || loading}
                      size="small"
                    >
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy clean URL">
                    <IconButton
                      onClick={handleCopyCleanUrl}
                      disabled={!urlInfo.cleanUrl}
                      size="small"
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open in Figma">
                    <IconButton
                      onClick={handleOpenInFigma}
                      size="small"
                    >
                      <OpenInNew />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </InputAdornment>
          )
        }}
      />

      {showHelpText && !inputValue && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <Help fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            Example URLs:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 3 }}>
            {EXAMPLE_URLS.map((example, index) => (
              <Typography
                key={index}
                variant="body2"
                color="text.secondary"
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  '&:hover': { color: 'primary.main' }
                }}
                onClick={() => setInputValue(example)}
              >
                {example}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {/* File Preview Card */}
      {showPreview && urlInfo?.isValid && !isValidating && !loading && (
        <FigmaFilePreview 
          fileInfo={null} // Will be passed from parent
          urlInfo={urlInfo}
          onRefresh={handleRefresh}
        />
      )}

      {/* Error Alert */}
      {(validationError || error) && (
        <Alert 
          severity="error" 
          sx={{ mt: 1 }}
          action={
            urlInfo?.isValid && (
              <IconButton
                color="inherit"
                size="small"
                onClick={handleRefresh}
                disabled={isValidating || loading}
              >
                <Refresh />
              </IconButton>
            )
          }
        >
          {validationError || error}
        </Alert>
      )}
    </Box>
  );
};

interface FigmaFilePreviewProps {
  fileInfo: FigmaFileInfo | null;
  urlInfo: FigmaUrlInfo;
  onRefresh?: () => void;
}

const FigmaFilePreview: React.FC<FigmaFilePreviewProps> = ({
  fileInfo,
  urlInfo,
  onRefresh
}) => {
  if (!urlInfo.isValid) return null;

  return (
    <Card sx={{ mt: 2 }}>
      {fileInfo?.thumbnailUrl && (
        <CardMedia
          component="img"
          height="140"
          image={fileInfo.thumbnailUrl}
          alt={`${fileInfo.name} preview`}
          sx={{
            objectFit: 'cover',
            backgroundColor: 'grey.100'
          }}
        />
      )}
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {fileInfo?.name || 'Loading...'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`File ID: ${urlInfo.fileId}`}
              size="small"
              variant="outlined"
            />
            {urlInfo.nodeId && (
              <Chip 
                label={`Node: ${urlInfo.nodeId}`}
                size="small"
                variant="outlined"
                color="primary"
              />
            )}
          </Box>
        </Box>
        
        {fileInfo && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Version: {fileInfo.version}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last modified: {new Date(fileInfo.lastModified).toLocaleDateString()}
            </Typography>
            {onRefresh && (
              <IconButton
                onClick={onRefresh}
                size="small"
                sx={{ ml: 'auto' }}
              >
                <Refresh />
              </IconButton>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};