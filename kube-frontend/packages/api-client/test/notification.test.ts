import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../src/client';
import {
  channelEnabled,
  notificationConfigApi,
  notificationSecretApi,
  notificationVerifyApi,
  readChannel,
} from '../src/notification';

/**
 * Notification channels are three objects per channel (config, receiver, secret), and the
 * platform's judgement is inside the response body rather than the HTTP status. Both
 * details are easy to get wrong in a way that looks like it works.
 */

interface Call {
  path: string;
  method?: string;
  body?: unknown;
}

function recordingClient(handler: (path: string, init: RequestOptions) => unknown): {
  client: { request: <T>(path: string, init?: RequestOptions) => Promise<T> };
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
        const method = init.method ?? 'GET';
        calls.push({ path, method, ...(init.body ? { body: init.body } : {}) });
        return handler(path, init) as T;
      },
    },
  };
}

describe('upsert semantics', () => {
  it('creates when the object is absent', async () => {
    const { client, calls } = recordingClient((_path, init) => {
      if ((init.method ?? 'GET') === 'GET') throw new Error('not found');
      return {};
    });
    await notificationConfigApi(client)
      .forName('default-email-config')
      .save({ apiVersion: 'notification.kubesphere.io/v2beta2', kind: 'Config', metadata: { name: 'default-email-config' }, spec: {} });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(calls[1]?.path).toBe('/kapis/notification.kubesphere.io/v2beta2/configs');
    expect(calls[1]?.method).toBe('POST');
  });

  it('puts the resourceVersion it just read when the object exists', async () => {
    // ks-apiserver refuses a PUT without the version it holds; the old console reads it
    // first for the same reason.
    const { client, calls } = recordingClient((_path, init) =>
      init.method === 'PUT' ? {} : { metadata: { resourceVersion: '42' } },
    );
    await notificationConfigApi(client)
      .forName('default-email-config')
      .save({ apiVersion: 'notification.kubesphere.io/v2beta2', kind: 'Config', metadata: { name: 'default-email-config' }, spec: {} });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PUT']);
    const body = calls[1]?.body as { metadata?: { resourceVersion?: string } };
    expect(body.metadata?.resourceVersion).toBe('42');
  });

  it('treats a missing object as "not configured" rather than an error', async () => {
    const { client } = recordingClient(() => {
      throw new Error('404');
    }, );
    await expect(notificationConfigApi(client).forName('x').get()).resolves.toBeNull();
  });
});

describe('secret handling', () => {
  it('writes base64 data against the notification secret endpoint', async () => {
    const { client, calls } = recordingClient((_path, init) => (init.method === 'POST' ? {} : {}));
    await notificationSecretApi(client).save('global-email-config-secret', { authPassword: 'cEBzcw==' });
    const post = calls.find((c) => c.method !== 'GET');
    expect(post?.path).toBe('/kapis/notification.kubesphere.io/v2beta1/secrets/global-email-config-secret');
    expect((post?.body as { data?: Record<string, string> }).data?.authPassword).toBe('cEBzcw==');
    expect((post?.body as { type?: string }).type).toBe('Opaque');
  });
});

describe('verification', () => {
  it('reports success only when the body Status is 200', async () => {
    // The endpoint answers HTTP 200 for an unreachable SMTP server; the verdict is in the
    // body. Trusting the status code would tell the reader a dead server works.
    const { client } = recordingClient(() => ({ Status: 200 }));
    await expect(notificationVerifyApi(client).verify({ config: {}, receiver: {} })).resolves.toEqual({
      ok: true,
      message: '',
    });
  });

  it('carries the server message when delivery fails', async () => {
    const { client } = recordingClient(() => ({
      Status: 400,
      Message: 'dial tcp: lookup smtp.invalid: no such host',
    }));
    const result = await notificationVerifyApi(client).verify({ config: {}, receiver: {} });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no such host');
  });

  it('labels the payload the way the notification manager expects', async () => {
    const { client, calls } = recordingClient(() => ({ Status: 200 }));
    await notificationVerifyApi(client).verify({ config: { email: {} }, receiver: { email: {} } });
    const body = calls[0]?.body as {
      config: { metadata: { labels: Record<string, string> } };
      receiver: { metadata: { labels: Record<string, string> } };
    };
    expect(body.config.metadata.labels).toMatchObject({ app: 'notification-manager', type: 'default' });
    expect(body.receiver.metadata.labels).toMatchObject({ app: 'notification-manager', type: 'global' });
  });
});

describe('channel state', () => {
  it('reads enabled from the receiver, and configured from the config', () => {
    // The menu calls it `mail`; the objects call it `email`.
    expect(channelEnabled({ spec: { email: { enabled: true } } }, 'mail')).toBe(true);
    expect(channelEnabled({ spec: { wechat: { enabled: true } } }, 'wecom')).toBe(true);
    expect(channelEnabled({ spec: { email: { enabled: false } } }, 'mail')).toBe(false);
    expect(channelEnabled(null, 'mail')).toBe(false);
  });

  it('reports a channel as configured only when its config exists', async () => {
    const { client } = recordingClient((path) => {
      if (path.includes('/configs/')) return { spec: { email: {} } };
      if (path.includes('/receivers/')) return { spec: { email: { enabled: true } } };
      throw new Error('404');
    });
    const status = await readChannel(client, {
      key: 'mail',
      configName: 'default-email-config',
      receiverName: 'global-email-receiver',
      secretName: 'global-email-config-secret',
    });
    expect(status.configured).toBe(true);
    expect(status.enabled).toBe(true);
    // No secret exists, so it is not claimed.
    expect(status.secretName).toBe('');
  });
});
