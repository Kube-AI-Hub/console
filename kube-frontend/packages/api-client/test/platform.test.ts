import { ApiError } from '../src/errors';
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CHANNELS, configScalar, toNotificationChannels, toPlatformInfo } from '../src/access';

/**
 * Platform configuration parsing.
 *
 * The console reads three scalars out of a section of a YAML document with an
 * indentation walk, so the section boundary is the whole risk: a value from a
 * neighbouring section leaking through would show the wrong platform name.
 */

const YAML = `gateway:
  title: 'not the console'
  desc: 'also not'
console:
  title: 'KubeSphere'
  desc: 'AI platform console'
  url: 'https://console.example.com'
  port: 30880
monitoring:
  title: 'completely different'
`;

describe('configScalar', () => {
  it('reads a scalar from the named section', () => {
    expect(configScalar(YAML, 'console', 'title')).toBe('KubeSphere');
    expect(configScalar(YAML, 'console', 'url')).toBe('https://console.example.com');
  });

  it('strips wrapping quotes', () => {
    expect(configScalar(YAML, 'console', 'desc')).toBe('AI platform console');
  });

  it('does not leak values from another section that has the same key', () => {
    // `gateway.title` and `monitoring.title` both exist; neither may satisfy a
    // `console.title` lookup.
    expect(configScalar(YAML, 'console', 'title')).not.toBe('not the console');
    expect(configScalar(YAML, 'console', 'title')).not.toBe('completely different');
  });

  it('stops at the end of the section', () => {
    expect(configScalar(YAML, 'console', 'title')).toBe('KubeSphere');
    // `port` is not in the section list; looking for a key that only exists in
    // `monitoring` after the section ends must come back empty.
    expect(configScalar(YAML, 'console', 'missing')).toBe('');
  });

  it('returns empty for an absent section', () => {
    // The live cluster's config has no `console` section at all; the page shows "-"
    // rather than failing, so this must be a clean empty string.
    expect(configScalar('alerting:\n  enabled: true\n', 'console', 'title')).toBe('');
  });

  it('ignores blank lines and comments inside a section', () => {
    const withComments = `console:\n  # a comment\n\n  title: 'X'\n`;
    expect(configScalar(withComments, 'console', 'title')).toBe('X');
  });
});

describe('toPlatformInfo', () => {
  it('reads all three values from kubesphere.yaml', () => {
    expect(toPlatformInfo({ metadata: { name: 'cfg' }, data: { 'kubesphere.yaml': YAML } })).toEqual({
      title: 'KubeSphere',
      description: 'AI platform console',
      consoleUrl: 'https://console.example.com',
    });
  });

  it('returns empty strings when the document is missing', () => {
    expect(toPlatformInfo({ metadata: { name: 'cfg' } })).toEqual({ title: '', description: '', consoleUrl: '' });
  });
});

describe('notification channels', () => {
  it('reports a channel as configured only when its Secret exists', () => {
    const channels = toNotificationChannels(['mails', 'slacks']);
    const configured = channels.filter((channel) => channel.configured).map((channel) => channel.key);
    expect(configured).toEqual(['mail', 'slack']);
  });

  it('keeps the five channels in a fixed order', () => {
    expect(toNotificationChannels([]).map((channel) => channel.key)).toEqual([...NOTIFICATION_CHANNELS]);
    expect(NOTIFICATION_CHANNELS).toEqual(['mail', 'dingtalk', 'wecom', 'slack', 'webhook']);
  });
});

describe('ApiError.isNotFound', () => {
  it('treats a 404 as not found', () => {
    expect(new ApiError({ code: 'not_found', message: 'nope' }, 404).isNotFound).toBe(true);
  });

  it('treats a 5xx whose message says "not found" as not found', () => {
    // IAM answers 500 for a missing user; without this the page offers "retry" for an
    // object that is already gone.
    const error = new ApiError({ code: 'unknown', message: 'user.iam.kubesphere.io "x" not found' }, 500);
    expect(error.isNotFound).toBe(true);
  });

  it('does not treat a genuine 5xx as not found', () => {
    const error = new ApiError({ code: 'internal', message: 'the server could not find the requested resource' }, 500);
    expect(error.isNotFound).toBe(false);
  });
});
