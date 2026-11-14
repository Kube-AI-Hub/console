import { describe, expect, it } from 'vitest';
import { CHANNELS, toBodies, toFormValues, validate } from '../src/pages/platform/channelDescriptors';

/**
 * The channel table is the whole contract between the page and the platform: a wrong path
 * here is a request the platform rejects, and the page cannot tell from the outside.
 *
 * These tests pin the actual object shapes the platform expects (read off the old console's
 * per-channel forms), so a typo in a path fails here instead of in a browser.
 */

const MAIL = {
  host: 'smtp.example.com',
  port: '465',
  requireTLS: 'true',
  username: 'ops@example.com',
  password: 'p@ss',
  from: 'ops@example.com',
  recipients: 'a@example.com, b@example.com',
  enabled: 'true',
};

describe('mail', () => {
  it('maps the form onto the three objects without duplicating the spec key', () => {
    // Paths are absolute inside `spec`; prefixing them again produced
    // `spec.email.email.to`, which the platform rejects as "to: Required value".
    const bodies = toBodies(CHANNELS.mail, MAIL);
    expect(bodies.configSpec).toEqual({
      email: {
        smartHost: { host: 'smtp.example.com', port: 465 },
        requireTLS: true,
        authUsername: 'ops@example.com',
        from: 'ops@example.com',
        authPassword: {
          valueFrom: { secretKeyRef: { name: 'global-email-config-secret', key: 'authPassword' } },
        },
      },
    });
    expect(bodies.receiverSpec).toEqual({ email: { to: ['a@example.com', 'b@example.com'], enabled: true } });
    expect(bodies.secretData).toEqual({ authPassword: 'p@ss' });
  });

  it('keeps the stored password when the field is blank', () => {
    const bodies = toBodies(CHANNELS.mail, { ...MAIL, password: '' });
    expect(bodies.secretData).toEqual({});
    // The config still references the secret: clearing the reference would break delivery.
    expect(
      (bodies.configSpec.email as { authPassword: { valueFrom: { secretKeyRef: { name: string } } } }).authPassword
        .valueFrom.secretKeyRef.name,
    ).toBe('global-email-config-secret');
  });

  it('round-trips what it saved', () => {
    const values = toFormValues(CHANNELS.mail, {
      config: { spec: toBodies(CHANNELS.mail, MAIL).configSpec },
      receiver: { spec: toBodies(CHANNELS.mail, MAIL).receiverSpec },
    });
    expect(values.host).toBe('smtp.example.com');
    expect(values.port).toBe('465');
    expect(values.requireTLS).toBe('true');
    expect(values.recipients).toBe('a@example.com, b@example.com');
    // The password is not readable: the page never shows one back.
    expect(values.password).toBe('');
  });

  it('rejects a bad port, a bad address and a missing recipient', () => {
    expect(validate(CHANNELS.mail, { ...MAIL, port: 'abc' })).toMatchObject({ port: 'port' });
    expect(validate(CHANNELS.mail, { ...MAIL, from: 'nope' })).toMatchObject({ from: 'email' });
    expect(validate(CHANNELS.mail, { ...MAIL, recipients: '' })).toMatchObject({ recipients: 'required' });
  });

  it('demands a credential only when none is stored', () => {
    expect(validate(CHANNELS.mail, { ...MAIL, password: '' }, { hasSecret: false })).toMatchObject({
      password: 'required',
    });
    expect(validate(CHANNELS.mail, { ...MAIL, password: '' }, { hasSecret: true })).toEqual({});
  });
});

