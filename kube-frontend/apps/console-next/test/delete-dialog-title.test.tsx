import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { I18nProvider } from '@/i18n';

/**
 * The confirmation dialog is reused by actions that are not deletions.
 *
 * 停止 / 启动 / 重新部署 / 回滚 all use it for the typed-name friction, and its default
 * title is `删除{noun}` — which rendered as "删除停止" with a confirm button reading
 * "删除". These cases pin the override.
 */
function renderZh(node: React.ReactElement) {
  return render(<I18nProvider locale="zh">{node}</I18nProvider>);
}

describe('DeleteDialog wording', () => {
  it('says 删除 when it really is a deletion', () => {
    renderZh(
      <DeleteDialog open onOpenChange={() => undefined} names={['web-config']} resource="configmaps" noun="配置字典" onConfirm={() => undefined} />,
    );
    expect(screen.getByText('删除配置字典')).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy();
  });

  it('uses the action words when the action is not a deletion', () => {
    renderZh(
      <DeleteDialog
        open
        onOpenChange={() => undefined}
        names={['web']}
        resource="deployments"
        noun="停止"
        title="停止"
        confirmLabel="停止"
        onConfirm={() => undefined}
      />,
    );
    // "删除停止" was the bug: the noun said 停止 while the template still said 删除.
    expect(screen.queryByText('删除停止')).toBeNull();
    // The heading and the confirm button both read 停止; the heading is an h2.
    expect(screen.getByRole('heading', { name: '停止' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止' })).toBeTruthy();
  });
});
