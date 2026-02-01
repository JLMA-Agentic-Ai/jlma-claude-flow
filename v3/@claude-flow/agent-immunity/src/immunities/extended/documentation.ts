/**
 * Documentation Immunity - Ensures proper JSDoc/TSDoc presence and quality
 *
 * @module @claude-flow/agent-immunity/immunities/extended/documentation
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Documentation Immunity
 *
 * Validates presence and quality of documentation including JSDoc/TSDoc comments,
 * README files, and inline code comments for maintainability and knowledge transfer.
 */
export class DocumentationImmunity implements Immunity {
  public readonly name = 'documentation';
  public readonly weight = 0.01; // 1% - Knowledge transfer in ADR-001 weight distribution

  private readonly documentationPatterns = {
    jsdoc: /\/\*\*[\s\S]*?\*\//g,
    inlineComment: /\/\/.*$/gm,
    blockComment: /\/\*[\s\S]*?\*\//g,
    typeAnnotation: /:\s*[A-Z][a-zA-Z<>[\]|,\s]*[;,)]/g,
    functionDeclaration: /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=:]?\s*(?:function|\([^)]*\)\s*=>)/g,
    classDeclaration: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    methodDeclaration: /(?:public|private|protected)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g
  };

  /**
   * Analyze action for documentation completeness and quality
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      // Only analyze if action involves code content
      if (!this.hasCodeContent(actionData)) {
        return { score: 1.0, violations: [] };
      }

      // Analyze JSDoc/TSDoc coverage
      const docAnalysis = this.analyzeDocumentationCoverage(actionData);
      if (docAnalysis.coverage < 0.6) {
        const severity = this.calculateDocumentationSeverity(docAnalysis);
        const scoreReduction = (1 - docAnalysis.coverage) * 0.4;
        score = Math.max(0.3, 1.0 - scoreReduction);

        violations.push({
          type: 'insufficient_documentation',
          severity,
          score: scoreReduction,
          description: `Documentation coverage: ${Math.round(docAnalysis.coverage * 100)}% (target: 60%+)`,
          details: {
            coverage: docAnalysis.coverage,
            undocumentedFunctions: docAnalysis.undocumentedFunctions,
            undocumentedClasses: docAnalysis.undocumentedClasses,
            totalFunctions: docAnalysis.totalFunctions,
            totalClasses: docAnalysis.totalClasses,
            suggestions: this.generateDocumentationSuggestions(docAnalysis)
          }
        });
      }

      // Check for complex functions without documentation
      const complexityAnalysis = this.analyzeComplexityDocumentation(actionData);
      if (complexityAnalysis.complexUndocumented.length > 0) {
        violations.push({
          type: 'complex_code_undocumented',
          severity: 'medium',
          score: 0.2,
          description: `${complexityAnalysis.complexUndocumented.length} complex functions lack documentation`,
          details: {
            complexFunctions: complexityAnalysis.complexUndocumented,
            complexityThreshold: complexityAnalysis.threshold
          }
        });
        score = Math.min(score, 0.8);
      }

      // Check for API documentation in public interfaces
      const apiAnalysis = this.analyzeAPIDocumentation(actionData);
      if (apiAnalysis.publicUndocumented.length > 0) {
        violations.push({
          type: 'public_api_undocumented',
          severity: 'high',
          score: 0.3,
          description: `${apiAnalysis.publicUndocumented.length} public APIs lack documentation`,
          details: {
            publicAPIs: apiAnalysis.publicUndocumented,
            documentedAPIs: apiAnalysis.documented,
            coverage: apiAnalysis.coverage
          }
        });
        score = Math.min(score, 0.7);
      }

      // Check for README and project documentation
      const projectDocAnalysis = this.analyzeProjectDocumentation(actionData);
      if (projectDocAnalysis.missing.length > 0) {
        violations.push({
          type: 'missing_project_documentation',
          severity: 'low',
          score: 0.1,
          description: `Missing project documentation: ${projectDocAnalysis.missing.join(', ')}`,
          details: {
            missing: projectDocAnalysis.missing,
            present: projectDocAnalysis.present,
            recommendations: this.generateProjectDocRecommendations(projectDocAnalysis.missing)
          }
        });
        score = Math.min(score, 0.9);
      }

      // Check documentation quality (not just presence)
      const qualityAnalysis = this.analyzeDocumentationQuality(actionData);
      if (qualityAnalysis.lowQualityCount > 0) {
        violations.push({
          type: 'low_quality_documentation',
          severity: 'low',
          score: 0.15,
          description: `${qualityAnalysis.lowQualityCount} documentation blocks need quality improvement`,
          details: {
            issues: qualityAnalysis.issues,
            suggestions: qualityAnalysis.suggestions
          }
        });
        score = Math.min(score, 0.85);
      }

      return { score: Math.max(0, score), violations };
    } catch (error) {
      console.warn('🛡️ Documentation immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private hasCodeContent(actionData: any): boolean {
    const content = this.extractCodeContent(actionData);
    const codeIndicators = [
      /function|class|interface|type/g,
      /import|export|require/g,
      /const|let|var/g,
      /\.ts$|\.js$|\.tsx$|\.jsx$/g
    ];

    return codeIndicators.some(pattern => pattern.test(content));
  }

  private extractCodeContent(actionData: any): string {
    const content = [];

    if (actionData.task?.implementation) content.push(actionData.task.implementation);
    if (actionData.agent?.code) content.push(actionData.agent.code);
    if (actionData.files) {
      for (const [filename, fileContent] of Object.entries(actionData.files as Record<string, any>)) {
        if (typeof fileContent === 'string' && /\.(ts|js|tsx|jsx)$/.test(filename)) {
          content.push(fileContent);
        }
      }
    }

    return content.join('\n');
  }

  private analyzeDocumentationCoverage(actionData: any): {
    coverage: number;
    undocumentedFunctions: string[];
    undocumentedClasses: string[];
    totalFunctions: number;
    totalClasses: number;
    documented: number;
    total: number;
  } {
    const content = this.extractCodeContent(actionData);

    // Extract functions and classes
    const functions = this.extractFunctions(content);
    const classes = this.extractClasses(content);
    const jsdocs = this.extractJSDocs(content);

    // Check which functions/classes have documentation
    const documentedFunctions = functions.filter(func =>
      this.hasDocumentationFor(func, content, jsdocs)
    );
    const documentedClasses = classes.filter(cls =>
      this.hasDocumentationFor(cls, content, jsdocs)
    );

    const total = functions.length + classes.length;
    const documented = documentedFunctions.length + documentedClasses.length;
    const coverage = total > 0 ? documented / total : 1.0;

    return {
      coverage,
      undocumentedFunctions: functions.filter(f => !documentedFunctions.includes(f)),
      undocumentedClasses: classes.filter(c => !documentedClasses.includes(c)),
      totalFunctions: functions.length,
      totalClasses: classes.length,
      documented,
      total
    };
  }

  private extractFunctions(content: string): string[] {
    const functions = [];
    const matches = content.matchAll(this.documentationPatterns.functionDeclaration);

    for (const match of matches) {
      if (match[1]) {
        functions.push(match[1]);
      }
    }

    return functions;
  }

  private extractClasses(content: string): string[] {
    const classes = [];
    const matches = content.matchAll(this.documentationPatterns.classDeclaration);

    for (const match of matches) {
      if (match[1]) {
        classes.push(match[1]);
      }
    }

    return classes;
  }

  private extractJSDocs(content: string): string[] {
    const jsdocs = [];
    const matches = content.matchAll(this.documentationPatterns.jsdoc);

    for (const match of matches) {
      jsdocs.push(match[0]);
    }

    return jsdocs;
  }

  private hasDocumentationFor(name: string, content: string, jsdocs: string[]): boolean {
    // Simple heuristic: check if JSDoc appears before the function/class
    const namePattern = new RegExp(`(?:function|class|const|let|var)\\s+${name}`, 'g');
    const nameMatch = namePattern.exec(content);

    if (!nameMatch) return false;

    const position = nameMatch.index;
    const beforeContent = content.substring(Math.max(0, position - 500), position);

    return this.documentationPatterns.jsdoc.test(beforeContent);
  }

  private calculateDocumentationSeverity(analysis: {
    coverage: number;
    totalFunctions: number;
    totalClasses: number;
  }): 'low' | 'medium' | 'high' | 'critical' {
    const isLargeCodebase = analysis.totalFunctions + analysis.totalClasses > 10;

    if (analysis.coverage < 0.2) return 'critical';
    if (analysis.coverage < 0.4 && isLargeCodebase) return 'high';
    if (analysis.coverage < 0.6) return 'medium';
    return 'low';
  }

  private generateDocumentationSuggestions(analysis: any): string[] {
    const suggestions = [];

    if (analysis.undocumentedFunctions.length > 0) {
      suggestions.push(`Add JSDoc comments for functions: ${analysis.undocumentedFunctions.slice(0, 3).join(', ')}${analysis.undocumentedFunctions.length > 3 ? '...' : ''}`);
    }
    if (analysis.undocumentedClasses.length > 0) {
      suggestions.push(`Add JSDoc comments for classes: ${analysis.undocumentedClasses.slice(0, 3).join(', ')}`);
    }
    if (analysis.coverage < 0.5) {
      suggestions.push('Consider using automated documentation tools (TypeDoc, JSDoc)');
    }
    if (analysis.totalFunctions > 20) {
      suggestions.push('Focus on documenting public APIs and complex functions first');
    }

    return suggestions;
  }

  private analyzeComplexityDocumentation(actionData: any): {
    complexUndocumented: string[];
    threshold: number;
  } {
    const content = this.extractCodeContent(actionData);
    const functions = this.extractFunctions(content);
    const complexFunctions = [];

    // Simple complexity heuristic: function length and control structures
    for (const func of functions) {
      const funcPattern = new RegExp(`(?:function|const|let|var)\\s+${func}[\\s\\S]*?(?=\\n(?:function|class|const|let|var|$))`, 'g');
      const funcMatch = funcPattern.exec(content);

      if (funcMatch) {
        const funcBody = funcMatch[0];
        const complexity = this.calculateFunctionComplexity(funcBody);

        if (complexity > 5 && !this.hasDocumentationFor(func, content, this.extractJSDocs(content))) {
          complexFunctions.push(func);
        }
      }
    }

    return {
      complexUndocumented: complexFunctions,
      threshold: 5
    };
  }

  private calculateFunctionComplexity(funcBody: string): number {
    let complexity = 1; // Base complexity

    // Count control structures
    const controlStructures = [
      /if\s*\(/g,
      /else\s+if/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /&&|\|\|/g
    ];

    for (const pattern of controlStructures) {
      const matches = funcBody.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    // Count lines as a simple metric
    const lines = funcBody.split('\n').length;
    if (lines > 50) complexity += 2;
    if (lines > 100) complexity += 3;

    return complexity;
  }

  private analyzeAPIDocumentation(actionData: any): {
    publicUndocumented: string[];
    documented: string[];
    coverage: number;
  } {
    const content = this.extractCodeContent(actionData);

    // Extract public APIs (exports, public methods)
    const publicAPIs = this.extractPublicAPIs(content);
    const jsdocs = this.extractJSDocs(content);

    const documented = publicAPIs.filter(api =>
      this.hasDocumentationFor(api, content, jsdocs)
    );

    const undocumented = publicAPIs.filter(api =>
      !documented.includes(api)
    );

    return {
      publicUndocumented: undocumented,
      documented,
      coverage: publicAPIs.length > 0 ? documented.length / publicAPIs.length : 1.0
    };
  }

  private extractPublicAPIs(content: string): string[] {
    const apis = [];

    // Extract exports
    const exportMatches = content.matchAll(/export\s+(?:function|class|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    for (const match of exportMatches) {
      if (match[1]) apis.push(match[1]);
    }

    // Extract public methods
    const publicMethodMatches = content.matchAll(/public\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
    for (const match of publicMethodMatches) {
      if (match[1]) apis.push(match[1]);
    }

    return apis;
  }

  private analyzeProjectDocumentation(actionData: any): {
    missing: string[];
    present: string[];
  } {
    const files = actionData.files || {};
    const filenames = Object.keys(files);

    const expected = ['README.md', 'CHANGELOG.md', 'API.md', 'CONTRIBUTING.md'];
    const present = expected.filter(doc =>
      filenames.some(filename => filename.toLowerCase().includes(doc.toLowerCase()))
    );
    const missing = expected.filter(doc => !present.includes(doc));

    return { missing, present };
  }

  private generateProjectDocRecommendations(missing: string[]): string[] {
    const recommendations = [];

    if (missing.includes('README.md')) {
      recommendations.push('Add README.md with project overview, installation, and usage instructions');
    }
    if (missing.includes('API.md')) {
      recommendations.push('Create API documentation for public interfaces');
    }
    if (missing.includes('CHANGELOG.md')) {
      recommendations.push('Maintain a changelog for version history');
    }
    if (missing.includes('CONTRIBUTING.md')) {
      recommendations.push('Add contribution guidelines for team collaboration');
    }

    return recommendations;
  }

  private analyzeDocumentationQuality(actionData: any): {
    lowQualityCount: number;
    issues: string[];
    suggestions: string[];
  } {
    const content = this.extractCodeContent(actionData);
    const jsdocs = this.extractJSDocs(content);
    const issues = [];
    const suggestions = [];
    let lowQualityCount = 0;

    for (const doc of jsdocs) {
      const qualityIssues = this.assessDocumentationQuality(doc);
      if (qualityIssues.length > 0) {
        lowQualityCount++;
        issues.push(...qualityIssues);
      }
    }

    // Generate unique suggestions
    const uniqueIssues = [...new Set(issues)];
    for (const issue of uniqueIssues) {
      suggestions.push(this.getSuggestionForIssue(issue));
    }

    return {
      lowQualityCount,
      issues: uniqueIssues,
      suggestions: suggestions.filter(Boolean)
    };
  }

  private assessDocumentationQuality(docBlock: string): string[] {
    const issues = [];

    // Check for minimal description
    if (docBlock.length < 50) {
      issues.push('too_short');
    }

    // Check for missing @param tags
    if (/@param/.test(docBlock) && (docBlock.match(/@param/g) || []).length < 1) {
      issues.push('insufficient_param_docs');
    }

    // Check for missing @returns tag for functions that likely return values
    if (!/@returns?/.test(docBlock) && /function|=>/i.test(docBlock)) {
      issues.push('missing_return_docs');
    }

    // Check for generic descriptions
    const genericPhrases = ['does something', 'handles', 'processes', 'function that'];
    if (genericPhrases.some(phrase => docBlock.toLowerCase().includes(phrase))) {
      issues.push('generic_description');
    }

    return issues;
  }

  private getSuggestionForIssue(issue: string): string {
    const suggestions = {
      'too_short': 'Expand documentation with detailed descriptions',
      'insufficient_param_docs': 'Document all function parameters with @param',
      'missing_return_docs': 'Add @returns documentation for return values',
      'generic_description': 'Replace generic descriptions with specific, actionable information'
    };

    return suggestions[issue as keyof typeof suggestions] || '';
  }
}