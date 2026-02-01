/**
 * Unit Tests for Security Immunity Analyzer
 * Tests vulnerability detection, injection protection, and security validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityImmunityAnalyzer } from '../../../src/immunity/analyzers/SecurityImmunityAnalyzer';
import { ImmunityContext, ImmunityResult } from '../../../src/immunity/types';

describe('SecurityImmunityAnalyzer', () => {
  let analyzer: SecurityImmunityAnalyzer;
  let mockContext: ImmunityContext;

  beforeEach(() => {
    analyzer = new SecurityImmunityAnalyzer();
    mockContext = {
      agentId: 'test-agent',
      action: 'execute',
      payload: {},
      trajectory: [],
      timestamp: Date.now()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SQL Injection Detection', () => {
    it('should detect basic SQL injection attempts', async () => {
      const maliciousCode = `
        const query = "SELECT * FROM users WHERE id = '" + userId + "'";
        db.query(query);
      `;

      mockContext.payload = { code: maliciousCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('SQL injection');
    });

    it('should detect advanced SQL injection patterns', async () => {
      const maliciousCode = `
        const userInput = req.body.id;
        const sql = \`SELECT * FROM users WHERE id = \${userInput} OR 1=1--\`;
      `;

      mockContext.payload = { code: maliciousCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.vulnerabilities).toContain('UNION_INJECTION');
    });

    it('should allow safe parameterized queries', async () => {
      const safeCode = `
        const query = "SELECT * FROM users WHERE id = ?";
        db.query(query, [userId]);
      `;

      mockContext.payload = { code: safeCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('Command Injection Detection', () => {
    it('should detect shell command injection', async () => {
      const maliciousCode = `
        const filename = userInput;
        exec("cat " + filename + "; rm -rf /");
      `;

      mockContext.payload = { code: maliciousCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.reason).toContain('command injection');
    });

    it('should detect subprocess injection attempts', async () => {
      const maliciousCode = `
        subprocess.call(['ls', '-la', userInput + '; cat /etc/passwd'])
      `;

      mockContext.payload = { code: maliciousCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.vulnerabilities).toContain('COMMAND_INJECTION');
    });

    it('should allow safe subprocess calls with validation', async () => {
      const safeCode = `
        const filename = path.basename(userInput);
        if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error('Invalid filename');
        subprocess.call(['cat', filename]);
      `;

      mockContext.payload = { code: safeCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
    });
  });

  describe('Path Traversal Detection', () => {
    it('should detect directory traversal attempts', async () => {
      const maliciousCode = `
        const filepath = userInput; // "../../../etc/passwd"
        fs.readFile(filepath, callback);
      `;

      mockContext.payload = {
        code: maliciousCode,
        userInput: '../../../etc/passwd'
      };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.vulnerabilities).toContain('PATH_TRAVERSAL');
    });

    it('should detect encoded traversal attempts', async () => {
      const maliciousCode = `
        const filepath = decodeURIComponent(userInput); // %2e%2e%2f%2e%2e%2f
        fs.readFile(filepath);
      `;

      mockContext.payload = {
        code: maliciousCode,
        userInput: '%2e%2e%2f%2e%2e%2f'
      };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should allow safe path operations', async () => {
      const safeCode = `
        const filepath = path.resolve('./safe-dir', path.basename(userInput));
        fs.readFile(filepath);
      `;

      mockContext.payload = { code: safeCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('Cross-Site Scripting (XSS) Detection', () => {
    it('should detect reflected XSS vulnerabilities', async () => {
      const maliciousCode = `
        const userComment = req.body.comment;
        res.send("<div>" + userComment + "</div>");
      `;

      mockContext.payload = {
        code: maliciousCode,
        userComment: '<script>alert("XSS")</script>'
      };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.vulnerabilities).toContain('XSS_REFLECTED');
    });

    it('should detect stored XSS vulnerabilities', async () => {
      const maliciousCode = `
        const userPost = req.body.post;
        db.insert('posts', { content: userPost });
        // Later: res.send(post.content) without escaping
      `;

      mockContext.payload = { code: maliciousCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.vulnerabilities).toContain('XSS_STORED');
    });

    it('should allow properly sanitized output', async () => {
      const safeCode = `
        const userComment = escapeHtml(req.body.comment);
        res.send("<div>" + userComment + "</div>");
      `;

      mockContext.payload = { code: safeCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('Cryptographic Vulnerabilities', () => {
    it('should detect weak encryption algorithms', async () => {
      const weakCode = `
        const cipher = crypto.createCipher('des', password);
        const encrypted = cipher.update(data, 'utf8', 'hex');
      `;

      mockContext.payload = { code: weakCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.vulnerabilities).toContain('WEAK_CRYPTO');
    });

    it('should detect hardcoded secrets', async () => {
      const secretCode = `
        const API_KEY = "sk-1234567890abcdef";
        const DB_PASSWORD = "admin123";
      `;

      mockContext.payload = { code: secretCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.vulnerabilities).toContain('HARDCODED_SECRETS');
    });

    it('should allow strong encryption with environment variables', async () => {
      const secureCode = `
        const key = process.env.ENCRYPTION_KEY;
        const cipher = crypto.createCipher('aes-256-gcm', key);
      `;

      mockContext.payload = { code: secureCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('Edge Cases and False Positives', () => {
    it('should not block legitimate dynamic queries with validation', async () => {
      const legitimateCode = `
        const allowedColumns = ['name', 'email', 'created_at'];
        const column = allowedColumns.includes(req.query.sort) ? req.query.sort : 'created_at';
        const query = \`SELECT \${column} FROM users ORDER BY \${column}\`;
      `;

      mockContext.payload = { code: legitimateCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle complex code structures', async () => {
      const complexCode = `
        class QueryBuilder {
          constructor() { this.params = []; }
          where(field, value) {
            this.params.push(value);
            return this.addClause(\`\${field} = ?\`);
          }
        }
      `;

      mockContext.payload = { code: complexCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
    });

    it('should handle empty or minimal code', async () => {
      mockContext.payload = { code: '' };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle malformed code gracefully', async () => {
      const malformedCode = '{ invalid javascript syntax ][';
      mockContext.payload = { code: malformedCode };

      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.2);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should analyze code within 30ms latency target', async () => {
      const codeToAnalyze = `
        function complexFunction() {
          const data = fetchUserData();
          const processed = data.map(item => ({
            ...item,
            processed: true
          }));
          return processed.filter(item => item.active);
        }
      `;

      mockContext.payload = { code: codeToAnalyze };

      const startTime = performance.now();
      const result = await analyzer.analyze(mockContext);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(30);
      expect(result).toBeDefined();
      expect(result.analysisTimeMs).toBeLessThan(30);
    });

    it('should handle large code blocks efficiently', async () => {
      const largeCode = 'function test() {\n' + '  console.log("test");\n'.repeat(1000) + '}';
      mockContext.payload = { code: largeCode };

      const startTime = performance.now();
      const result = await analyzer.analyze(mockContext);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Allow slightly more for large code
      expect(result).toBeDefined();
    });
  });

  describe('Trajectory Context Analysis', () => {
    it('should consider previous trajectory steps for context', async () => {
      mockContext.trajectory = [
        {
          type: 'thought',
          content: 'Need to validate user input',
          timestamp: Date.now() - 1000
        },
        {
          type: 'action',
          content: 'Setting up input validation',
          timestamp: Date.now() - 500
        }
      ];

      mockContext.payload = {
        code: `const userInput = req.body.data; db.query("SELECT * FROM users WHERE id = " + userInput);`
      };

      const result = await analyzer.analyze(mockContext);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.contextualFactors).toContain('LACKS_VALIDATION_AFTER_INTENT');
    });

    it('should reduce confidence when good security practices are shown in trajectory', async () => {
      mockContext.trajectory = [
        {
          type: 'action',
          content: 'Implementing parameterized queries for security',
          timestamp: Date.now() - 1000
        }
      ];

      mockContext.payload = {
        code: `const query = "SELECT * FROM users WHERE id = ?"; db.query(query, [userInput]);`
      };

      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.contextualFactors).toContain('SECURITY_INTENT_SHOWN');
    });
  });

  describe('Immunity Configuration', () => {
    it('should respect confidence thresholds', async () => {
      const customAnalyzer = new SecurityImmunityAnalyzer({
        confidenceThreshold: 0.9,
        strictMode: true
      });

      const borderlineCode = `
        const query = "SELECT * FROM " + tableName + " WHERE active = 1";
      `;

      mockContext.payload = { code: borderlineCode };
      const result = await customAnalyzer.analyze(mockContext);

      // Should not block with high threshold unless very confident
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.blocked).toBe(false);
    });

    it('should handle different severity levels', async () => {
      const criticalCode = `
        exec("rm -rf / --no-preserve-root");
      `;

      mockContext.payload = { code: criticalCode };
      const result = await analyzer.analyze(mockContext);

      expect(result.severity).toBe('critical');
      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });
  });
});