/**
 * @fileoverview Author profile models for marketplace
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Author profiles, verification, reputation, social links
 * Main APIs: AuthorProfile, AuthorStats, AuthorVerification interfaces
 * Constraints: Profile validation, social media integration
 * Patterns: Profile modeling, verification system, reputation scoring
 */

// Basic types and enums first
export type BadgeType =
  | 'early-adopter'
  | 'top-contributor'
  | 'popular-author'
  | 'quality-author'
  | 'community-champion'
  | 'beta-tester'
  | 'verified-developer'
  | 'enterprise-author'
  | 'milestone-templates'
  | 'milestone-downloads';

export type AuthorSortOption =
  | 'relevance'
  | 'reputation'
  | 'downloads'
  | 'templates'
  | 'followers'
  | 'recent'
  | 'rating';

export type ActivityType =
  | 'template-published'
  | 'template-updated'
  | 'template-featured'
  | 'badge-earned'
  | 'milestone-reached'
  | 'joined-marketplace'
  | 'profile-updated'
  | 'verification-received'
  | 'community-contribution';

export type ContributionType =
  | 'bug-report'
  | 'feature-request'
  | 'documentation'
  | 'translation'
  | 'community-support'
  | 'beta-testing'
  | 'tutorial'
  | 'tool-integration';

// Simple interfaces without dependencies
export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  discord?: string;
  youtube?: string;
  blog?: string;
  mastodon?: string;
  stackoverflow?: string;
}

export interface AuthorBadge {
  id: string;
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: Date;
  criteria?: string;
}

export interface AuthorNotifications {
  newFollowers: boolean;
  templateComments: boolean;
  templateRatings: boolean;
  templateDownloads: boolean;
  weeklyDigest: boolean;
  marketplaceUpdates: boolean;
  securityAlerts: boolean;
  promotionalEmails: boolean;
}

export interface AuthorStats {
  totalTemplates: number;
  publishedTemplates: number;
  draftTemplates: number;
  deprecatedTemplates: number;
  totalDownloads: number;
  monthlyDownloads: number;
  averageRating: number;
  totalReviews: number;
  followers: number;
  following: number;
  reputation: number;
  contributionScore: number;
  responseRate: number;
  responseTime: number; // in hours
  lastPublished?: Date;
  joinedDate: Date;
  featuredTemplates: string[];
  topCategories: Array<{ category: string; count: number }>;
}

export interface AuthorSearchFacets {
  verificationLevels: Array<{ level: string; count: number }>;
  locations: Array<{ location: string; count: number }>;
  companies: Array<{ company: string; count: number }>;
  badges: Array<{ badge: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
}

// Interfaces with simple dependencies
export interface AuthorVerification {
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationLevel: 'none' | 'basic' | 'premium' | 'enterprise';
  badges: AuthorBadge[];
  emailVerified: boolean;
  githubVerified: boolean;
  domainVerified: boolean;
}

export interface AuthorSettings {
  profileVisibility: 'public' | 'private' | 'verified-only';
  contactVisible: boolean;
  showStats: boolean;
  showBadges: boolean;
  emailNotifications: AuthorNotifications;
  autoPublish: boolean;
  requireApproval: boolean;
  allowFeedback: boolean;
  showSocialLinks: boolean;
}

// Main profile interface
export interface AuthorProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  avatar?: string;
  website?: string;
  location?: string;
  company?: string;
  social: SocialLinks;
  verification: AuthorVerification;
  stats: AuthorStats;
  settings: AuthorSettings;
  created: Date;
  lastActive: Date;
  featured: boolean;
  blocked: boolean;
}

// Interfaces that depend on AuthorProfile
export interface AuthorSearchQuery {
  query?: string;
  verified?: boolean;
  minReputation?: number;
  location?: string;
  company?: string;
  category?: string;
  badges?: string[];
  sortBy?: AuthorSortOption;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AuthorSearchResult {
  authors: AuthorProfile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  facets: AuthorSearchFacets;
}

export interface AuthorFollowRelation {
  followerId: string;
  followingId: string;
  followed: Date;
  notifications: boolean;
}

export interface AuthorActivity {
  id: string;
  authorId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  visibility: 'public' | 'followers' | 'private';
}

export interface AuthorContribution {
  id: string;
  authorId: string;
  type: ContributionType;
  title: string;
  description: string;
  url?: string;
  impact: number; // contribution score
  created: Date;
  approved: boolean;
  approvedBy?: string;
}

export interface AuthorReputationLog {
  id: string;
  authorId: string;
  action: string;
  points: number;
  reason: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface AuthorAnalytics {
  authorId: string;
  period: 'day' | 'week' | 'month' | 'year';
  metrics: {
    profileViews: number;
    templateViews: number;
    downloads: number;
    followers: number;
    ratings: number;
    engagement: number;
  };
  topTemplates: Array<{
    templateId: string;
    name: string;
    downloads: number;
    rating: number;
  }>;
  audience: {
    countries: Array<{ country: string; percentage: number }>;
    platforms: Array<{ platform: string; percentage: number }>;
    categories: Array<{ category: string; percentage: number }>;
  };
}
