/**
 * @fileoverview Figma preview component with screenshot and visual context
 * @lastmodified 2025-08-28T10:30:00Z
 *
 * Features: Screenshot display, zoom controls, node highlighting, error handling
 * Main APIs: FigmaPreview, PreviewControls, ZoomableImage, NodeSelector
 * Constraints: Image loading performance, zoom functionality, mobile responsive
 * Patterns: Progressive loading, error boundaries, touch gestures
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Slider,
  Skeleton,
  Chip,
  Fade,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  ZoomOutMap,
  Refresh,
  Download,
  OpenInNew,
  Fullscreen,
  FullscreenExit,
  PhotoCamera,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  FigmaPreview as FigmaPreviewType,
  FigmaApiError,
} from '@cursor-prompt/shared';
import { useFigmaApi } from '../../hooks/useFigmaApi';

interface FigmaPreviewProps {
  fileId: string;
  nodeId?: string;
  preview?: FigmaPreviewType | null;
  loading?: boolean;
  error?: string | null;
  onPreviewLoad?: (preview: FigmaPreviewType) => void;
  onError?: (error: string) => void;
  showControls?: boolean;
  showFullscreenButton?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

interface PreviewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
  dragStart: { x: number; y: number };
  isFullscreen: boolean;
}

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

export const FigmaPreview: React.FC<FigmaPreviewProps> = ({
  fileId,
  nodeId,
  preview,
  loading = false,
  error = null,
  onPreviewLoad,
  onError,
  showControls = true,
  showFullscreenButton = true,
  maxWidth = 800,
  maxHeight = 600,
  className,
}) => {
  const [previewState, setPreviewState] = useState<PreviewState>({
    zoom: DEFAULT_ZOOM,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    isFullscreen: false,
  });

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { getPreview, loading: apiLoading, error: apiError } = useFigmaApi();

  // Load preview if not provided
  useEffect(() => {
    if (!preview && !loading && !error && fileId) {
      loadPreview();
    }
  }, [fileId, nodeId, preview, loading, error]);

  const loadPreview = async () => {
    try {
      const previewResult = await getPreview(fileId, nodeId, {
        scale: 2,
        format: 'png',
      });
      onPreviewLoad?.(previewResult);
    } catch (err) {
      const errorMessage =
        err instanceof FigmaApiError ? err.message : 'Failed to load preview';
      onError?.(errorMessage);
    }
  };

  const handleZoomIn = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + ZOOM_STEP, MAX_ZOOM),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - ZOOM_STEP, MIN_ZOOM),
    }));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      zoom: DEFAULT_ZOOM,
      offsetX: 0,
      offsetY: 0,
    }));
  }, []);

  const handleZoomChange = useCallback(
    (_event: Event, newValue: number | number[]) => {
      const zoom = Array.isArray(newValue) ? newValue[0] : newValue;
      setPreviewState(prev => ({
        ...prev,
        zoom: zoom / 100, // Convert percentage to decimal
      }));
    },
    []
  );

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left mouse button

    event.preventDefault();
    setPreviewState(prev => ({
      ...prev,
      isDragging: true,
      dragStart: {
        x: event.clientX - prev.offsetX,
        y: event.clientY - prev.offsetY,
      },
    }));
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!previewState.isDragging) return;

      event.preventDefault();
      setPreviewState(prev => ({
        ...prev,
        offsetX: event.clientX - prev.dragStart.x,
        offsetY: event.clientY - prev.dragStart.y,
      }));
    },
    [previewState.isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      isDragging: false,
    }));
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();

      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, previewState.zoom + delta)
      );

      setPreviewState(prev => ({
        ...prev,
        zoom: newZoom,
      }));
    },
    [previewState.zoom]
  );

  const handleFullscreenToggle = useCallback(() => {
    setPreviewState(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen,
    }));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!preview?.imageUrl) return;

    try {
      const response = await fetch(preview.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `figma-preview-${fileId}${nodeId ? `-${nodeId}` : ''}.${preview.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download preview:', error);
    }
  }, [preview, fileId, nodeId]);

  const handleOpenInFigma = useCallback(() => {
    const baseUrl = `https://www.figma.com/file/${fileId}`;
    const url = nodeId ? `${baseUrl}?node-id=${nodeId}` : baseUrl;
    window.open(url, '_blank');
  }, [fileId, nodeId]);

  const handleRefresh = useCallback(() => {
    setImageLoaded(false);
    setImageError(false);
    loadPreview();
  }, [loadPreview]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewState.isFullscreen) return;

      switch (event.key) {
        case 'Escape':
          handleFullscreenToggle();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleZoomReset();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    previewState.isFullscreen,
    handleFullscreenToggle,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  ]);

  const isLoading = loading || apiLoading;
  const displayError = error || apiError;

  if (displayError) {
    return (
      <Card className={className}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error" gutterBottom>
            Preview Error
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {displayError}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent>
          <Skeleton variant="rectangular" width="100%" height={maxHeight / 2} />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton
              variant="rectangular"
              width={100}
              height={40}
              sx={{ ml: 'auto' }}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className={className}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <PhotoCamera sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Preview Available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Unable to generate preview for this Figma file.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadPreview}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previewContent = (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: previewState.isDragging ? 'grabbing' : 'grab',
        maxWidth: previewState.isFullscreen ? '100vw' : maxWidth,
        maxHeight: previewState.isFullscreen ? '100vh' : maxHeight,
        width: '100%',
        height: previewState.isFullscreen ? '100vh' : 'auto',
        backgroundColor: 'grey.100',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <Fade in={imageLoaded} timeout={300}>
        <Box
          component="img"
          ref={imageRef}
          src={preview.imageUrl}
          alt="Figma preview"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(${-50 + (previewState.offsetX / (containerRef.current?.offsetWidth ?? 1)) * 100}%, ${-50 + (previewState.offsetY / (containerRef.current?.offsetHeight ?? 1)) * 100}%) scale(${previewState.zoom})`,
            transformOrigin: 'center',
            maxWidth: 'none',
            maxHeight: 'none',
            userSelect: 'none',
            pointerEvents: 'none',
            transition: previewState.isDragging
              ? 'none'
              : 'transform 0.2s ease-out',
          }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      </Fade>

      {!imageLoaded && !imageError && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Skeleton variant="rectangular" width={400} height={300} />
        </Box>
      )}

      {imageError && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
          <Typography variant="body2" color="error">
            Failed to load image
          </Typography>
        </Box>
      )}
    </Box>
  );

  const controls = showControls && (
    <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Zoom out">
          <IconButton
            onClick={handleZoomOut}
            disabled={previewState.zoom <= MIN_ZOOM}
          >
            <ZoomOut />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 100, mx: 1 }}>
          <Slider
            value={previewState.zoom * 100}
            onChange={handleZoomChange}
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={ZOOM_STEP * 100}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={value => `${Math.round(value)}%`}
          />
        </Box>

        <Tooltip title="Zoom in">
          <IconButton
            onClick={handleZoomIn}
            disabled={previewState.zoom >= MAX_ZOOM}
          >
            <ZoomIn />
          </IconButton>
        </Tooltip>

        <Tooltip title="Reset zoom">
          <IconButton onClick={handleZoomReset}>
            <ZoomOutMap />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={`${Math.round(previewState.zoom * 100)}%`}
          size="small"
          variant="outlined"
        />

        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} size="small">
            <Refresh />
          </IconButton>
        </Tooltip>

        <Tooltip title="Download">
          <IconButton onClick={handleDownload} size="small">
            <Download />
          </IconButton>
        </Tooltip>

        <Tooltip title="Open in Figma">
          <IconButton onClick={handleOpenInFigma} size="small">
            <OpenInNew />
          </IconButton>
        </Tooltip>

        {showFullscreenButton && (
          <Tooltip
            title={previewState.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <IconButton onClick={handleFullscreenToggle} size="small">
              {previewState.isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </CardActions>
  );

  if (previewState.isFullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'background.paper',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flexGrow: 1 }}>{previewContent}</Box>
        {controls}
      </Box>
    );
  }

  return (
    <Card className={className}>
      <CardContent sx={{ p: 0 }}>{previewContent}</CardContent>
      {controls}
    </Card>
  );
};