describe('wecom', () => {
  it('writes the recipient list under the selected type', () => {
    // The receiver key *is* the recipient type: spec.wechat.toUser, .toParty, .toTag.
    const bodies = toBodies(CHANNELS.wecom, {
      corpId: 'corp',
      agentId: '1000002',
      appsecret: 's3cret',
      mode: 'toParty',
      recipients: '1, 2',
      enabled: 'false',
    });
    expect(bodies.configSpec).toEqual({
      wechat: {
        wechatApiCorpId: 'corp',
        wechatApiAgentId: '1000002',
        // The platform rejects the Config unless the API secret is referenced:
        // "spec.wechat.wechatApiSecret: Required value".
        wechatApiSecret: {
          valueFrom: { secretKeyRef: { name: 'global-wechat-config-secret', key: 'appsecret' } },
        },
      },
    });
    expect(bodies.receiverSpec).toEqual({ wechat: { toParty: ['1', '2'], enabled: false } });
    expect(bodies.secretData).toEqual({ appsecret: 's3cret' });
  });

  it('infers the saved recipient type from the receiver', () => {
    const values = toFormValues(CHANNELS.wecom, {
      config: null,
      receiver: { spec: { wechat: { toTag: ['7'] } } },
    });
    expect(values.mode).toBe('toTag');
  });
});

describe('dingtalk', () => {
  it('writes only the visible mode', () => {
    const bodies = toBodies(CHANNELS.dingtalk, {
      mode: 'chatbot',
      webhook: 'https://oapi.dingtalk.com/robot/send?access_token=x',
      chatbotsecret: 'SEC',
      keywords: 'alert, deploy',
      appkey: 'stale-key',
      appsecret: 'stale-secret',
      chatids: 'stale-chat',
      enabled: 'true',
    });
    expect(bodies.receiverSpec).toEqual({
      dingtalk: { chatbot: { keywords: ['alert', 'deploy'] }, enabled: true },
    });
    // The conversation credentials belong to the mode that is not in use; sending them
    // would leave a second, half-configured transport behind.
    expect(bodies.secretData).toEqual({ webhook: 'https://oapi.dingtalk.com/robot/send?access_token=x', chatbotsecret: 'SEC' });
  });

  it('infers the conversation mode when only chat ids are stored', () => {
    const values = toFormValues(CHANNELS.dingtalk, {
      config: null,
      receiver: { spec: { dingtalk: { conversation: { chatids: ['cid'] } } } },
    });
    expect(values.mode).toBe('conversation');
  });
});

describe('webhook', () => {
  it('has no Config and keeps the auth type in an annotation', () => {
    const bodies = toBodies(CHANNELS.webhook, {
      url: 'https://example.com/hook',
      auth: 'token',
      token: 'abc',
      skipVerify: 'true',
      enabled: 'false',
    });
    expect(CHANNELS.webhook.configName).toBeNull();
    expect(bodies.receiverSpec).toEqual({
      webhook: {
        url: 'https://example.com/hook',
        httpConfig: { tlsConfig: { insecureSkipVerify: true } },
        enabled: false,
      },
    });
    expect(bodies.annotations).toEqual({ 'kubesphere.io/verify-type': 'token' });
    expect(bodies.secretData).toEqual({ token: 'abc' });
  });

  it('requires the URL', () => {
    expect(validate(CHANNELS.webhook, { url: '', auth: 'no', skipVerify: 'false', enabled: 'false' })).toMatchObject({
      url: 'required',
    });
    expect(
      validate(CHANNELS.webhook, { url: 'not-a-url', auth: 'no', skipVerify: 'false', enabled: 'false' }),
    ).toMatchObject({ url: 'url' });
  });
});

describe('slack', () => {
  it('uses the token-shaped secret name and a channel list', () => {
    const bodies = toBodies(CHANNELS.slack, { token: 'xoxb-1', channels: '#ops, #dev', enabled: 'true' });
    expect(CHANNELS.slack.secretName).toBe('global-slack-config-token');
    expect(bodies.receiverSpec).toEqual({ slack: { channels: ['#ops', '#dev'], enabled: true } });
    expect(bodies.secretData).toEqual({ token: 'xoxb-1' });
  });
});

