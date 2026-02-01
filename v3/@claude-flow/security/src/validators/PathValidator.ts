/**
 * @claude-flow/security - Path Validation Module
 * Prevents path traversal attacks and validates file system paths
 */

import * as path from 'path';
import * as fs from 'fs/promises';

export interface PathValidationResult {
  isValid: boolean;
  normalizedPath?: string;
  error?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PathSecurityConfig {
  allowedDirectories: string[];
  blockedDirectories: string[];
  allowedExtensions: string[];
  maxPathLength: number;
  allowSymlinks: boolean;
  restrictToProjectRoot: boolean;
}

export class PathValidator {
  private config: PathSecurityConfig;
  private projectRoot: string;

  constructor(projectRoot?: string, config?: Partial<PathSecurityConfig>) {
    this.projectRoot = projectRoot || process.cwd();
    this.config = {
      allowedDirectories: ['src', 'tests', 'docs', 'config', 'scripts', 'examples', '.claude'],
      blockedDirectories: ['node_modules', '.git', '.env', 'secrets', 'private'],
      allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.yml', '.yaml', '.toml'],
      maxPathLength: 260, // Windows MAX_PATH limitation
      allowSymlinks: false,
      restrictToProjectRoot: true,
      ...config
    };
  }

  /**
   * Validates a file path for security vulnerabilities
   */
  public async validatePath(inputPath: string): Promise<PathValidationResult> {
    try {
      // Basic validation
      if (!inputPath || typeof inputPath !== 'string') {
        return {
          isValid: false,
          error: 'Path must be a non-empty string',
          riskLevel: 'medium'
        };
      }

      if (inputPath.length > this.config.maxPathLength) {
        return {
          isValid: false,
          error: `Path exceeds maximum length of ${this.config.maxPathLength}`,
          riskLevel: 'medium'
        };
      }

      // Normalize path to prevent traversal
      const normalizedPath = path.normalize(inputPath);

      // Check for path traversal attempts
      const traversalCheck = this.checkPathTraversal(normalizedPath);
      if (!traversalCheck.isValid) {
        return traversalCheck;
      }

      // Check if path is within allowed project scope
      const scopeCheck = this.checkProjectScope(normalizedPath);
      if (!scopeCheck.isValid) {
        return scopeCheck;
      }

      // Check directory allowlist/blocklist
      const directoryCheck = this.checkDirectoryPermissions(normalizedPath);
      if (!directoryCheck.isValid) {
        return directoryCheck;
      }

      // Check file extension
      const extensionCheck = this.checkFileExtension(normalizedPath);
      if (!extensionCheck.isValid) {
        return extensionCheck;
      }

      // Check for symbolic links if not allowed
      if (!this.config.allowSymlinks) {
        const symlinkCheck = await this.checkSymlinks(normalizedPath);
        if (!symlinkCheck.isValid) {
          return symlinkCheck;
        }
      }

      return {
        isValid: true,
        normalizedPath,
        riskLevel: 'low'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Path validation failed: ${error.message}`,
        riskLevel: 'critical'
      };
    }
  }

  private checkPathTraversal(normalizedPath: string): PathValidationResult {
    // Check for obvious traversal patterns
    const traversalPatterns = [
      /\.\./,           // Parent directory references
      /\/\.\./,         // Unix path traversal
      /\\\.\./,         // Windows path traversal
      /\.{3,}/,         // Multiple dots
      /%2e%2e/i,        // URL encoded ..
      /\.\/%2e%2e/i,    // Mixed encoding
      /\x00/,           // Null bytes
      /[<>:"|?*]/       // Windows forbidden characters
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(normalizedPath)) {
        return {
          isValid: false,
          error: 'Path contains potentially dangerous traversal patterns',
          riskLevel: 'critical'
        };
      }
    }

    return { isValid: true, riskLevel: 'low' };
  }

  private checkProjectScope(normalizedPath: string): PathValidationResult {
    if (!this.config.restrictToProjectRoot) {
      return { isValid: true, riskLevel: 'low' };
    }

    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(this.projectRoot, normalizedPath);

    const resolvedProjectRoot = path.resolve(this.projectRoot);

    if (!absolutePath.startsWith(resolvedProjectRoot)) {
      return {
        isValid: false,
        error: 'Path is outside project root directory',
        riskLevel: 'critical'
      };
    }

    return { isValid: true, riskLevel: 'low' };
  }

  private checkDirectoryPermissions(normalizedPath: string): PathValidationResult {
    const pathParts = normalizedPath.split(path.sep).filter(part => part.length > 0);

    // Check for blocked directories
    for (const part of pathParts) {
      if (this.config.blockedDirectories.includes(part)) {
        return {
          isValid: false,
          error: `Access to directory '${part}' is not allowed`,
          riskLevel: 'high'
        };
      }
    }

    // Check allowed directories (if specified and not root level)
    if (this.config.allowedDirectories.length > 0 && pathParts.length > 0) {
      const firstDir = pathParts[0];
      if (!this.config.allowedDirectories.includes(firstDir) &&
          !path.isAbsolute(normalizedPath)) {
        return {
          isValid: false,
          error: `Directory '${firstDir}' is not in the allowed list`,
          riskLevel: 'medium'
        };
      }
    }

    return { isValid: true, riskLevel: 'low' };
  }

  private checkFileExtension(normalizedPath: string): PathValidationResult {
    if (this.config.allowedExtensions.length === 0) {
      return { isValid: true, riskLevel: 'low' };
    }

    const extension = path.extname(normalizedPath).toLowerCase();

    if (!this.config.allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `File extension '${extension}' is not allowed`,
        riskLevel: 'medium'
      };
    }

    return { isValid: true, riskLevel: 'low' };
  }

  private async checkSymlinks(normalizedPath: string): Promise<PathValidationResult> {
    try {
      const fullPath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.resolve(this.projectRoot, normalizedPath);

      const stats = await fs.lstat(fullPath).catch(() => null);

      if (stats?.isSymbolicLink()) {
        return {
          isValid: false,
          error: 'Symbolic links are not allowed',
          riskLevel: 'medium'
        };
      }

      return { isValid: true, riskLevel: 'low' };

    } catch (error) {
      // If file doesn't exist, that's okay for validation purposes
      return { isValid: true, riskLevel: 'low' };
    }
  }

  /**
   * Safely join paths while preventing traversal
   */
  public safePath(...paths: string[]): string {
    const joined = path.join(...paths);
    const normalized = path.normalize(joined);

    // Ensure the result doesn't escape the first path (assumed to be base)
    if (paths.length > 1) {
      const basePath = path.normalize(paths[0]);
      if (!normalized.startsWith(basePath)) {
        throw new Error('Path traversal detected in join operation');
      }
    }

    return normalized;
  }

  /**
   * Get a safe relative path that cannot escape the base directory
   */
  public getRelativePath(basePath: string, targetPath: string): string {
    const normalizedBase = path.resolve(basePath);
    const normalizedTarget = path.resolve(targetPath);

    if (!normalizedTarget.startsWith(normalizedBase)) {
      throw new Error('Target path is outside base directory');
    }

    return path.relative(normalizedBase, normalizedTarget);
  }

  /**
   * Validate multiple paths at once
   */
  public async validatePaths(paths: string[]): Promise<Record<string, PathValidationResult>> {
    const results: Record<string, PathValidationResult> = {};

    await Promise.all(
      paths.map(async (inputPath) => {
        results[inputPath] = await this.validatePath(inputPath);
      })
    );

    return results;
  }
}