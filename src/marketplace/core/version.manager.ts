/**
 * @fileoverview Version management for template marketplace
 * @lastmodified 2025-08-26T03:27:11Z
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
   * Parse version string into VersionInfo object following semantic versioning
   * @param version - Version string in format major.minor.patch[-prerelease][+build]
   * @returns VersionInfo object with parsed components
   * @throws Error if version format is invalid
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
   * Parse version range string into VersionRange object
   * @param range - Range string (e.g., '^1.2.3', '>=1.0.0', '1.2.3 - 1.5.0')
   * @returns VersionRange object with operator and version
   * @throws Error if range format is invalid
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
   * Get operator from prefix string
   * @param prefix - Operator prefix ('^', '~', '>=', etc.)
   * @returns VersionOperator enum value
   * @throws Error if prefix is unknown
   * @private
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
   * Compare two versions according to semantic versioning rules
   * @param a - First version (string or VersionInfo)
   * @param b - Second version (string or VersionInfo)
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
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
   * Check if version satisfies range according to semantic versioning
   * @param version - Version string to test
   * @param range - Range string to test against
   * @returns True if version satisfies the range
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
   * @param version - Version to test
   * @param range - Caret range base version
   * @returns True if version is compatible with caret range
   * @private
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
   * @param version - Version to test
   * @param range - Tilde range base version
   * @returns True if version is compatible with tilde range
   * @private
   */
  private satisfiesTilde(version: VersionInfo, range: VersionInfo): boolean {
    if (version.major !== range.major || version.minor !== range.minor) {
      return false;
    }

    return this.compareVersions(version, range) >= 0;
  }

  /**
   * Find the latest version that satisfies range from array of versions
   * @param versions - Array of version strings to search
   * @param range - Range string to satisfy
   * @returns Latest satisfying version or null if none found
   */
  findLatestSatisfying(versions: string[], range: string): string | null {
    const satisfying = versions.filter(v => this.satisfies(v, range));

    if (satisfying.length === 0) {
      return null;
    }

    return satisfying.sort((a, b) => this.compareVersions(b, a))[0];
  }

  /**
   * Get all versions that satisfy range from array of versions
   * @param versions - Array of version strings to filter
   * @param range - Range string to satisfy
   * @returns Array of versions that satisfy the range
   */
  filterSatisfying(versions: string[], range: string): string[] {
    return versions.filter(v => this.satisfies(v, range));
  }

  /**
   * Check if version is stable (no prerelease suffix)
   * @param version - Version string to check
   * @returns True if version has no prerelease suffix
   */
  isStable(version: string): boolean {
    const versionInfo = this.parseVersion(version);
    return !versionInfo.prerelease;
  }

  /**
   * Check if version is prerelease (has prerelease suffix)
   * @param version - Version string to check
   * @returns True if version has prerelease suffix
   */
  isPrerelease(version: string): boolean {
    return !this.isStable(version);
  }

  /**
   * Get major version number from version string
   * @param version - Version string to parse
   * @returns Major version number
   */
  getMajor(version: string): number {
    return this.parseVersion(version).major;
  }

  /**
   * Get minor version number from version string
   * @param version - Version string to parse
   * @returns Minor version number
   */
  getMinor(version: string): number {
    return this.parseVersion(version).minor;
  }

  /**
   * Get patch version number from version string
   * @param version - Version string to parse
   * @returns Patch version number
   */
  getPatch(version: string): number {
    return this.parseVersion(version).patch;
  }

  /**
   * Increment version by major, minor, or patch level
   * @param version - Base version string
   * @param type - Type of increment ('major', 'minor', or 'patch')
   * @returns New incremented version string
   * @throws Error if increment type is invalid
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
   * Get version difference type between two versions
   * @param from - Source version string
   * @param to - Target version string
   * @returns Difference type: 'major', 'minor', 'patch', 'prerelease', or 'equal'
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
   * Sort versions in descending order (latest first) or ascending order
   * @param versions - Array of version strings to sort
   * @param ascending - Sort in ascending order if true (default: false)
   * @returns Sorted array of version strings
   */
  sortVersions(versions: string[], ascending = false): string[] {
    return versions.sort((a, b) => {
      const comparison = this.compareVersions(a, b);
      return ascending ? comparison : -comparison;
    });
  }

  /**
   * Check if upgrade is breaking change (major version increase)
   * @param from - Current version string
   * @param to - Target version string
   * @returns True if upgrade involves major version increase
   */
  isBreakingChange(from: string, to: string): boolean {
    const fromInfo = this.parseVersion(from);
    const toInfo = this.parseVersion(to);

    // Major version change is always breaking
    return toInfo.major > fromInfo.major;
  }

  /**
   * Get next possible versions for upgrade categorized by change type
   * @param currentVersion - Current version string
   * @param availableVersions - Array of available version strings
   * @returns Object with patch, minor, and major upgrade options
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
   * Validate version string format
   * @param version - Version string to validate
   * @returns True if version string is valid semantic version
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
   * Validate version range string format
   * @param range - Range string to validate
   * @returns True if range string is valid
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
   * Parse version string into components
   * @param version - Version string to parse
   * @returns VersionInfo object with parsed components
   */
  // eslint-disable-next-line class-methods-use-this
  parse(version: string): VersionInfo {
    return this.parseVersion(version);
  }

  /**
   * Compare two versions
   * @param v1 - First version string
   * @param v2 - Second version string
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  compare(v1: string, v2: string): number {
    return this.compareVersions(v1, v2);
  }

  /**
   * Get latest version from array of version strings
   * @param versions - Array of version strings
   * @returns Latest version string or null if array is empty
   */
  getLatest(versions: string[]): string | null {
    if (versions.length === 0) {
      return null;
    }

    return this.sortVersions(versions)[0];
  }

  /**
   * Get latest stable version from array (excludes prereleases)
   * @param versions - Array of version strings
   * @returns Latest stable version string or null if no stable versions found
   */
  getLatestStable(versions: string[]): string | null {
    const stableVersions = versions.filter(v => this.isStable(v));

    if (stableVersions.length === 0) {
      return null;
    }

    return this.sortVersions(stableVersions)[0];
  }
}
