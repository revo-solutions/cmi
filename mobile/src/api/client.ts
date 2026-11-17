export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
  }
}

export class ApiUnavailableError extends Error {}

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

export async function apiClient<T>(path: string, init: RequestInit): Promise<T> {
  if (!apiUrl || !/^https?:\/\/[^\s/]/i.test(apiUrl)) {
    throw new ApiUnavailableError();
  }

  const controller = new AbortController();
  const signal = init.signal;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) {
    abort();
  }
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${apiUrl}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new ApiError(response.status);
    }
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiUnavailableError();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
