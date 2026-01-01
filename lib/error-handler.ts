/**
 * Error handling utilities for graceful degradation
 * When blockchain or AI services are unavailable, the app falls back to simulated mode
 */

export type Mode = 'real' | 'simulated';

export interface WithFallbackResult<T> {
  data: T;
  mode: Mode;
  error?: string;
}

/**
 * Execute an async operation with graceful fallback
 * If the primary operation fails, the fallback is used
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<WithFallbackResult<T>> {
  try {
    const data = await primary();
    if (context) {
      console.log(`[${context}] Using real data`);
    }
    return { data, mode: 'real' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (context) {
      console.warn(`[${context}] Falling back to simulated mode:`, errorMessage);
    }
    return { data: fallback, mode: 'simulated', error: errorMessage };
  }
}

/**
 * Execute multiple async operations with graceful fallback
 * Returns results for all operations, with individual fallbacks
 */
export async function withFallbackAll<T extends Record<string, unknown>>(
  operations: { [K in keyof T]: { primary: () => Promise<T[K]>; fallback: T[K] } },
  context?: string
): Promise<{ data: T; mode: Mode; errors: Partial<Record<keyof T, string>> }> {
  const results: Partial<T> = {};
  const errors: Partial<Record<keyof T, string>> = {};
  let hasRealData = false;

  for (const [key, op] of Object.entries(operations) as [keyof T, { primary: () => Promise<T[keyof T]>; fallback: T[keyof T] }][]) {
    try {
      results[key] = await op.primary();
      hasRealData = true;
    } catch (error) {
      results[key] = op.fallback;
      errors[key] = error instanceof Error ? error.message : 'Unknown error';
      if (context) {
        console.warn(`[${context}] ${String(key)} failed, using fallback`);
      }
    }
  }

  return {
    data: results as T,
    mode: hasRealData ? 'real' : 'simulated',
    errors,
  };
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, context } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        if (context) {
          console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (context) {
        console.warn(`[${context}] Operation timed out after ${timeoutMs}ms`);
      }
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Log the current operating mode for debugging
 */
export function logMode(service: string, mode: Mode, details?: Record<string, unknown>) {
  const emoji = mode === 'real' ? '🔗' : '🔄';
  console.log(`${emoji} [${service}] Mode: ${mode}`, details || '');
}

/**
 * Check if an error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    );
  }
  return false;
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
