import type { LocaleKey } from '@kube-ai-hub/locales';
// The channel domain's own union (notification.ts), not the read-only overview list in
// access.ts: the pages here render every channel the notification API supports.
import type { NotificationChannelSpecKey as NotificationChannelKey } from '@kube-ai-hub/api-client';

/**
 * What each notification channel needs, declared once.
 *
 * The five channels differ in which object holds a value, not in how the page works: every
 * channel has a Config (transport), a Receiver (recipients + enabled) and a Secret
 * (credentials). Declaring the differences — object names, field paths, validation — means
 * one page renders all of them, and a wrong path is a wrong entry in one table rather than
 * a wrong line in five similar components.
 *
 * Every path here was read off the old console's per-channel form
 * (`src/components/Forms/Notification/*Form`), which is what the platform expects.
 */
export type FieldKind = 'text' | 'password' | 'list' | 'boolean' | 'select';

/** Where a value is written. `annotation` targets the receiver's metadata. */
export type FieldTarget = 'config' | 'receiver' | 'secret' | 'annotation';

/** A path segment: a literal key, or the value of another field (a mode selector). */
export type PathSegment = string | { from: string };

/** A condition on another field's value; an array means "any of these values". */
export interface VisibleWhen {
  key: string;
  equals: string | string[];
}

export interface ChannelField {
  key: string;
  target: FieldTarget;
  path: PathSegment[];
  kind: FieldKind;
  labelKey: LocaleKey;
  required?: boolean;
  /** Extra validation beyond "not empty". */
  rule?: 'email' | 'port' | 'url';
  hintKey?: LocaleKey;
  placeholder?: string;
  /** Only rendered (and only written) when another field has this value. */
  visibleWhen?: VisibleWhen;
  options?: { value: string; labelKey: LocaleKey }[];
  /** Default shown for a channel that was never configured. */
  defaultValue?: string;
}

/**
 * A `valueFrom.secretKeyRef` written into the Config or the Receiver.
 *
 * More than one is needed: Feishu references App ID / App Secret from the Config and the
 * bot webhook / signing secret from the Receiver, and each reference names a different key
 * of the same Secret.
 */
export interface SecretRef {
  target: 'config' | 'receiver';
  path: PathSegment[];
  /** Key inside the channel's Secret. */
  secretKey: string;
  /** Write the reference only while this mode/field is selected. */
  visibleWhen?: VisibleWhen;
}

export interface ChannelDescriptor {
  key: NotificationChannelKey;
  /** The name the channel's objects use in `spec`. Not always the menu key. */
  specKey: string;
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  /** `null` for channels whose Config the platform does not use. */
  configName: string | null;
  receiverName: string;
  secretName: string;
  fields: ChannelField[];
  /**
   * Work out a mode selector's saved value from the receiver.
   *
   * The mode itself is not stored: it is implied by which key the receiver has (WeCom
   * writes `spec.wechat.toUser`, DingTalk writes `spec.dingtalk.chatbot`). Without this the
   * page would always open on the first tab and silently switch modes on the next save.
   */
  inferMode?: (receiver: Record<string, unknown>) => string;
  /**
   * Fields written as a `valueFrom.secretKeyRef` instead of a value.
   *
   * Mail stores the SMTP password in the Secret and the Config only references it, so the
   * Config write has to carry that reference.
   */
  secretRef?: { path: PathSegment[]; secretKey: string };
  /** Several references, possibly on both the Config and the Receiver (see `SecretRef`). */
  secretRefs?: SecretRef[];
}

const ENABLED: ChannelField = {
  key: 'enabled',
  target: 'receiver',
  path: ['enabled'],
  kind: 'boolean',
  labelKey: 'channel.enabled',
  hintKey: 'channel.enabledHint',
};

