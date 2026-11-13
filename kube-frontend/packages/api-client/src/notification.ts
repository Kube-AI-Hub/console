import type { Client } from './client';
import type { KubeObject } from './resources';

/**
 * Notification channels — the platform's outbound message configuration.
 *
 * KubeSphere 4.x keeps this in its own API group, and the shape is three objects per
 * channel rather than one:
 *
 * - a **Config** (`configs`) holds the transport settings, e.g. the SMTP host and sender;
 * - a **Receiver** (`receivers`) holds where messages go and whether the channel is on;
 * - a **Secret** (`secrets`, v2beta1) holds the credential, because the Config only
 *   references it (`valueFrom.secretKeyRef`).
 *
 * The old console writes and reads exactly these three (`stores/notification/*`), and the
 * split is why saving a channel is three requests that have to stay consistent.
 */
const NOTIFICATION_V2 = '/kapis/notification.kubesphere.io/v2beta2';
/** Secrets moved to the notification group as well; v2beta1 is what this server serves. */
const NOTIFICATION_SECRETS = '/kapis/notification.kubesphere.io/v2beta1/secrets';

/** The channels the platform supports, in the old console's order. */
export const NOTIFICATION_CHANNELS = ['mail', 'dingtalk', 'wecom', 'slack', 'webhook'] as const;
export type NotificationChannelKey = (typeof NOTIFICATION_CHANNELS)[number];

/** One notification object, as far as this app reads it. */
export interface NotificationObject extends KubeObject {
  spec?: Record<string, unknown>;
  /** Secret only. */
  data?: Record<string, string>;
  /** Secret only. */
  type?: string;
}

/** Whether a channel exists on the platform, and which objects make it up. */
export interface ChannelStatus {
  config: NotificationObject | null;
  receiver: NotificationObject | null;
  /** The Secret is read only for its key names; the values stay unread. */
  secretName: string;
  configured: boolean;
  enabled: boolean;
}

type Resource = 'configs' | 'receivers';

function resourcePath(resource: Resource, name?: string): string {
  return `${NOTIFICATION_V2}/${resource}${name ? `/${encodeURIComponent(name)}` : ''}`;
}

/**
 * Create-or-replace one object.
 *
 * The two verbs address different paths: a creation POSTs to the **collection**
 * (`/configs`), while a replace PUTs to the **object** (`/configs/<name>`). Posting to the
 * object path answers 405, which is how this was found.
 */
/**
 * Create-or-replace one notification object.
 *
 * The two verbs address different paths: a creation POSTs to the **collection**
 * (`/configs`), while a replace PUTs to the **object** (`/configs/<name>`). Posting to the
 * object path answers 405, which is how this was found.
 *
 * A replace also needs the `resourceVersion` currently held by the server, so the object is
 * read first — the same read-then-put the old console does.
 */
function upsert(client: Client, collection: Resource, name: string) {
  const objectPath = resourcePath(collection, name);
  return {
    async save(body: NotificationObject): Promise<NotificationObject> {
      let current: NotificationObject | undefined;
      try {
        current = await client.request<NotificationObject>(objectPath);
      } catch {
        // Not there yet: creating is the normal first save.
        current = undefined;
      }
      if (!current) {
        return client.request<NotificationObject>(resourcePath(collection), {
          method: 'POST',
          body: { ...body, metadata: { ...body.metadata, name } },
        });
      }
      const withVersion: NotificationObject = {
        ...body,
        metadata: {
          ...body.metadata,
          name,
          // Only present when the server reported one; `exactOptionalPropertyTypes` will
          // not accept an explicit `undefined`.
          ...(current.metadata?.resourceVersion ? { resourceVersion: current.metadata.resourceVersion } : {}),
        },
      };
      return client.request<NotificationObject>(objectPath, { method: 'PUT', body: withVersion });
    },
    async remove(): Promise<void> {
      await client.request(objectPath, { method: 'DELETE' });
    },
    async get(): Promise<NotificationObject | null> {
      try {
        return await client.request<NotificationObject>(objectPath);
      } catch {
        // A channel that was never configured is a normal state, not an error.
        return null;
      }
    },
  };
}


/** Config objects (`configs`). */
export function notificationConfigApi(client: Client) {
  return {
    forName: (name: string) => upsert(client, 'configs', name),
  };
}

/** Receiver objects (`receivers`). */
export function notificationReceiverApi(client: Client) {
  return {
    forName: (name: string) => upsert(client, 'receivers', name),
  };
}

/**
 * Notification secrets (global, no namespace).
 *
 * The credential lives here and the Config points at it by name; the old console
 * base64-encodes the password before writing (`safeBtoa`), which is why the page must not
 * send the plain value.
 */
