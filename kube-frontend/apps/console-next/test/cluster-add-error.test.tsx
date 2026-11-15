import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@kube-ai-hub/api-client';
import { I18nProvider } from '@/i18n';
import { AddClusterDialog } from '@/pages/cluster/AddClusterDialog';
import { formatClusterImportError } from '@/pages/cluster/clusterImportError';
import { createTranslator } from '@kube-ai-hub/locales';

/**
 * Adding a cluster must show the server's reason.
 *
 * Mapping jwt / clusterRole / empty 5xx is the difference between "网络异常"
 * and an instruction the reader can act on. The dialog test is the UI half of
 * AC-03: a 400 from validation stays on the form.
 */

const t = createTranslator('zh');

const KUBECONFIG = `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://10.0.0.9:6443
  name: member
`;

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <AddClusterDialog open onOpenChange={() => undefined} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('formatClusterImportError', () => {
  it('maps a jwtSecret mismatch instead of calling it a network error', () => {
    const error = new ApiError(
      {
        code: 'http_error',
        message:
          'failed to validate member cluster configuration, err: hostcluster Jwt is not equal to member cluster jwt, please edit the member cluster cluster config',
      },
      400,
    );
    const copy = formatClusterImportError(t, error);
    expect(copy.body).toContain('jwtSecret');
    expect(copy.body).not.toMatch(/网络异常/);
    expect(copy.raw).toMatch(/Jwt is not equal/);
  });

  it('maps a missing clusterRole', () => {
    const error = new ApiError(
      {
        code: 'http_error',
        message: "the clusterRole of the member cluster must be 'host' or 'member'",
      },
      400,
    );
    expect(formatClusterImportError(t, error).body).toContain('clusterRole');
  });

  it('maps an empty 500 to the internal-error sentence, not a network timeout', () => {
    const error = new ApiError({ code: 'upstream_error', message: 'Internal Server Error' }, 500);
    const copy = formatClusterImportError(t, error);
    expect(copy.body).toContain('内部错误');
    expect(copy.body).not.toMatch(/网络异常/);
  });
});

describe('AddClusterDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the dialog open and shows the mapped validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/clusters/validation')) {
          return new Response(
            JSON.stringify({
              kind: 'Status',
              apiVersion: 'v1',
              status: 'Failure',
              message:
                'failed to validate member cluster configuration, err: hostcluster Jwt is not equal to member cluster jwt',
              reason: 'BadRequest',
              code: 400,
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );

    mount();
    const user = userEvent.setup();
    await user.type(document.querySelector('#ai-field-cluster-name') as HTMLInputElement, 'modehub-xc');
    await user.type(document.querySelector('#ai-field-cluster-kubeconfig') as HTMLTextAreaElement, KUBECONFIG);
    await user.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => {
      const banner = document.querySelector('[data-ai-id="clusters:add-error"]');
      expect(banner?.textContent).toMatch(/jwtSecret/);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      vi.mocked(fetch).mock.calls.some((call) => {
        const url = String(call[0]);
        return url.includes('/apis/cluster.kubesphere.io') && !url.includes('/validation');
      }),
    ).toBe(false);
  });
});
