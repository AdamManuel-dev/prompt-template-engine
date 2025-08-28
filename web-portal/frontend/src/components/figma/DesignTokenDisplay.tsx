/**
 * @fileoverview Design token display component for Figma integration
 * @lastmodified 2025-08-28T10:30:00Z
 *
 * Features: Token visualization, categorization, template mapping, export options
 * Main APIs: DesignTokenDisplay, TokenGroup, TokenItem, MapToTemplate
 * Constraints: Large token sets, performance optimization, visual clarity
 * Patterns: Virtualized lists, grouped display, interactive mapping
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  Alert,
  Skeleton,
  Badge,
} from '@mui/material';
import {
  ExpandMore,
  ContentCopy,
  Download,
  Visibility,
  VisibilityOff,
  Search,
  FilterList,
  Palette,
  TextFields,
  SpaceBar,
  Layers,
  Code,
  PlayArrow,
} from '@mui/icons-material';
import {
  DesignToken,
  ColorToken,
  TypographyToken,
  SpacingToken,
  FigmaTemplateParameter,
} from '@cursor-prompt/shared';

interface DesignTokenDisplayProps {
  tokens: DesignToken[];
  loading?: boolean;
  error?: string | null;
  onTokenSelect?: (token: DesignToken) => void;
  onMapToTemplate?: (mappings: FigmaTemplateParameter[]) => void;
  onExport?: (format: 'json' | 'css' | 'scss') => void;
  showMapping?: boolean;
  compact?: boolean;
  className?: string;
}

interface TokenGroup {
  type: string;
  label: string;
  icon: React.ReactElement;
  tokens: DesignToken[];
  count: number;
}

const TOKEN_TYPE_CONFIG = {
  color: {
    label: 'Colors',
    icon: <Palette />,
    color: '#f59e0b',
  },
  typography: {
    label: 'Typography',
    icon: <TextFields />,
    color: '#3b82f6',
  },
  spacing: {
    label: 'Spacing',
    icon: <SpaceBar />,
    color: '#10b981',
  },
  shadow: {
    label: 'Shadows',
    icon: <Layers />,
    color: '#8b5cf6',
  },
  border: {
    label: 'Borders',
    icon: <Code />,
    color: '#ef4444',
  },
};

export const DesignTokenDisplay: React.FC<DesignTokenDisplayProps> = ({
  tokens,
  loading = false,
  error = null,
  onTokenSelect,
  onMapToTemplate,
  onExport,
  showMapping = false,
  compact = false,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    Object.keys(TOKEN_TYPE_CONFIG)
  );
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    'color',
    'typography',
  ]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  // Group and filter tokens
  const tokenGroups = useMemo((): TokenGroup[] => {
    const filteredTokens = tokens.filter(token => {
      const matchesSearch =
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedTypes.includes(token.type);
      return matchesSearch && matchesType;
    });

    const groups: TokenGroup[] = [];
    const groupedTokens = filteredTokens.reduce(
      (acc, token) => {
        if (!acc[token.type]) {
          acc[token.type] = [];
        }
        acc[token.type].push(token);
        return acc;
      },
      {} as Record<string, DesignToken[]>
    );

    Object.entries(groupedTokens).forEach(([type, tokens]) => {
      const config = TOKEN_TYPE_CONFIG[type as keyof typeof TOKEN_TYPE_CONFIG];
      if (config && tokens.length > 0) {
        groups.push({
          type,
          label: config.label,
          icon: config.icon,
          tokens: tokens.sort((a, b) => a.name.localeCompare(b.name)),
          count: tokens.length,
        });
      }
    });

    return groups.sort((a, b) => b.count - a.count);
  }, [tokens, searchTerm, selectedTypes]);

  const handleGroupExpand = (groupType: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupType)
        ? prev.filter(type => type !== groupType)
        : [...prev, groupType]
    );
  };

  const handleTokenToggle = (tokenId: string) => {
    setSelectedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (groupType: string) => {
    const group = tokenGroups.find(g => g.type === groupType);
    if (!group) return;

    setSelectedTokens(prev => {
      const newSet = new Set(prev);
      const allSelected = group.tokens.every(token => newSet.has(token.id));

      if (allSelected) {
        // Deselect all in group
        group.tokens.forEach(token => newSet.delete(token.id));
      } else {
        // Select all in group
        group.tokens.forEach(token => newSet.add(token.id));
      }

      return newSet;
    });
  };

  const handleCopyToken = async (token: DesignToken) => {
    const value =
      typeof token.value === 'object'
        ? JSON.stringify(token.value, null, 2)
        : token.value.toString();

    await navigator.clipboard.writeText(value);
    console.log(`Copied token ${token.name}: ${value}`);
  };

  const handleExport = (format: 'json' | 'css' | 'scss') => {
    onExport?.(format);
    setExportMenuAnchor(null);
  };

  const handleMapToTemplate = () => {
    const selectedTokensList = tokens.filter(token =>
      selectedTokens.has(token.id)
    );
    const mappings: FigmaTemplateParameter[] = selectedTokensList.map(
      token => ({
        key: token.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
        value:
          typeof token.value === 'object'
            ? JSON.stringify(token.value)
            : token.value.toString(),
        source: 'design-token',
        figmaNodeId: token.figmaNodeId,
        tokenId: token.id,
      })
    );

    onMapToTemplate?.(mappings);
  };

  if (loading) {
    return (
      <Box className={className}>
        <Skeleton variant="rectangular" width="100%" height={200} />
        <Box sx={{ mt: 2 }}>
          {[...Array(3)].map((_, index) => (
            <Skeleton
              key={index}
              variant="text"
              width="100%"
              height={60}
              sx={{ mb: 1 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" className={className}>
        {error}
      </Alert>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card className={className}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Palette sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No design tokens found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Make sure your Figma file contains design tokens or try refreshing.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className={className}>
      {/* Header Controls */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Design Tokens ({tokens.length})
            </Typography>

            {selectedTokens.size > 0 && (
              <Badge badgeContent={selectedTokens.size} color="primary">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrow />}
                  onClick={handleMapToTemplate}
                  disabled={!showMapping}
                >
                  Map to Template
                </Button>
              </Badge>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={e => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
          </Box>

          {/* Search and Filter */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1 }}
            />

            <Tooltip title="Filter by type">
              <IconButton>
                <FilterList />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Type Filters */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {Object.entries(TOKEN_TYPE_CONFIG).map(([type, config]) => (
              <FormControlLabel
                key={type}
                control={
                  <Switch
                    size="small"
                    checked={selectedTypes.includes(type)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedTypes(prev => [...prev, type]);
                      } else {
                        setSelectedTypes(prev => prev.filter(t => t !== type));
                      }
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {React.cloneElement(config.icon, {
                      sx: { fontSize: 16, color: config.color },
                    })}
                    <Typography variant="body2">{config.label}</Typography>
                  </Box>
                }
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Token Groups */}
      {tokenGroups.map(group => (
        <Accordion
          key={group.type}
          expanded={expandedGroups.includes(group.type)}
          onChange={() => handleGroupExpand(group.type)}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexGrow: 1,
              }}
            >
              {React.cloneElement(group.icon, {
                sx: {
                  color:
                    TOKEN_TYPE_CONFIG[
                      group.type as keyof typeof TOKEN_TYPE_CONFIG
                    ]?.color,
                },
              })}
              <Typography variant="h6">{group.label}</Typography>
              <Chip label={group.count} size="small" variant="outlined" />
              {showMapping && (
                <Button
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    handleSelectAll(group.type);
                  }}
                  sx={{ ml: 'auto', mr: 1 }}
                >
                  {group.tokens.every(token => selectedTokens.has(token.id))
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <List dense={compact}>
              {group.tokens.map(token => (
                <TokenItem
                  key={token.id}
                  token={token}
                  selected={selectedTokens.has(token.id)}
                  showMapping={showMapping}
                  compact={compact}
                  onToggle={() => handleTokenToggle(token.id)}
                  onSelect={() => onTokenSelect?.(token)}
                  onCopy={() => handleCopyToken(token)}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
        <MenuItem onClick={() => handleExport('css')}>Export as CSS</MenuItem>
        <MenuItem onClick={() => handleExport('scss')}>Export as SCSS</MenuItem>
      </Menu>
    </Box>
  );
};

interface TokenItemProps {
  token: DesignToken;
  selected: boolean;
  showMapping: boolean;
  compact: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onCopy: () => void;
}

const TokenItem: React.FC<TokenItemProps> = ({
  token,
  selected,
  showMapping,
  compact,
  onToggle,
  onSelect,
  onCopy,
}) => {
  const renderTokenValue = () => {
    switch (token.type) {
      case 'color':
        const colorToken = token as ColorToken;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: colorToken.value,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            />
            <Typography variant="body2" fontFamily="monospace">
              {colorToken.value}
            </Typography>
          </Box>
        );

      case 'typography':
        const typographyToken = token as TypographyToken;
        const typoValue = typographyToken.value;
        return (
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: typoValue.fontFamily,
                fontSize: Math.min(typoValue.fontSize, 16),
                fontWeight: typoValue.fontWeight,
                lineHeight: typoValue.lineHeight,
              }}
            >
              {typoValue.fontFamily} {typoValue.fontSize}px
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              fontFamily="monospace"
            >
              {typoValue.fontWeight} / {typoValue.lineHeight}
            </Typography>
          </Box>
        );

      case 'spacing':
        const spacingToken = token as SpacingToken;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: Math.min(spacingToken.value * 2, 60),
                height: 8,
                backgroundColor: 'primary.main',
                borderRadius: 1,
              }}
            />
            <Typography variant="body2" fontFamily="monospace">
              {spacingToken.value}px
            </Typography>
          </Box>
        );

      default:
        return (
          <Typography variant="body2" fontFamily="monospace">
            {typeof token.value === 'object'
              ? JSON.stringify(token.value)
              : token.value.toString()}
          </Typography>
        );
    }
  };

  return (
    <ListItem
      button={!showMapping}
      selected={selected}
      onClick={showMapping ? onToggle : onSelect}
      sx={{
        borderRadius: 1,
        mb: compact ? 0.5 : 1,
        ...(selected && {
          backgroundColor: 'action.selected',
          '&:hover': {
            backgroundColor: 'action.selected',
          },
        }),
      }}
    >
      {showMapping && (
        <Switch
          edge="start"
          checked={selected}
          onClick={e => e.stopPropagation()}
          onChange={onToggle}
          size="small"
        />
      )}

      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2">{token.name}</Typography>
            {token.category && (
              <Chip
                label={token.category}
                size="small"
                variant="outlined"
                sx={{ height: 20 }}
              />
            )}
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            {renderTokenValue()}
            {token.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {token.description}
              </Typography>
            )}
          </Box>
        }
      />

      <ListItemSecondaryAction>
        <Tooltip title="Copy value">
          <IconButton edge="end" size="small" onClick={onCopy}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
