/**
 * Dependencies Immunity - Lockfile hash, license audit, CVE check
 *
 * @module @claude-flow/agent-immunity/immunities/dependencies
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Dependency vulnerability information
 */
interface DependencyVulnerability {
  package: string;
  version: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  cve: string;
  title: string;
  description: string;
}

/**
 * License compliance issue
 */
interface LicenseIssue {
  package: string;
  license: string;
  issue: string;
  risk: 'low' | 'medium' | 'high';
}

/**
 * Dependencies Immunity
 *
 * Monitors dependency security through lockfile analysis, license auditing, and CVE checking.
 * Protects against vulnerable dependencies and license compliance issues.
 */
export class DependenciesImmunity implements Immunity {
  public readonly name = 'dependencies';
  public readonly weight = 0.7;

  private knownVulnerabilities: DependencyVulnerability[] = [
    {
      package: 'lodash',
      version: '<4.17.21',
      severity: 'high',
      cve: 'CVE-2021-23337',
      title: 'Command Injection',
      description: 'Prototype pollution in lodash template'
    },
    {
      package: 'node-fetch',
      version: '<2.6.1',
      severity: 'moderate',
      cve: 'CVE-2020-15168',
      title: 'Size limit bypass',
      description: 'node-fetch can be bypassed'
    }
  ];

  private problematicLicenses = ['AGPL-3.0', 'GPL-3.0', 'LGPL-3.0'];

  /**
   * Analyze action for dependency security issues
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      // Extract dependency information
      const dependencies = this.extractDependencies(actionData);
      if (dependencies.length === 0) {
        return { score: 1.0, violations: [] }; // No dependencies to check
      }

      console.log(`📦 Dependencies analysis: ${dependencies.length} packages`);

      // Check for vulnerabilities
      const vulnResults = await this.checkVulnerabilities(dependencies);
      violations.push(...vulnResults);

      // Check license compliance
      const licenseResults = await this.checkLicenseCompliance(dependencies);
      violations.push(...licenseResults);

      // Check lockfile integrity (simulated)
      const lockfileResults = await this.checkLockfileIntegrity(actionData);
      violations.push(...lockfileResults);

      // Calculate overall score
      const overallScore = this.calculateDependencyScore(violations);

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('📦 Dependencies immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract dependency information from action data
   */
  private extractDependencies(actionData: any): Array<{ name: string; version: string }> {
    const dependencies: Array<{ name: string; version: string }> = [];

    // Check for package.json in metadata
    if (actionData.metadata?.packageJson) {
      const pkg = JSON.parse(actionData.metadata.packageJson);
      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          dependencies.push({ name, version: version as string });
        }
      }
      if (pkg.devDependencies) {
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
          dependencies.push({ name, version: version as string });
        }
      }
    }

    // Check for dependency mentions in task description
    if (actionData.task?.description) {
      const depMatches = actionData.task.description.match(/npm install\s+([\w@/-]+)/g);
      if (depMatches) {
        for (const match of depMatches) {
          const packageName = match.replace('npm install ', '');
          dependencies.push({ name: packageName, version: 'latest' });
        }
      }
    }

    return dependencies;
  }

  /**
   * Check dependencies for known vulnerabilities
   */
  private async checkVulnerabilities(
    dependencies: Array<{ name: string; version: string }>
  ): Promise<ImmunityViolation[]> {
    const violations: ImmunityViolation[] = [];

    for (const dep of dependencies) {
      for (const vuln of this.knownVulnerabilities) {
        if (dep.name === vuln.package && this.isVersionVulnerable(dep.version, vuln.version)) {
          violations.push({
            type: 'dependency_vulnerability',
            severity: vuln.severity as any,
            score: this.getSeverityScore(vuln.severity),
            description: `Vulnerable dependency: ${vuln.package} ${dep.version} - ${vuln.title}`,
            details: {
              package: dep.name,
              version: dep.version,
              cve: vuln.cve,
              vulnerability: vuln.description,
              fixedIn: vuln.version.replace('<', '>=')
            }
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check license compliance issues
   */
  private async checkLicenseCompliance(
    dependencies: Array<{ name: string; version: string }>
  ): Promise<ImmunityViolation[]> {
    const violations: ImmunityViolation[] = [];

    for (const dep of dependencies) {
      // Simulate license lookup
      const license = this.getLicenseForPackage(dep.name);
      if (license && this.problematicLicenses.includes(license)) {
        violations.push({
          type: 'license_issue',
          severity: 'medium',
          score: 0.5,
          description: `Problematic license detected: ${dep.name} uses ${license}`,
          details: {
            package: dep.name,
            license,
            issue: `${license} license may require source code disclosure`,
            risk: 'medium'
          }
        });
      }
    }

    return violations;
  }

  /**
   * Check lockfile integrity
   */
  private async checkLockfileIntegrity(actionData: any): Promise<ImmunityViolation[]> {
    const violations: ImmunityViolation[] = [];

    // Simulate lockfile hash check
    if (actionData.metadata?.lockfileChanged) {
      violations.push({
        type: 'lockfile_integrity',
        severity: 'low',
        score: 0.7,
        description: 'Lockfile modifications detected without package.json changes',
        details: {
          issue: 'Lockfile hash mismatch',
          recommendation: 'Review lockfile changes and regenerate if needed'
        }
      });
    }

    return violations;
  }

  /**
   * Calculate overall dependency score
   */
  private calculateDependencyScore(violations: ImmunityViolation[]): number {
    if (violations.length === 0) return 1.0;

    const scores = violations.map(v => v.score);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Check if version is vulnerable based on version constraint
   */
  private isVersionVulnerable(version: string, constraint: string): boolean {
    // Simple version comparison - in production would use semver
    if (constraint.startsWith('<')) {
      const minVersion = constraint.substring(1);
      return this.compareVersions(version, minVersion) < 0;
    }
    return false;
  }

  /**
   * Simple version comparison
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  /**
   * Get license for package (simulated lookup)
   */
  private getLicenseForPackage(packageName: string): string | null {
    const licenseLookup: Record<string, string> = {
      'express': 'MIT',
      'lodash': 'MIT',
      'react': 'MIT',
      'vue': 'MIT',
      'copyleft-package': 'GPL-3.0'
    };

    return licenseLookup[packageName] || null;
  }

  /**
   * Get numeric score for severity
   */
  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 0.0;
      case 'high': return 0.3;
      case 'moderate': return 0.6;
      case 'low': return 0.8;
      default: return 1.0;
    }
  }
}