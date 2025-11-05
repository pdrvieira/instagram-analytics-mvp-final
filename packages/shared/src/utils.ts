/**
 * Shared utility functions
 */

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const jitter = Math.random() * 0.1 * delayMs; // 10% jitter
      const waitTime = Math.min(delayMs + jitter, maxDelayMs);

      await sleep(waitTime);
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create a simple mutex for synchronizing access to resources
 */
export class Mutex {
  private locked = false;
  private queue: Array<(v?: unknown) => void> = [];

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    while (this.locked) {
      await new Promise((resolve) => this.queue.push(resolve));
    }

    this.locked = true;

    try {
      return await fn();
    } finally {
      this.locked = false;
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
      }
    }
  }
}

/**
 * Format a date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an ISO date string
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(
  engagement: number,
  reach: number
): number {
  if (reach === 0) return 0;
  return (engagement / reach) * 100;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Instagram username format
 */
export function isValidInstagramUsername(username: string): boolean {
  // Instagram usernames: 1-30 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_.]{1,30}$/;
  return usernameRegex.test(username);
}

/**
 * Generate a unique ID for jobs
 */
export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Create a logger instance
 */
export function createLogger(namespace: string) {
  const prefix = `[${namespace}]`;

  return {
    debug: (message: string, data?: unknown) => {
      try {
        // Use globalThis to avoid referencing `process` directly (no @types/node needed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybeProcess: any = (globalThis as any)['process'];
        if (maybeProcess?.env?.DEBUG === 'true') {
          console.debug(prefix, message, data);
        }
      } catch {
        // ignore
      }
    },
    info: (message: string, data?: unknown) => {
      console.log(prefix, message, data);
    },
    warn: (message: string, data?: unknown) => {
      console.warn(prefix, message, data);
    },
    error: (message: string, error?: unknown) => {
      console.error(prefix, message, error);
    },
  };
}