export function notificationSecretApi(client: Client) {
  return {
    path: (name: string) => `${NOTIFICATION_SECRETS}/${encodeURIComponent(name)}`,
    async get(name: string): Promise<NotificationObject | null> {
      try {
        return await client.request<NotificationObject>(`${NOTIFICATION_SECRETS}/${encodeURIComponent(name)}`);
      } catch {
        return null;
      }
    },
    async save(name: string, data: Record<string, string>): Promise<void> {
      let current: NotificationObject | null = null;
      try {
        current = await client.request<NotificationObject>(`${NOTIFICATION_SECRETS}/${encodeURIComponent(name)}`);
      } catch {
        current = null;
      }
      const body: NotificationObject = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name,
          ...(current?.metadata?.resourceVersion
            ? { resourceVersion: current.metadata.resourceVersion }
            : {}),
        },
        type: 'Opaque',
        data,
      };
      await client.request(`${NOTIFICATION_SECRETS}/${encodeURIComponent(name)}`, {
        method: current ? 'PUT' : 'POST',
        body,
      });
    },
    async remove(name: string): Promise<void> {
      await client.request(`${NOTIFICATION_SECRETS}/${encodeURIComponent(name)}`, { method: 'DELETE' });
    },
  };
}

/** The result of asking the platform to send a test message. */
export interface VerifyResult {
  ok: boolean;
  /** The server's sentence on failure; empty on success. */
  message: string;
}

/**
 * Send a test message through a channel without saving it.
 *
 * Two details from the old console are load-bearing here:
 *
 * - the endpoint answers **HTTP 200 even when delivery fails**; the verdict is
 *   `Status` inside the body (`BaseForm.handleVerify` checks exactly that), so a client
 *   that trusted the status code would report success for an unreachable SMTP server;
 * - the payload is a Config and a Receiver carrying the `notification-manager` labels,
 *   not the saved objects' names.
 */
export function notificationVerifyApi(client: Client) {
  return {
    async verify(payload: { config?: Record<string, unknown>; receiver?: Record<string, unknown> }): Promise<VerifyResult> {
      const body = {
        config: {
          apiVersion: 'notification.kubesphere.io/v2beta2',
          kind: 'Config',
          metadata: {
            name: 'test-user-config',
            labels: { app: 'notification-manager', type: 'default' },
          },
          spec: payload.config ?? {},
        },
        receiver: {
          apiVersion: 'notification.kubesphere.io/v2beta2',
          kind: 'Receiver',
          metadata: {
            name: 'test-user-receiver',
            labels: { app: 'notification-manager', type: 'global' },
          },
          spec: payload.receiver ?? {},
        },
      };
      const response = await client.request<{ Status?: number; Message?: string }>(
        `${NOTIFICATION_V2}/verification`,
        { method: 'POST', body },
      );
      const status = response?.Status;
      return status === 200
        ? { ok: true, message: '' }
        : { ok: false, message: response?.Message ?? 'verification failed' };
    },
  };
}

/**
 * Channel key → the key its objects use in `spec`.
 *
 * They are not the same word: the菜单 key is `mail` and `wecom`, while the notification
 * objects call them `email` and `wechat` (the old console's forms pass `name="email"` /
 * `name="wechat"`). Looking `enabled` up under the menu key silently reports every channel
 * as disabled.
 */
export const CHANNEL_SPEC_KEY: Record<NotificationChannelKey, string> = {
  mail: 'email',
  dingtalk: 'dingtalk',
  wecom: 'wechat',
  slack: 'slack',
  webhook: 'webhook',
};

/** Whether a channel can send, from its receiver's `enabled` flag. */
export function channelEnabled(receiver: NotificationObject | null, key: NotificationChannelKey): boolean {
  const spec = (receiver?.spec ?? {}) as Record<string, unknown>;
  const channel = (spec[CHANNEL_SPEC_KEY[key]] ?? {}) as Record<string, unknown>;
  return channel['enabled'] === true;
}

/**
 * Read one channel's three objects.
 *
 * Absent objects are a valid state (nothing configured yet), so this reports presence
 * rather than failing: `configured` is true only when the Config exists, which is what
 * makes the channel usable.
 */
export async function readChannel(
  client: Client,
  params: { key: NotificationChannelKey; configName: string; receiverName: string; secretName: string },
): Promise<ChannelStatus> {
  const [config, receiver, secret] = await Promise.all([
    notificationConfigApi(client).forName(params.configName).get(),
    notificationReceiverApi(client).forName(params.receiverName).get(),
    notificationSecretApi(client).get(params.secretName),
  ]);
  return {
    config,
    receiver,
    secretName: secret ? params.secretName : '',
    configured: config !== null,
    enabled: channelEnabled(receiver, params.key),
  };
}