describe('feishu', () => {
  it('names the objects the platform uses for this channel', () => {
    expect(CHANNELS.feishu.configName).toBe('default-feishu-config');
    expect(CHANNELS.feishu.receiverName).toBe('global-feishu-receiver');
    expect(CHANNELS.feishu.secretName).toBe('global-feishu-config-secret');
    expect(CHANNELS.feishu.specKey).toBe('feishu');
  });

  it('writes application mode: both credential references on the Config, users on the Receiver', () => {
    const bodies = toBodies(CHANNELS.feishu, {
      mode: 'user',
      appkey: 'cli_xxx',
      appsecret: 'app-secret',
      users: 'ou_a, ou_b',
      enabled: 'true',
    });
    expect(bodies.configSpec).toEqual({
      feishu: {
        // The Config CRD requires both refs whenever spec.feishu is present.
        appID: { valueFrom: { secretKeyRef: { name: 'global-feishu-config-secret', key: 'appkey' } } },
        appSecret: { valueFrom: { secretKeyRef: { name: 'global-feishu-config-secret', key: 'appsecret' } } },
      },
    });
    expect(bodies.receiverSpec).toEqual({ feishu: { user: ['ou_a', 'ou_b'], enabled: true } });
    expect(bodies.secretData).toEqual({ appkey: 'cli_xxx', appsecret: 'app-secret' });
  });

  it('writes department mode under spec.feishu.department, keeping the app credentials', () => {
    const bodies = toBodies(CHANNELS.feishu, {
      mode: 'department',
      appkey: 'cli_xxx',
      appsecret: 'app-secret',
      departments: 'od-1, od-2',
      enabled: 'false',
    });
    expect(bodies.receiverSpec).toEqual({ feishu: { department: ['od-1', 'od-2'], enabled: false } });
    expect(bodies.configSpec).toHaveProperty('feishu.appID');
    // The user list of the previous mode is not part of this request.
    expect(bodies.receiverSpec).not.toHaveProperty('feishu.user');
  });

  it('writes bot mode with references on the Receiver and no Config spec', () => {
    const bodies = toBodies(CHANNELS.feishu, {
      mode: 'chatbot',
      webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/x',
      chatbotsecret: 'signing-secret',
      keywords: 'alert, deploy',
      enabled: 'true',
    });
    // Bot mode needs no transport Config; the page deletes an empty one instead of
    // writing a Config the platform cannot use.
    expect(bodies.configSpec).toEqual({});
    expect(bodies.receiverSpec).toEqual({
      feishu: {
        chatbot: {
          webhook: {
            valueFrom: { secretKeyRef: { name: 'global-feishu-config-secret', key: 'webhook' } },
          },
          secret: {
            valueFrom: { secretKeyRef: { name: 'global-feishu-config-secret', key: 'chatbotsecret' } },
          },
          keywords: ['alert', 'deploy'],
        },
        enabled: true,
      },
    });
    expect(bodies.secretData).toEqual({
      webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/x',
      chatbotsecret: 'signing-secret',
    });
  });

  it('infers the saved mode from which receiver key exists', () => {
    const infer = (spec: Record<string, unknown>): string =>
      toFormValues(CHANNELS.feishu, { config: null, receiver: { spec: { feishu: spec } } }).mode ?? '';
    expect(infer({ user: ['ou_1'] })).toBe('user');
    expect(infer({ department: ['od-1'] })).toBe('department');
    expect(infer({ chatbot: { keywords: ['x'] } })).toBe('chatbot');
  });

  it('validates only the fields of the selected mode', () => {
    // User mode: the app credentials and the user list are required; the bot fields are
    // not rendered, so they cannot block the save.
    expect(
      validate(CHANNELS.feishu, {
        mode: 'user',
        appkey: '',
        appsecret: '',
        users: '',
        webhook: '',
        chatbotsecret: '',
        keywords: '',
        enabled: 'false',
      }),
    ).toMatchObject({ appkey: 'required', users: 'required' });

    // Bot mode: the webhook must look like a URL; the application fields are not checked.
    expect(
      validate(CHANNELS.feishu, {
        mode: 'chatbot',
        appkey: '',
        appsecret: '',
        users: '',
        webhook: 'not-a-url',
        chatbotsecret: '',
        keywords: '',
        enabled: 'false',
      }),
    ).toMatchObject({ webhook: 'url' });
  });
});

