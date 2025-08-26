/**
 * @fileoverview Version management for template marketplace
 * @lastmodified 2025-08-25T21:44:14-05:00
 *
 * Features: Semantic versioning, version comparison, update detection
 * Main APIs: compareVersions(), isCompatible(), findUpdates(), resolveVersion()
 * Constraints: Semantic versioning compliance, version range parsing
 * Patterns: Version management, semantic versioning, dependency resolution
 */

export type VersionOperator =
  | 'exact' // 1.2.3
  | 'gte' // >=1.2.3
  | 'lte' // <=1.2.3
  | 'gt' // >1.2.3
  | 'lt' // <1.2.3
  | 'caret' // ^1.2.3
  | 'tilde' // ~1.2.3
  | 'range'; // 1.2.3 - 1.5.0

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export interface VersionRange {
  operator: VersionOperator;
  version: VersionInfo;
  raw: string;
}

export class VersionManager {
  private static readonly VERSION_REGEX =
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;

  private static readonly RANGE_REGEX = /^([~^><=]+)?(.+)$/;

  /**
   * Parse version string into VersionInfo
   */
  // eslint-disable-next-line class-methods-use-this
  parseVersion(version: string): VersionInfo {
    const match = version.match(VersionManager.VERSION_REGEX);

    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5],
      raw: version,
    };
  }

  /**
   * Parse version range string
   */
  parseRange(range: string): VersionRange {
    const trimmed = range.trim();

    // Handle range operator (1.2.3 - 1.5.0)
    if (trimmed.includes(' - ')) {
      const [start] = trimmed.split(' - ').map(v => v.trim());
      return {
        operator: 'range',
        version: this.parseVersion(start),
        raw: range,
      };
    }

    const match = trimmed.match(VersionManager.RANGE_REGEX);
    if (!match) {
      throw new Error(`Invalid version range: ${range}`);
    }

    const operator = this.getOperator(match[1] || '');
    const version = this.parseVersion(match[2]);

    return {
      operator,
      version,
      raw: range,
    };
  }

  /**
   * Get operator from prefix
   */
  // eslint-disable-next-line class-methods-use-this
  private getOperator(prefix: string): VersionOperator {
    switch (prefix) {
      case '>=':
        return 'gte';
      case '<=':
        return 'lte';
      case '>':
        return 'gt';
      case '<':
        return 'lt';
      case '^':
        return 'caret';
      case '~':
        return 'tilde';
      case '':
        return 'exact';
      default:
        throw new Error(`Unknown version operator: ${prefix}`);
    }
  }

  /**
   * Compare two versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  compareVersions(a: string | VersionInfo, b: string | VersionInfo): number {
    const versionA = typeof a === 'string' ? this.parseVersion(a) : a;
    const versionB = typeof b === 'string' ? this.parseVersion(b) : b;

    // Compare major.minor.patch
    if (versionA.major !== versionB.major) {
      return versionA.major - versionB.major;
    }

    if (versionA.minor !== versionB.minor) {
      return versionA.minor - versionB.minor;
    }

    if (versionA.patch !== versionB.patch) {
      return versionA.patch - versionB.patch;
    }

    // Handle prerelease versions
    if (versionA.prerelease && !versionB.prerelease) {
      return -1; // Prerelease < release
    }

    if (!versionA.prerelease && versionB.prerelease) {
      return 1; // Release > prerelease
    }

    if (versionA.prerelease && versionB.prerelease) {
      return versionA.prerelease.localeCompare(versionB.prerelease);
    }

    return 0;
  }

  /**
   * Check if version satisfies range
   */
  satisfies(version: string, range: string): boolean {
    const versionInfo = this.parseVersion(version);
    const rangeInfo = this.parseRange(range);

    switch (rangeInfo.operator) {
      case 'exact':
        return this.compareVersions(versionInfo, rangeInfo.version) === 0;

      case 'gte':
        return this.compareVersions(versionInfo, rangeInfo.version) >= 0;

      case 'lte':
        return this.compareVersions(versionInfo, rangeInfo.version) <= 0;

      case 'gt':
        return this.compareVersions(versionInfo, rangeInfo.version) > 0;

      case 'lt':
        return this.compareVersions(versionInfo, rangeInfo.version) < 0;

      case 'caret':
        return this.satisfiesCaret(versionInfo, rangeInfo.version);

      case 'tilde':
        return this.satisfiesTilde(versionInfo, rangeInfo.version);

      case 'range': {
        // For range operator, need to parse both start and end
        const [start, end] = range.split(' - ').map(v => v.trim());
        return (
          this.satisfies(version, `>=${start}`) &&
          this.satisfies(version, `<=${end}`)
        );
      }

      default:
        return false;
    }
  }

  /**
   * Check if version satisfies caret range (^1.2.3)
   * Compatible within same major version
   */
  private satisfiesCaret(version: VersionInfo, range: VersionInfo): boolean {
    if (version.major !== range.major) {
      return false;
    }

    return this.compareVersions(version, range) >= 0;
  }

  /**
   * Check if version satisfies tilde range (~1.2.3)
   * Compatible within same major.minor version
   */
  private satisfiesTilde(version: VersionInfo, range: VersionInfo): boolean {
    if (version.major !== range.major || version.minor !== range.minor) {
      return false;
    }

    return this.compareVersions(version, range) >= 0;
  }

  /**
   * Find the latest version that satisfies range
   */
  findLatestSatisfying(versions: string[], range: string): string | null {
    const satisfying = versions.filter(v => this.satisfies(v, range));

    if (satisfying.length === 0) {
      return null;
    }

    return satisfying.sort((a, b) => this.compareVersions(b, a))[0];
  }

  /**
   * Get all versions that satisfy range
   */
  filterSatisfying(versions: string[], range: string): string[] {
    return versions.filter(v => this.satisfies(v, range));
  }

  /**
   * Check if version is stable (no prerelease)
   */
  isStable(version: string): boolean {
    const versionInfo = this.parseVersion(version);
    return !versionInfo.prerelease;
  }

  /**
   * Check if version is prerelease
   */
  isPrerelease(version: string): boolean {
    return !this.isStable(version);
  }

  /**
   * Get major version
   */
  getMajor(version: string): number {
    return this.parseVersion(version).major;
  }

  /**
   * Get minor version
   */
  getMinor(version: string): number {
    return this.parseVersion(version).minor;
  }

  /**
   * Get patch version
   */
  getPatch(version: string): number {
    return this.parseVersion(version).patch;
  }

  /**
   * Increment version
   */
  increment(version: string, type: 'major' | 'minor' | 'patch'): string {
    const versionInfo = this.parseVersion(version);

    switch (type) {
      case 'major':
        return `${versionInfo.major + 1}.0.0`;
      case 'minor':
        return `${versionInfo.major}.${versionInfo.minor + 1}.0`;
      case 'patch':
        return `${versionInfo.major}.${versionInfo.minor}.${versionInfo.patch + 1}`;
      default:
        throw new Error(`Invalid increment type: ${type}`);
    }
  }

  /**
   * Get version difference
   */
  diff(
    from: string,
    to: string
  ): 'major' | 'minor' | 'patch' | 'prerelease' | 'equal' {
    const fromInfo = this.parseVersion(from);
    const toInfo = this.parseVersion(to);

    if (fromInfo.major !== toInfo.major) {
      return 'major';
    }

    if (fromInfo.minor !== toInfo.minor) {
      return 'minor';
    }

    if (fromInfo.patch !== toInfo.patch) {
      return 'patch';
    }

    if (fromInfo.prerelease !== toInfo.prerelease) {
      return 'prerelease';
    }

    return 'equal';
  }

  /**
   * Sort versions in descending order (latest first)
   */
  sortVersions(versions: string[], ascending = false): string[] {
    return versions.sort((a, b) => {
      const comparison = this.compareVersions(a, b);
      return ascending ? comparison : -comparison;
    });
  }

  /**
   * Check if upgrade is breaking change
   */
  isBreakingChange(from: string, to: string): boolean {
    const fromInfo = this.parseVersion(from);
    const toInfo = this.parseVersion(to);

    // Major version change is always breaking
    return toInfo.major > fromInfo.major;
  }

  /**
   * Get next possible versions for upgrade
   */
  getUpgradeOptions(
    currentVersion: string,
    availableVersions: string[]
  ): {
    patch: string[];
    minor: string[];
    major: string[];
  } {
    const current = this.parseVersion(currentVersion);
    const newer = availableVersions.filter(
      v => this.compareVersions(v, currentVersion) > 0
    );

    return {
      patch: newer.filter(v => {
        const info = this.parseVersion(v);
        return info.major === current.major && info.minor === current.minor;
      }),
      minor: newer.filter(v => {
        const info = this.parseVersion(v);
        return info.major === current.major && info.minor > current.minor;
      }),
      major: newer.filter(v => {
        const info = this.parseVersion(v);
        return info.major > current.major;
      }),
    };
  }

  /**
   * Validate version string
   */
  isValidVersion(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate version range string
   */
  isValidRange(range: string): boolean {
    try {
      this.parseRange(range);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse version string into components (simple wrapper for parseVersion)
   * Required by TODO: Split by dots and hyphens, return version object
   */
  // eslint-disable-next-line class-methods-use-this
  parse(version: string): VersionInfo {
    return this.parseVersion(version);
  }

  /**
   * Compare two versions (simple wrapper for compareVersions)
   * Required by TODO: Compare major, minor, patch, return -1, 0, or 1
   */
  compare(v1: string, v2: string): number {
    return this.compareVersions(v1, v2);
  }

  /**
   * Get latest version from array
   * Required by TODO: Sort versions and return highest
   */
  getLatest(versions: string[]): string | null {
    if (versions.length === 0) {
      return null;
    }

    return this.sortVersions(versions)[0];
  }

  /**
   * Get latest stable version from array
   * Required by TODO: Filter out pre-releases, return highest stable
   */
  getLatestStable(versions: string[]): string | null {
    const stableVersions = versions.filter(v => this.isStable(v));
    
    if (stableVersions.length === 0) {
      return null;
    }

    return this.sortVersions(stableVersions)[0];
  }
}