export const CHANNELS: Record<NotificationChannelKey, ChannelDescriptor> = {
  mail: {
    key: 'mail',
    specKey: 'email',
    titleKey: 'mail.title',
    descriptionKey: 'mail.description',
    configName: 'default-email-config',
    receiverName: 'global-email-receiver',
    secretName: 'global-email-config-secret',
    secretRef: { path: ['email', 'authPassword'], secretKey: 'authPassword' },
    fields: [
      { key: 'host', target: 'config', path: ['email', 'smartHost', 'host'], kind: 'text', labelKey: 'mail.host', required: true, placeholder: 'smtp.example.com' },
      { key: 'port', target: 'config', path: ['email', 'smartHost', 'port'], kind: 'text', labelKey: 'mail.port', required: true, rule: 'port', defaultValue: '25' },
      { key: 'requireTLS', target: 'config', path: ['email', 'requireTLS'], kind: 'boolean', labelKey: 'mail.tls', defaultValue: 'true' },
      { key: 'username', target: 'config', path: ['email', 'authUsername'], kind: 'text', labelKey: 'mail.username', required: true },
      { key: 'password', target: 'secret', path: ['authPassword'], kind: 'password', labelKey: 'mail.password', hintKey: 'mail.passwordHint' },
      { key: 'from', target: 'config', path: ['email', 'from'], kind: 'text', labelKey: 'mail.from', required: true, rule: 'email' },
      { key: 'recipients', target: 'receiver', path: ['email', 'to'], kind: 'list', labelKey: 'mail.to', required: true, rule: 'email', hintKey: 'mail.recipientsHint' },
      ENABLED,
    ],
  },

  dingtalk: {
    key: 'dingtalk',
    specKey: 'dingtalk',
    titleKey: 'channel.dingtalk.title',
    descriptionKey: 'channel.dingtalk.description',
    configName: 'default-dingtalk-config',
    receiverName: 'global-dingtalk-receiver',
    secretName: 'global-dingtalk-config-secret',
    inferMode: (receiver) => {
      const dingtalk = read(receiver, ['spec', 'dingtalk']) as Record<string, unknown> | undefined;
      return dingtalk && 'chatbot' in dingtalk && !('conversation' in dingtalk) ? 'chatbot' : 'conversation';
    },
    fields: [
      {
        key: 'mode',
        target: 'receiver',
        path: ['mode'],
        kind: 'select',
        labelKey: 'channel.dingtalk.mode',
        defaultValue: 'conversation',
        options: [
          { value: 'conversation', labelKey: 'channel.dingtalk.modeConversation' },
          { value: 'chatbot', labelKey: 'channel.dingtalk.modeChatbot' },
        ],
      },
      // 会话（企业内部应用）：App Key/Secret + 会话 ID
      { key: 'appkey', target: 'secret', path: ['appkey'], kind: 'text', labelKey: 'channel.dingtalk.appKey', required: true, visibleWhen: { key: 'mode', equals: 'conversation' } },
      { key: 'appsecret', target: 'secret', path: ['appsecret'], kind: 'password', labelKey: 'channel.dingtalk.appSecret', required: true, visibleWhen: { key: 'mode', equals: 'conversation' } },
      { key: 'chatids', target: 'receiver', path: ['dingtalk', 'conversation', 'chatids'], kind: 'list', labelKey: 'channel.dingtalk.chatids', required: true, visibleWhen: { key: 'mode', equals: 'conversation' }, hintKey: 'channel.dingtalk.chatidsHint' },
      // 机器人：Webhook + Secret + 关键词
      { key: 'webhook', target: 'secret', path: ['webhook'], kind: 'text', labelKey: 'channel.dingtalk.webhook', rule: 'url', visibleWhen: { key: 'mode', equals: 'chatbot' } },
      { key: 'chatbotsecret', target: 'secret', path: ['chatbotsecret'], kind: 'password', labelKey: 'channel.dingtalk.chatbotSecret', visibleWhen: { key: 'mode', equals: 'chatbot' } },
      { key: 'keywords', target: 'receiver', path: ['dingtalk', 'chatbot', 'keywords'], kind: 'list', labelKey: 'channel.dingtalk.keywords', visibleWhen: { key: 'mode', equals: 'chatbot' }, hintKey: 'channel.dingtalk.keywordsHint' },
      ENABLED,
    ],
  },

  wecom: {
    key: 'wecom',
    specKey: 'wechat',
    titleKey: 'channel.wecom.title',
    descriptionKey: 'channel.wecom.description',
    configName: 'default-wechat-config',
    receiverName: 'global-wechat-receiver',
    secretName: 'global-wechat-config-secret',
    // The platform requires the app secret to be referenced from the Config
    // (`spec.wechat.wechatApiSecret`): without the reference it rejects the Config outright.
    secretRef: { path: ['wechat', 'wechatApiSecret'], secretKey: 'appsecret' },
    inferMode: (receiver) => {
      const wechat = read(receiver, ['spec', 'wechat']) as Record<string, unknown> | undefined;
      for (const key of ['toUser', 'toParty', 'toTag']) {
        if (wechat && key in wechat) return key;
      }
      return 'toUser';
    },
    fields: [
      { key: 'corpId', target: 'config', path: ['wechat', 'wechatApiCorpId'], kind: 'text', labelKey: 'channel.wecom.corpId', required: true },
      { key: 'agentId', target: 'config', path: ['wechat', 'wechatApiAgentId'], kind: 'text', labelKey: 'channel.wecom.agentId', required: true },
      { key: 'appsecret', target: 'secret', path: ['appsecret'], kind: 'password', labelKey: 'channel.wecom.appSecret', required: true },
      {
        key: 'mode',
        target: 'receiver',
        path: ['mode'],
        kind: 'select',
        labelKey: 'channel.wecom.recipientType',
        defaultValue: 'toUser',
        options: [
          { value: 'toUser', labelKey: 'channel.wecom.toUser' },
          { value: 'toParty', labelKey: 'channel.wecom.toParty' },
          { value: 'toTag', labelKey: 'channel.wecom.toTag' },
        ],
      },
      // The receiver key is the selected type: `receiver.spec.wechat.toUser` and friends.
      { key: 'recipients', target: 'receiver', path: ['wechat', { from: 'mode' }], kind: 'list', labelKey: 'channel.wecom.recipients', required: true, hintKey: 'channel.wecom.recipientsHint' },
      ENABLED,
    ],
  },

  slack: {
    key: 'slack',
    specKey: 'slack',
    titleKey: 'channel.slack.title',
    descriptionKey: 'channel.slack.description',
    configName: 'default-slack-config',
    receiverName: 'global-slack-receiver',
    // Slack's secret is named `-token`, not `-secret`: the platform's convention for the
    // channels that carry a single token.
    secretName: 'global-slack-config-token',
    fields: [
      { key: 'token', target: 'secret', path: ['token'], kind: 'password', labelKey: 'channel.slack.token', required: true, hintKey: 'channel.slack.tokenHint' },
      { key: 'channels', target: 'receiver', path: ['slack', 'channels'], kind: 'list', labelKey: 'channel.slack.channels', required: true, hintKey: 'channel.slack.channelsHint' },
      ENABLED,
    ],
  },

  webhook: {
    key: 'webhook',
    specKey: 'webhook',
    titleKey: 'channel.webhook.title',
    descriptionKey: 'channel.webhook.description',
    // The old console's webhook page has no Config object: everything lives in the
    // Receiver, with credentials in the Secret.
    configName: null,
    receiverName: 'global-webhook-receiver',
    secretName: 'global-webhook-config-secret',
    fields: [
      { key: 'url', target: 'receiver', path: ['webhook', 'url'], kind: 'text', labelKey: 'channel.webhook.url', required: true, rule: 'url', placeholder: 'https://example.com/hooks/…' },
      {
        key: 'auth',
        target: 'annotation',
        path: ['kubesphere.io/verify-type'],
        kind: 'select',
        labelKey: 'channel.webhook.auth',
        defaultValue: 'no',
        options: [
          { value: 'no', labelKey: 'channel.webhook.authNone' },
          { value: 'token', labelKey: 'channel.webhook.authToken' },
          { value: 'basic', labelKey: 'channel.webhook.authBasic' },
        ],
      },
      { key: 'basicUsername', target: 'receiver', path: ['webhook', 'httpConfig', 'basicAuth', 'username'], kind: 'text', labelKey: 'channel.webhook.basicUser', required: true, visibleWhen: { key: 'auth', equals: 'basic' } },
      { key: 'basicPassword', target: 'secret', path: ['password'], kind: 'password', labelKey: 'channel.webhook.basicPassword', required: true, visibleWhen: { key: 'auth', equals: 'basic' } },
      { key: 'token', target: 'secret', path: ['token'], kind: 'password', labelKey: 'channel.webhook.token', required: true, visibleWhen: { key: 'auth', equals: 'token' } },
      { key: 'skipVerify', target: 'receiver', path: ['webhook', 'httpConfig', 'tlsConfig', 'insecureSkipVerify'], kind: 'boolean', labelKey: 'channel.webhook.skipVerify', defaultValue: 'false' },
      ENABLED,
    ],
  },
  feishu: {
    key: 'feishu',
    specKey: 'feishu',
    titleKey: 'channel.feishu.title',
    descriptionKey: 'channel.feishu.description',
    configName: 'default-feishu-config',
    receiverName: 'global-feishu-receiver',
    secretName: 'global-feishu-config-secret',
    /*
     * Feishu is the one channel with two transport shapes under one name:
     * an application (App ID/Secret + user or department ids) and a group robot
     * (webhook + signing secret + keywords). The application credentials are read
     * out of the Secret by the Config, and the robot credentials are read out of the
     * same Secret by the Receiver, so both objects carry references.
     */
    secretRefs: [
      {
        target: 'config',
        path: ['feishu', 'appID'],
        secretKey: 'appkey',
        visibleWhen: { key: 'mode', equals: ['user', 'department'] },
      },
      {
        target: 'config',
        path: ['feishu', 'appSecret'],
        secretKey: 'appsecret',
        visibleWhen: { key: 'mode', equals: ['user', 'department'] },
      },
      {
        target: 'receiver',
        path: ['feishu', 'chatbot', 'webhook'],
        secretKey: 'webhook',
        visibleWhen: { key: 'mode', equals: 'chatbot' },
      },
      {
        target: 'receiver',
        path: ['feishu', 'chatbot', 'secret'],
        secretKey: 'chatbotsecret',
        visibleWhen: { key: 'mode', equals: 'chatbot' },
      },
    ],
    inferMode: (receiver) => {
      // The saved receiver names the mode by which key it holds: spec.feishu.chatbot,
      // spec.feishu.department or spec.feishu.user.
      const feishu = read(receiver, ['spec', 'feishu']) as Record<string, unknown> | undefined;
      if (feishu && 'chatbot' in feishu) return 'chatbot';
      if (feishu && 'department' in feishu) return 'department';
      return 'user';
    },
    fields: [
      {
        key: 'mode',
        target: 'receiver',
        path: ['mode'],
        kind: 'select',
        labelKey: 'channel.feishu.mode',
        defaultValue: 'user',
        options: [
          { value: 'user', labelKey: 'channel.feishu.modeUser' },
          { value: 'department', labelKey: 'channel.feishu.modeDepartment' },
          { value: 'chatbot', labelKey: 'channel.feishu.modeChatbot' },
        ],
      },
      // Application (conversation) mode: App ID/Secret plus one recipient kind.
      {
        key: 'appkey',
        target: 'secret',
        path: ['appkey'],
        kind: 'text',
        labelKey: 'channel.feishu.appId',
        required: true,
        visibleWhen: { key: 'mode', equals: ['user', 'department'] },
      },
      {
        key: 'appsecret',
        target: 'secret',
        path: ['appsecret'],
        kind: 'password',
        labelKey: 'channel.feishu.appSecret',
        required: true,
        visibleWhen: { key: 'mode', equals: ['user', 'department'] },
      },
      {
        key: 'users',
        target: 'receiver',
        path: ['feishu', 'user'],
        kind: 'list',
        labelKey: 'channel.feishu.user',
        required: true,
        visibleWhen: { key: 'mode', equals: 'user' },
        hintKey: 'channel.feishu.userHint',
      },
      {
        key: 'departments',
        target: 'receiver',
        path: ['feishu', 'department'],
        kind: 'list',
        labelKey: 'channel.feishu.department',
        required: true,
        visibleWhen: { key: 'mode', equals: 'department' },
        hintKey: 'channel.feishu.departmentHint',
      },
      // Group robot: webhook + signing secret + keywords.
      {
        key: 'webhook',
        target: 'secret',
        path: ['webhook'],
        kind: 'text',
        labelKey: 'channel.feishu.webhook',
        rule: 'url',
        required: true,
        visibleWhen: { key: 'mode', equals: 'chatbot' },
      },
      {
        key: 'chatbotsecret',
        target: 'secret',
        path: ['chatbotsecret'],
        kind: 'password',
        labelKey: 'channel.feishu.secret',
        visibleWhen: { key: 'mode', equals: 'chatbot' },
      },
      {
        key: 'keywords',
        target: 'receiver',
        path: ['feishu', 'chatbot', 'keywords'],
        kind: 'list',
        labelKey: 'channel.feishu.keywords',
        visibleWhen: { key: 'mode', equals: 'chatbot' },
        hintKey: 'channel.feishu.keywordsHint',
      },
      ENABLED,
    ],
  },
};

