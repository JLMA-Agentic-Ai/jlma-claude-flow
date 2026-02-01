/**
 * @claude-flow/security - Safe Command Execution Module
 * Prevents command injection attacks and provides secure process execution
 */

import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import { z } from 'zod';

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  duration: number;
  pid?: number;
}

export interface ExecutionConfig {
  timeout: number;
  maxStdoutSize: number;
  maxStderrSize: number;
  allowedCommands: string[];
  blockedCommands: string[];
  environment: Record<string, string>;
  workingDirectory?: string;
  killSignal: NodeJS.Signals;
}

// Schema for command validation
const commandSchema = z.object({
  command: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid command format'),
  args: z.array(z.string()).optional(),
  options: z.object({
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
    timeout: z.number().positive().optional()
  }).optional()
});

export class SafeExecutor {
  private config: ExecutionConfig;
  private activeProcesses = new Set<ChildProcess>();

  constructor(config?: Partial<ExecutionConfig>) {
    this.config = {
      timeout: 30000, // 30 seconds
      maxStdoutSize: 1024 * 1024, // 1MB
      maxStderrSize: 1024 * 1024, // 1MB
      allowedCommands: [
        'node', 'npm', 'npx', 'git', 'docker', 'kubectl',
        'ls', 'cat', 'grep', 'find', 'echo', 'mkdir',
        'cp', 'mv', 'rm', 'chmod', 'curl', 'wget'
      ],
      blockedCommands: [
        'sudo', 'su', 'passwd', 'chown', 'chgrp',
        'mount', 'umount', 'fdisk', 'dd', 'mkfs',
        'eval', 'exec', 'sh', 'bash', 'zsh', 'fish',
        'python', 'ruby', 'perl', 'php'
      ],
      environment: {
        NODE_ENV: 'production',
        PATH: process.env.PATH || ''
      },
      killSignal: 'SIGTERM',
      ...config
    };
  }

