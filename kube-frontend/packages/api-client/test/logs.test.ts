import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors';
import { DEFAULT_TAIL_LINES, openPodLogStream, podLogPath } from '../src/logs';

/**
 * The log stream is the first chunked read in the client, and every one of its
 * parameters is load-bearing:
 *
 * - `podLogPath` has to agree with the BFF's kube mode (`/api/v1/clusters/<c>/…`).
 * - the follow request must NOT carry `tailLines`: the upstream only flushes
 *   once ~4 KB accumulate, so a small tail would never return headers at all.
 * - a non-2xx has to become an `ApiError`, not log lines decoded from an HTML
 *   error page.
 */

interface Call {
  path: string;
  query: Record<string, string> | undefined;
}

function clientReturning(chunks: string[], calls: Call[]) {
  return {
    stream: async (path: string, init?: { query?: Record<string, string> }) => {
      calls.push({ path, query: init?.query });
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
          },
        }),
        { status: 200 },
      );
    },
  };
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of iterable) out.push(line);
  return out;
}

describe('podLogPath', () => {
  it('addresses the kube log subresource on the host cluster', () => {
    expect(podLogPath({ cluster: 'host', namespace: 'demo', pod: 'web-0', container: 'web' })).toBe(
      '/api/v1/namespaces/demo/pods/web-0/log',
    );
  });

  it('keeps the member-cluster segment and encodes path segments', () => {
    expect(podLogPath({ cluster: 'a b', namespace: 'demo', pod: 'web-0' })).toBe(
      '/api/v1/clusters/a%20b/namespaces/demo/pods/web-0/log',
    );
  });
});

describe('openPodLogStream', () => {
  it('reads a tail with tailLines and splits lines, dropping blanks and CR', async () => {
    const calls: Call[] = [];
    const client = clientReturning(['first line\r\n', '\n', 'second', ' line\nthird\n'], calls);

    const lines = await collect(openPodLogStream(client, { cluster: 'host', namespace: 'demo', pod: 'web-0' }));

    expect(lines).toEqual(['first line', 'second line', 'third']);
    expect(calls[0]!.path).toBe('/api/v1/namespaces/demo/pods/web-0/log');
    expect(calls[0]!.query).toEqual({ tailLines: String(DEFAULT_TAIL_LINES) });
  });

  it('follows without tailLines: a small tail would never be flushed upstream', async () => {
    const calls: Call[] = [];
    const client = clientReturning(['line\n'], calls);

    await collect(
      openPodLogStream(client, {
        cluster: 'host',
        namespace: 'demo',
        pod: 'web-0',
        container: 'web',
        follow: true,
        timestamps: true,
        tailLines: 5,
      }),
    );

    expect(calls[0]!.query).toEqual({ container: 'web', timestamps: 'true', follow: 'true' });
    expect(calls[0]!.query).not.toHaveProperty('tailLines');
  });

  it('turns a non-2xx into an ApiError instead of decoding the body', async () => {
    const client = {
      stream: async () => {
        throw new ApiError({ code: 'forbidden', message: 'pods "web-0" is forbidden' }, 403);
      },
    };

    const error = await collect(openPodLogStream(client, { cluster: 'host', namespace: 'demo', pod: 'web-0' }))
      .then(() => undefined)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });

  it('close() ends the read instead of rejecting', async () => {
    // A follow response never ends by itself; model that, and make the read fail
    // the way an aborted fetch does.
    const client = {
      stream: async (_path: string, init?: { signal?: AbortSignal }) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('first\n'));
              init?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              );
            },
          }),
          { status: 200 },
        ),
    };

    const stream = openPodLogStream(client, { cluster: 'host', namespace: 'demo', pod: 'web-0', follow: true });
    const iterator = stream[Symbol.asyncIterator]();

    expect(await iterator.next()).toMatchObject({ done: false, value: 'first' });
    stream.close();
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
  });
});
