/**
 * @fileoverview Template catalog page with search, filtering, and grid view
 * @lastmodified 2025-08-28T12:10:00Z
 *
 * Features: Template search, category filtering, sorting, pagination
 * Main APIs: Template search, category filtering, template metadata
 * Constraints: React Query caching, Material UI components
 * Patterns: Search and filter pattern, card grid layout, pagination
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  Sort as SortIcon,
  PlayArrow as ExecuteIcon,
  Visibility as ViewIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { Template } from '@cursor-prompt/shared';
import apiClient from '../../services/api-client';

interface FilterState {
  search: string;
  category: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

const ITEMS_PER_PAGE = 12;

const TemplateCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Fetch templates
  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiClient.getTemplates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(templates.map(t => t.category))];
    return uniqueCategories.sort();
  }, [templates]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(
        template =>
          template.name.toLowerCase().includes(searchTerm) ||
          template.description.toLowerCase().includes(searchTerm) ||
          (template.tags &&
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    }

    // Apply category filter
    if (filters.category) {
      result = result.filter(
        template => template.category === filters.category
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'popularity': {
          // Mock popularity based on category (featured > popular > others)
          const getPopularityScore = (template: Template) => {
            if (template.category === 'featured') return 3;
            if (template.category === 'popular') return 2;
            return 1;
          };
          comparison = getPopularityScore(a) - getPopularityScore(b);
          break;
        }
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [templates, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleFilterChange =
    (key: keyof FilterState) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
    ) => {
      const { value } = event.target;
      setFilters(prev => ({ ...prev, [key]: value }));
      setCurrentPage(1); // Reset to first page when filtering
    };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavorite = (templateId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(templateId)) {
        newFavorites.delete(templateId);
      } else {
        newFavorites.add(templateId);
      }
      return newFavorites;
    });
  };

  const getCategoryColor = (
    category: string
  ): 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    switch (category.toLowerCase()) {
      case 'featured':
        return 'primary';
      case 'popular':
        return 'success';
      case 'web':
        return 'secondary';
      case 'api':
        return 'warning';
      case 'documentation':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const getTemplateIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'featured':
        return '⭐';
      case 'popular':
        return '🔥';
      case 'web':
        return '🌐';
      case 'api':
        return '🔌';
      case 'documentation':
        return '📝';
      default:
        return '📄';
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        Failed to load templates. Please try again.
        <Button onClick={() => refetch()} sx={{ ml: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h1">
            Template Catalog
          </Typography>
          <Tooltip title="Refresh templates">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Browse and execute templates to generate code, documentation, and more
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search templates"
                value={filters.search}
                onChange={handleFilterChange('search')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  onChange={handleFilterChange('category')}
                  label="Category"
                  startAdornment={<CategoryIcon sx={{ mr: 1 }} />}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>
                      {getTemplateIcon(category)} {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sortBy}
                  onChange={handleFilterChange('sortBy')}
                  label="Sort By"
                  startAdornment={<SortIcon sx={{ mr: 1 }} />}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="createdAt">Created Date</MenuItem>
                  <MenuItem value="updatedAt">Last Updated</MenuItem>
                  <MenuItem value="popularity">Popularity</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.sortOrder}
                  onChange={handleFilterChange('sortOrder')}
                  label="Order"
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Results count */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {paginatedTemplates.length} of {filteredTemplates.length}{' '}
              templates
            </Typography>
            {filters.search && (
              <Chip
                label={`Search: "${filters.search}"`}
                onDelete={() => setFilters(prev => ({ ...prev, search: '' }))}
                size="small"
              />
            )}
            {filters.category && (
              <Chip
                label={`Category: ${filters.category}`}
                onDelete={() => setFilters(prev => ({ ...prev, category: '' }))}
                size="small"
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton
                    variant="text"
                    width="40%"
                    height={24}
                    sx={{ mb: 1 }}
                  />
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="80%" height={20} />
                </CardContent>
                <CardActions>
                  <Skeleton variant="rectangular" width={80} height={32} />
                  <Skeleton variant="rectangular" width={80} height={32} />
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : paginatedTemplates.length > 0 ? (
        <Fade in={true}>
          <Grid container spacing={3}>
            {paginatedTemplates.map(template => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  className="template-card"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onClick={() => navigate(`/templates/${template.id}`)}
                >
                  {/* Category badge */}
                  <Box
                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                  >
                    <Chip
                      label={template.category}
                      size="small"
                      color={getCategoryColor(template.category)}
                      variant="filled"
                    />
                  </Box>

                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1 }}
                      >
                        {getTemplateIcon(template.category)} {template.name}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {template.description}
                    </Typography>

                    {/* Tags */}
                    {template.tags && template.tags.length > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mb: 2,
                        }}
                      >
                        {template.tags.slice(0, 3).map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                        {template.tags.length > 3 && (
                          <Chip
                            label={`+${template.tags.length - 3}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                      </Box>
                    )}

                    {/* Metadata */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                      }}
                    >
                      <ScheduleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      <Typography variant="caption">
                        Updated{' '}
                        {formatDistanceToNow(new Date(template.updatedAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
                    <Box>
                      <Button
                        size="small"
                        startIcon={<ViewIcon />}
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/templates/${template.id}`);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ExecuteIcon />}
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/templates/${template.id}/execute`);
                        }}
                      >
                        Execute
                      </Button>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        toggleFavorite(template.id);
                      }}
                      color={favorites.has(template.id) ? 'primary' : 'default'}
                    >
                      {favorites.has(template.id) ? (
                        <FavoriteIcon />
                      ) : (
                        <FavoriteBorderIcon />
                      )}
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Fade>
      ) : (
        <Alert severity="info">
          No templates found matching your criteria. Try adjusting your search
          or filters.
        </Alert>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}
    </Box>
  );
};

export default TemplateCatalogPage;