  /**
   * Safely execute a command with arguments
   */
  public async executeCommand(
    command: string,
    args: string[] = [],
    options: Partial<SpawnOptions> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate input using schema
      const validatedInput = commandSchema.parse({
        command,
        args,
        options
      });

      // Security validations
      const securityCheck = this.validateCommandSecurity(validatedInput.command);
      if (!securityCheck.isValid) {
        throw new Error(`Security violation: ${securityCheck.error}`);
      }

      // Sanitize arguments
      const sanitizedArgs = this.sanitizeArguments(args);

      // Prepare spawn options
      const spawnOptions: SpawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...this.config.environment, ...options.env },
        cwd: options.cwd || this.config.workingDirectory,
        shell: false, // Critical: never use shell
        detached: false,
        ...options
      };

      return await this.spawnProcess(validatedInput.command, sanitizedArgs, spawnOptions, startTime);

    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: -1,
        signal: null,
        duration: Date.now() - startTime
      };
    }
  }

  private validateCommandSecurity(command: string): { isValid: boolean; error?: string } {
    // Check blocked commands
    if (this.config.blockedCommands.includes(command)) {
      return {
        isValid: false,
        error: `Command '${command}' is explicitly blocked for security reasons`
      };
    }

    // Check allowed commands (if allowlist is enabled)
    if (this.config.allowedCommands.length > 0 && !this.config.allowedCommands.includes(command)) {
      return {
        isValid: false,
        error: `Command '${command}' is not in the allowed list`
      };
    }

    // Additional security checks
    if (command.includes('/') || command.includes('\\')) {
      return {
        isValid: false,
        error: 'Command must not contain path separators'
      };
    }

    if (command.length > 50) {
      return {
        isValid: false,
        error: 'Command name too long'
      };
    }

    return { isValid: true };
  }

  private sanitizeArguments(args: string[]): string[] {
    return args.map(arg => {
      // Remove shell metacharacters
      const sanitized = arg.replace(/[;&|`$(){}[\]<>'"\\]/g, '');

      // Limit argument length
      if (sanitized.length > 1000) {
        throw new Error(`Argument too long: ${sanitized.substring(0, 50)}...`);
      }

      return sanitized;
    });
  }

  private async spawnProcess(
    command: string,
    args: string[],
    options: SpawnOptions,
    startTime: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, options);
      this.activeProcesses.add(childProcess);

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Set up timeout
      if (this.config.timeout > 0) {
        timeoutId = setTimeout(() => {
          this.killProcess(childProcess);
          reject(new Error(`Command timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      }

      // Handle stdout with size limits
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (stdout.length + chunk.length > this.config.maxStdoutSize) {
            this.killProcess(childProcess);
            reject(new Error('stdout size limit exceeded'));
            return;
          }
          stdout += chunk;
        });
      }

      // Handle stderr with size limits
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          if (stderr.length + chunk.length > this.config.maxStderrSize) {
            this.killProcess(childProcess);
            reject(new Error('stderr size limit exceeded'));
            return;
          }
          stderr += chunk;
        });
      }

      // Handle process exit
      childProcess.on('close', (code, signal) => {
        this.activeProcesses.delete(childProcess);
        if (timeoutId) clearTimeout(timeoutId);

        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          signal,
          duration: Date.now() - startTime,
          pid: childProcess.pid
        });
      });

      // Handle errors
      childProcess.on('error', (error) => {
        this.activeProcesses.delete(childProcess);
        if (timeoutId) clearTimeout(timeoutId);

        reject(new Error(`Process error: ${error.message}`));
      });
    });
  }

  private killProcess(childProcess: ChildProcess): void {
    try {
      if (!childProcess.killed && childProcess.pid) {
        childProcess.kill(this.config.killSignal);

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }
    } catch (error) {
      console.warn(`Failed to kill process ${childProcess.pid}: ${error.message}`);
    }
  }

  /**
   * Execute npm command safely
   */
  public async executeNpm(subcommand: string, args: string[] = [], options: Partial<SpawnOptions> = {}): Promise<ExecutionResult> {
    const allowedNpmCommands = ['install', 'update', 'audit', 'test', 'run', 'version', 'info', 'list'];

    if (!allowedNpmCommands.includes(subcommand)) {
      throw new Error(`npm subcommand '${subcommand}' is not allowed`);
    }

    return this.executeCommand('npm', [subcommand, ...args], options);
  }

  /**
   * Execute git command safely
   */
  public async executeGit(subcommand: string, args: string[] = [], options: Partial<SpawnOptions> = {}): Promise<ExecutionResult> {
    const allowedGitCommands = [
      'status', 'diff', 'log', 'show', 'add', 'commit',
      'push', 'pull', 'fetch', 'branch', 'checkout',
      'merge', 'rebase', 'reset', 'stash', 'tag'
    ];

    if (!allowedGitCommands.includes(subcommand)) {
      throw new Error(`git subcommand '${subcommand}' is not allowed`);
    }

    return this.executeCommand('git', [subcommand, ...args], options);
  }

  /**
   * Kill all active processes
   */
  public killAllProcesses(): void {
    for (const process of this.activeProcesses) {
      this.killProcess(process);
    }
    this.activeProcesses.clear();
  }

  /**
   * Get active process count
   */
  public getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Update security configuration
   */
  public updateConfig(config: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Pre-configured executors for common use cases
export class DevSafeExecutor extends SafeExecutor {
  constructor() {
    super({
      allowedCommands: [
        'node', 'npm', 'npx', 'git', 'docker', 'kubectl',
        'ls', 'cat', 'grep', 'find', 'echo', 'mkdir',
        'cp', 'mv', 'rm', 'chmod', 'curl', 'wget',
        'tsc', 'eslint', 'prettier', 'jest', 'vitest'
      ],
      timeout: 60000, // 1 minute for dev operations
      maxStdoutSize: 5 * 1024 * 1024 // 5MB for larger outputs
    });
  }
}

export class ProductionSafeExecutor extends SafeExecutor {
  constructor() {
    super({
      allowedCommands: ['node', 'npm'], // Very restrictive for production
      timeout: 10000, // 10 seconds
      blockedCommands: [
        'sudo', 'su', 'passwd', 'chown', 'chgrp',
        'mount', 'umount', 'fdisk', 'dd', 'mkfs',
        'eval', 'exec', 'sh', 'bash', 'zsh', 'fish',
        'python', 'ruby', 'perl', 'php', 'curl', 'wget'
      ]
    });
  }
}