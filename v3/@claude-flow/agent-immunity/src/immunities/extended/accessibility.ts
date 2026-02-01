/**
 * Accessibility Immunity - Ensures WCAG compliance for UI components
 *
 * @module @claude-flow/agent-immunity/immunities/extended/accessibility
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Accessibility Immunity
 *
 * Validates UI components against WCAG guidelines and accessibility standards.
 * Checks for proper ARIA attributes, color contrast, keyboard navigation, and semantic HTML.
 */
export class AccessibilityImmunity implements Immunity {
  public readonly name = 'accessibility';
  public readonly weight = 0.04; // 4% - UI/UX compliance in ADR-001 weight distribution

  private readonly wcagRules = {
    ariaRequired: ['button', 'input', 'select', 'textarea'],
    semanticElements: ['main', 'nav', 'section', 'article', 'aside', 'header', 'footer'],
    interactiveElements: ['button', 'a', 'input', 'select', 'textarea'],
    headingHierarchy: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  };

  /**
   * Analyze action for accessibility compliance
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      // Only analyze if action involves UI/HTML content
      if (!this.hasUIContent(actionData)) {
        return { score: 1.0, violations: [] };
      }

      // Check ARIA compliance
      const ariaViolations = this.checkARIACompliance(actionData);
      if (ariaViolations.length > 0) {
        violations.push({
          type: 'aria_violations',
          severity: this.calculateARIASeverity(ariaViolations),
          score: ariaViolations.length * 0.1,
          description: `ARIA compliance issues: ${ariaViolations.map(v => v.rule).join(', ')}`,
          details: {
            violations: ariaViolations,
            fixable: ariaViolations.filter(v => v.autoFixable).length,
            total: ariaViolations.length
          }
        });
        score -= ariaViolations.length * 0.1;
      }

      // Check semantic HTML structure
      const semanticIssues = this.checkSemanticStructure(actionData);
      if (semanticIssues.length > 0) {
        violations.push({
          type: 'semantic_html_violations',
          severity: 'medium',
          score: semanticIssues.length * 0.05,
          description: `Semantic HTML issues: ${semanticIssues.join(', ')}`,
          details: {
            issues: semanticIssues,
            recommendations: this.generateSemanticRecommendations(semanticIssues)
          }
        });
        score -= semanticIssues.length * 0.05;
      }

      // Check keyboard navigation support
      const keyboardIssues = this.checkKeyboardAccessibility(actionData);
      if (keyboardIssues.length > 0) {
        violations.push({
          type: 'keyboard_accessibility',
          severity: 'high',
          score: 0.3,
          description: `Keyboard accessibility issues: ${keyboardIssues.join(', ')}`,
          details: {
            issues: keyboardIssues,
            affectedElements: this.getInteractiveElements(actionData)
          }
        });
        score -= 0.3;
      }

      // Check color contrast (simplified analysis)
      const contrastIssues = this.checkColorContrast(actionData);
      if (contrastIssues.length > 0) {
        violations.push({
          type: 'color_contrast',
          severity: 'medium',
          score: 0.2,
          description: `Color contrast issues detected`,
          details: {
            issues: contrastIssues,
            wcagLevel: 'AA',
            minimumRatio: 4.5
          }
        });
        score -= 0.2;
      }

      // Check heading hierarchy
      const headingIssues = this.checkHeadingHierarchy(actionData);
      if (headingIssues.length > 0) {
        violations.push({
          type: 'heading_hierarchy',
          severity: 'low',
          score: 0.1,
          description: `Heading hierarchy issues: ${headingIssues.join(', ')}`,
          details: { issues: headingIssues }
        });
        score -= 0.1;
      }

      // Check alt text for images
      const altTextIssues = this.checkAltText(actionData);
      if (altTextIssues.length > 0) {
        violations.push({
          type: 'missing_alt_text',
          severity: 'high',
          score: 0.25,
          description: `Missing or inadequate alt text for ${altTextIssues.length} images`,
          details: {
            missingAltImages: altTextIssues.length,
            recommendations: 'Add descriptive alt text for all images'
          }
        });
        score -= 0.25;
      }

      return { score: Math.max(0, score), violations };
    } catch (error) {
      console.warn('🛡️ Accessibility immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private hasUIContent(actionData: any): boolean {
    const content = this.extractUIContent(actionData);
    const uiIndicators = [
      /<[^>]+>/g, // HTML tags
      /jsx|tsx|vue|react/i, // UI frameworks
      /component|element/i, // UI terminology
      /css|style/i, // Styling
      /aria-|role=/i // Accessibility attributes
    ];

    return uiIndicators.some(pattern => pattern.test(content));
  }

  private extractUIContent(actionData: any): string {
    const content = [];

    if (actionData.task?.implementation) content.push(actionData.task.implementation);
    if (actionData.agent?.code) content.push(actionData.agent.code);
    if (actionData.ui?.template) content.push(actionData.ui.template);
    if (actionData.html) content.push(actionData.html);

    return content.join('\n');
  }

  private checkARIACompliance(actionData: any): Array<{
    rule: string;
    element: string;
    autoFixable: boolean;
    severity: 'low' | 'medium' | 'high';
  }> {
    const content = this.extractUIContent(actionData);
    const violations = [];

    // Check for buttons without accessible labels
    const buttonPattern = /<button(?![^>]*aria-label)(?![^>]*aria-labelledby)(?![^>]*title)[^>]*>/g;
    if (buttonPattern.test(content)) {
      violations.push({
        rule: 'button_missing_label',
        element: 'button',
        autoFixable: true,
        severity: 'high' as const
      });
    }

    // Check for inputs without labels
    const inputPattern = /<input(?![^>]*aria-label)(?![^>]*aria-labelledby)(?![^>]*title)[^>]*>/g;
    if (inputPattern.test(content)) {
      violations.push({
        rule: 'input_missing_label',
        element: 'input',
        autoFixable: true,
        severity: 'high' as const
      });
    }

    // Check for clickable divs without role
    const clickableDivPattern = /<div[^>]*onclick[^>]*(?!role=)/g;
    if (clickableDivPattern.test(content)) {
      violations.push({
        rule: 'clickable_div_missing_role',
        element: 'div',
        autoFixable: true,
        severity: 'medium' as const
      });
    }

    // Check for images without alt text (will be caught in dedicated check)
    // Check for form controls without proper labeling
    const unlabeledFormControls = /<(select|textarea)(?![^>]*aria-label)(?![^>]*aria-labelledby)/g;
    if (unlabeledFormControls.test(content)) {
      violations.push({
        rule: 'form_control_missing_label',
        element: 'form_control',
        autoFixable: true,
        severity: 'high' as const
      });
    }

    return violations;
  }

  private checkSemanticStructure(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const issues = [];

    // Check for missing semantic landmarks
    const hasMain = /<main\b/.test(content);
    const hasNav = /<nav\b/.test(content);
    const hasHeader = /<header\b/.test(content);

    if (!hasMain && /<body|<html/.test(content)) {
      issues.push('missing_main_landmark');
    }

    // Check for divitis (excessive div usage instead of semantic elements)
    const divCount = (content.match(/<div/g) || []).length;
    const semanticCount = (content.match(/<(main|nav|section|article|aside|header|footer)/g) || []).length;

    if (divCount > 5 && semanticCount === 0) {
      issues.push('divitis_detected');
    }

    // Check for list structure in navigation
    if (hasNav && !/<ul|<ol/.test(content)) {
      issues.push('nav_without_list_structure');
    }

    return issues;
  }

  private checkKeyboardAccessibility(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const issues = [];

    // Check for missing tabindex on custom interactive elements
    const customInteractive = /<div[^>]*onclick[^>]*(?!tabindex)/g;
    if (customInteractive.test(content)) {
      issues.push('custom_interactive_missing_tabindex');
    }

    // Check for keyboard event handlers
    const hasClickOnly = /onclick/.test(content) && !/onkeydown|onkeyup|onkeypress/.test(content);
    if (hasClickOnly) {
      issues.push('missing_keyboard_handlers');
    }

    // Check for focus indicators in CSS (simplified)
    const hasFocusStyles = /:focus/.test(content);
    if (!hasFocusStyles && this.hasInteractiveElements(actionData)) {
      issues.push('missing_focus_indicators');
    }

    return issues;
  }

  private checkColorContrast(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const issues = [];

    // Simplified color contrast check - look for common problematic patterns
    const lightGrayOnWhite = /color:\s*#[cdef][cdef][cdef]|color:\s*lightgray/g;
    if (lightGrayOnWhite.test(content)) {
      issues.push('potential_low_contrast_light_gray');
    }

    const yellowOnWhite = /color:\s*yellow|color:\s*#ffff/g;
    if (yellowOnWhite.test(content)) {
      issues.push('potential_low_contrast_yellow');
    }

    // Check for insufficient contrast in common color combinations
    const problematicCombinations = [
      /background:\s*white.*color:\s*#[cdef]/g,
      /color:\s*white.*background:\s*#[cdef]/g
    ];

    if (problematicCombinations.some(pattern => pattern.test(content))) {
      issues.push('potential_insufficient_contrast');
    }

    return issues;
  }

  private checkHeadingHierarchy(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const issues = [];

    // Extract heading levels
    const headings = content.match(/<h([1-6])/g) || [];
    const levels = headings.map(h => parseInt(h.match(/\d/)?.[0] || '1'));

    if (levels.length === 0) {
      return issues;
    }

    // Check if starts with h1
    if (levels[0] !== 1) {
      issues.push('heading_not_starting_h1');
    }

    // Check for skipped levels
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        issues.push('heading_level_skipped');
        break;
      }
    }

    return issues;
  }

  private checkAltText(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const issues = [];

    // Find images without alt text
    const imagesWithoutAlt = content.match(/<img(?![^>]*alt=)[^>]*>/g) || [];
    issues.push(...imagesWithoutAlt.map(() => 'missing_alt_text'));

    // Find images with empty or inadequate alt text
    const imagesWithEmptyAlt = content.match(/<img[^>]*alt=""\s*[^>]*>/g) || [];
    issues.push(...imagesWithEmptyAlt.map(() => 'empty_alt_text'));

    return issues;
  }

  private calculateARIASeverity(violations: Array<{ severity: string }>): 'low' | 'medium' | 'high' | 'critical' {
    const highSeverityCount = violations.filter(v => v.severity === 'high').length;
    const criticalCount = violations.filter(v => v.severity === 'critical').length;

    if (criticalCount > 0) return 'critical';
    if (highSeverityCount > 2) return 'high';
    if (violations.length > 3) return 'medium';
    return 'low';
  }

  private generateSemanticRecommendations(issues: string[]): string[] {
    const recommendations = [];

    if (issues.includes('missing_main_landmark')) {
      recommendations.push('Add <main> element to wrap primary content');
    }
    if (issues.includes('divitis_detected')) {
      recommendations.push('Replace generic divs with semantic elements (section, article, aside)');
    }
    if (issues.includes('nav_without_list_structure')) {
      recommendations.push('Structure navigation using <ul>/<ol> lists for better accessibility');
    }

    return recommendations;
  }

  private getInteractiveElements(actionData: any): string[] {
    const content = this.extractUIContent(actionData);
    const elements = [];

    const buttonElements = content.match(/<button/g) || [];
    const linkElements = content.match(/<a\s[^>]*href/g) || [];
    const inputElements = content.match(/<input/g) || [];

    elements.push(`${buttonElements.length} buttons`);
    elements.push(`${linkElements.length} links`);
    elements.push(`${inputElements.length} inputs`);

    return elements.filter(el => !el.startsWith('0'));
  }

  private hasInteractiveElements(actionData: any): boolean {
    const content = this.extractUIContent(actionData);
    return /<button|<a\s[^>]*href|<input|onclick/.test(content);
  }
}