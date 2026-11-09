import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@kube-ai-hub/api-client';

/**
 * Query client shared by the app.
 *
 * Retry policy is deliberate rather than the default three blind retries:
 * retrying a 403 or 404 only delays the error the user needs to see, and an
 * agent polling the page would watch `loading` for two extra seconds before
 * learning it has no permission.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) return error.retryable && failureCount < 2;
          return failureCount < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}