/** Channels in the order the tabs show them; mail first, as the old console does. */
export const CHANNEL_ORDER: NotificationChannelKey[] = ['mail', 'dingtalk', 'wecom', 'slack', 'webhook', 'feishu'];

/** Whether a value satisfies a `visibleWhen` condition. */
function matches(when: VisibleWhen, values: Record<string, string>): boolean {
  const actual = values[when.key];
  return Array.isArray(when.equals) ? when.equals.includes(actual ?? '') : actual === when.equals;
}

/** Whether a field applies to the current form state. */
export function fieldVisible(field: ChannelField, values: Record<string, string>): boolean {
  if (!field.visibleWhen) return true;
  return matches(field.visibleWhen, values);
}

/** Resolve a path segment list against the current form state. */
function resolve(path: PathSegment[], values: Record<string, string>): string[] {
  return path.map((segment) => (typeof segment === 'string' ? segment : values[segment.from] ?? ''));
}

/** Write a value into a nested object at `path`, creating the objects it needs. */
function write(target: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor = target;
  for (const key of path.slice(0, -1)) {
    const next = cursor[key];
    if (typeof next !== 'object' || next === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (last !== undefined) cursor[last] = value;
}

/** Read a value from a nested object, or `undefined`. */
function read(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/**
 * Flatten the saved objects into the form's string map.
 *
 * Takes the objects as the API returns them (with `spec`/`metadata`), not their specs: the
 * receiver's `metadata.annotations` carry the webhook auth type, so unwrapping higher up
 * would lose it.
 */
export function toFormValues(
  descriptor: ChannelDescriptor,
  objects: { config: Record<string, unknown> | null; receiver: Record<string, unknown> | null },
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of descriptor.fields) {
    if (field.kind === 'boolean') {
      values[field.key] = field.defaultValue ?? 'false';
      continue;
    }
    if (field.kind === 'select') {
      // A mode selector is form state; its saved value comes from the receiver when the
      // receiver's key carries it (webhook's auth type is an annotation).
      values[field.key] = field.defaultValue ?? '';
      continue;
    }
    values[field.key] = field.defaultValue ?? '';
  }

  for (const field of descriptor.fields) {
    if (field.kind === 'select' && field.target !== 'annotation') continue;
    const source = field.target === 'config' ? objects.config : objects.receiver;
    if (!source) continue;
    // `enabled` lives beside the channel's spec, not inside it: spec.<channel>.enabled.
    const path =
      field.key === 'enabled'
        ? ['spec', descriptor.specKey, 'enabled']
        : ['spec', ...resolve(field.path, values)];
    const raw = read(
      field.target === 'annotation' ? (source as { metadata?: unknown }).metadata : source,
      field.target === 'annotation' ? resolve(field.path, values) : path,
    );
    if (raw === undefined) continue;
    if (field.kind === 'boolean') values[field.key] = raw === true ? 'true' : 'false';
    else if (field.kind === 'list') values[field.key] = Array.isArray(raw) ? raw.join(', ') : String(raw);
    else if (field.kind === 'select') values[field.key] = String(raw);
    else values[field.key] = String(raw);
  }

  if (descriptor.inferMode && objects.receiver) {
    const modeField = descriptor.fields.find((field) => field.kind === 'select' && field.target !== 'annotation');
    if (modeField) values[modeField.key] = descriptor.inferMode(objects.receiver);
  }

  return values;
}

/** Build the three request bodies from the form state. */
export function toBodies(
  descriptor: ChannelDescriptor,
  values: Record<string, string>,
): {
  configSpec: Record<string, unknown>;
  receiverSpec: Record<string, unknown>;
  annotations: Record<string, string>;
  secretData: Record<string, string>;
  enabled: boolean;
} {
  const specKey = descriptor.specKey;
  const configSpec: Record<string, unknown> = {};
  const receiverSpec: Record<string, unknown> = {};
  const annotations: Record<string, string> = {};
  const secretData: Record<string, string> = {};
  let enabled = false;

  for (const field of descriptor.fields) {
    if (!fieldVisible(field, values)) continue;
    const value = values[field.key] ?? '';

    if (field.key === 'enabled') {
      enabled = value === 'true';
      continue;
    }
    // Mode selectors are page state: the value is already used as a path segment.
    if (field.kind === 'select' && field.target !== 'annotation') continue;

    if (field.target === 'secret') {
      // A blank password means "keep what is stored": the page cannot read it back.
      if (value === '') continue;
      secretData[resolve(field.path, values).join('.')] = value;
      continue;
    }
    if (field.target === 'annotation') {
      annotations[resolve(field.path, values).join('.')] = value;
      continue;
    }

    let parsed: unknown = value;
    if (field.kind === 'boolean') parsed = value === 'true';
    else if (field.kind === 'list') parsed = value.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
    else if (field.rule === 'port') parsed = Number(value);

    const target = field.target === 'config' ? configSpec : receiverSpec;
    write(target, resolve(field.path, values), parsed);
  }

  // `enabled` lives beside the channel's spec, not inside it.
  write(receiverSpec, [specKey, 'enabled'], enabled);

  if (descriptor.secretRef) {
    write(configSpec, resolve(descriptor.secretRef.path, values), {
      valueFrom: { secretKeyRef: { name: descriptor.secretName, key: descriptor.secretRef.secretKey } },
    });
  }

  for (const ref of descriptor.secretRefs ?? []) {
    // A reference to a mode that is not in use would make the platform require a
    // credential the form cannot fill (Feishu's Config requires appID/appSecret only
    // when the application mode is selected).
    if (ref.visibleWhen && !matches(ref.visibleWhen, values)) continue;
    write(ref.target === 'config' ? configSpec : receiverSpec, resolve(ref.path, values), {
      valueFrom: { secretKeyRef: { name: descriptor.secretName, key: ref.secretKey } },
    });
  }

  return { configSpec, receiverSpec, annotations, secretData, enabled };
}

/**
 * Problems worth stopping the save for, keyed by field.
 *
 * Only visible fields are checked: a chat id does not have to be filled in while the page
 * is showing the chatbot tab, and demanding it would make the other mode unusable.
 */
export function validate(
  descriptor: ChannelDescriptor,
  values: Record<string, string>,
  options: { hasSecret: boolean } = { hasSecret: true },
): Record<string, 'required' | 'email' | 'port' | 'url'> {
  const errors: Record<string, 'required' | 'email' | 'port' | 'url'> = {};
  for (const field of descriptor.fields) {
    if (!fieldVisible(field, values) || field.key === 'enabled' || field.kind === 'boolean') continue;
    if (field.kind === 'select') continue;
    const value = (values[field.key] ?? '').trim();
    // A password left blank is a deliberate "keep the stored one" — but only when there is
    // one to keep.
    if (value === '' && field.kind === 'password' && !options.hasSecret) {
      errors[field.key] = 'required';
      continue;
    }
    if (value === '' && field.kind !== 'password') {
      if (field.required) errors[field.key] = 'required';
      continue;
    }
    if (value === '') continue;
    if (field.rule === 'port' && !(/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535)) {
      errors[field.key] = 'port';
    }
    if (field.rule === 'email') {
      const items = field.kind === 'list' ? value.split(/[,，\s]+/).filter(Boolean) : [value];
      if (items.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) errors[field.key] = 'email';
    }
    if (field.rule === 'url' && !/^https?:\/\/\S+$/.test(value)) errors[field.key] = 'url';
  }
  return errors;
}
