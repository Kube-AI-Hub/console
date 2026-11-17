import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { StorageClassCreateDialog } from '@/pages/cluster/StorageClassCreateDialog';
import { isDeleteBlocked } from '@/pages/cluster/StorageClassesPage';

/**
 * Storage-class write guards.
 *
 * The delete guard has two independent refusals; the second (failed claim read) is the one
 * pages forget. The create dialog is validated here rather than only through an E2E because
 * its two failure paths (bad name / missing provisioner) are pure UI.
 */
describe('isDeleteBlocked', () => {
  it('blocks a class used by a claim', () => {
    expect(isDeleteBlocked(2, false)).toBe(true);
  });

  it('blocks when the claim read failed, even for a zero count', () => {
    expect(isDeleteBlocked(undefined, true)).toBe(true);
    expect(isDeleteBlocked(0, true)).toBe(true);
  });

  it('allows an unused class with a successful read', () => {
    expect(isDeleteBlocked(0, false)).toBe(false);
    expect(isDeleteBlocked(undefined, false)).toBe(false);
  });
});

function renderCreate(onSubmit = vi.fn()) {
  render(
    <I18nProvider locale="zh">
      <StorageClassCreateDialog
        open
        onOpenChange={() => undefined}
        cluster="host"
        isNameTaken={() => false}
        onSubmit={onSubmit}
      />
    </I18nProvider>,
  );
  return onSubmit;
}

describe('StorageClassCreateDialog', () => {
  it('rejects a missing name before writing anything', () => {
    const onSubmit = renderCreate();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(screen.getByText('请填写合法名称（小写字母、数字、连字符）。')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a missing provisioner', () => {
    const onSubmit = renderCreate();
    fireEvent.change(screen.getByPlaceholderText('fast-ssd'), { target: { value: 'fast-ssd' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(screen.getByText('请填写供应者。')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the draft with the enabled capabilities only', () => {
    const onSubmit = renderCreate();
    fireEvent.change(screen.getByPlaceholderText('fast-ssd'), { target: { value: 'fast-ssd' } });
    fireEvent.change(screen.getByPlaceholderText('csi.example.com'), { target: { value: 'csi.example.com' } });
    fireEvent.click(screen.getByLabelText('扩容'));
    fireEvent.click(screen.getByLabelText('快照'));
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onSubmit).toHaveBeenCalledWith({
      cluster: 'host',
      name: 'fast-ssd',
      provisioner: 'csi.example.com',
      reclaimPolicy: 'Delete',
      volumeBindingMode: 'Immediate',
      allowVolumeExpansion: true,
      allowCloning: false,
      allowSnapshot: true,
    });
  });
});
