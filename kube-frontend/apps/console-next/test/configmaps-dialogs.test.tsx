import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/i18n';
import { expectedConfirmation, ConfigMapDeleteDialog } from '@/pages/configmaps/ConfigMapDeleteDialog';
import { ConfigMapDataEditor } from '@/pages/configmaps/ConfigMapDataEditor';
import { ConfigMapCreateDialog } from '@/pages/configmaps/ConfigMapCreateDialog';

/**
 * Dialog behaviour.
 *
 * The rules under test are the ones the old console got wrong: batch deletion
 * accepting a substring, data keys being unchecked, and a create form letting an
 * invalid DNS name through to the API.
 */

function renderZh(ui: React.ReactElement) {
  return render(<I18nProvider locale="zh">{ui}</I18nProvider>);
}

describe('ConfigMapDeleteDialog', () => {
  it('requires the exact name before enabling delete', async () => {
    renderZh(<ConfigMapDeleteDialog open onOpenChange={() => undefined} names={['app-config']} onConfirm={() => undefined} />);

    const confirm = screen.getByRole('button', { name: '删除' });
    expect(confirm.hasAttribute('disabled')).toBe(true);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'app-conf');
    expect(confirm.hasAttribute('disabled')).toBe(true);

    await userEvent.type(input, 'ig');
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false));
  });

  it('asks for every name joined by comma and space when deleting several', () => {
    expect(expectedConfirmation(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('rejects a bulk confirmation that only lists one name', async () => {
    renderZh(
      <ConfigMapDeleteDialog open onOpenChange={() => undefined} names={['a', 'b']} onConfirm={() => undefined} />,
    );

    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(screen.getByRole('button', { name: '删除' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('ConfigMapDataEditor', () => {
  it('refuses an empty key and a duplicate key', async () => {
    const onChange = vi.fn();
    renderZh(<ConfigMapDataEditor value={{ existing: '1' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请设置键名。')).toBeTruthy();

    const keyInput = screen.getByRole('textbox', { name: '键' });
    await userEvent.type(keyInput, 'existing');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText(/重复/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds a pair once the key is valid', async () => {
    const onChange = vi.fn();
    renderZh(<ConfigMapDataEditor value={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.type(screen.getByRole('textbox', { name: '键' }), 'app-config');
    await userEvent.type(screen.getByRole('textbox', { name: '值' }), 'a: 1');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(onChange).toHaveBeenCalledWith({ 'app-config': 'a: 1' });
  });

  it('rejects a key containing a slash but accepts a filename-style key', async () => {
    const onChange = vi.fn();
    renderZh(<ConfigMapDataEditor value={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.type(screen.getByRole('textbox', { name: '键' }), 'a/b');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText(/不能包含斜杠/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts a key that looks like a filename', async () => {
    const onChange = vi.fn();
    renderZh(<ConfigMapDataEditor value={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.type(screen.getByRole('textbox', { name: '键' }), 'app.yaml');
    await userEvent.type(screen.getByRole('textbox', { name: '值' }), 'k: v');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(onChange).toHaveBeenCalledWith({ 'app.yaml': 'k: v' });
  });
});

describe('ConfigMapCreateDialog', () => {
  it('blocks the next step on an invalid name', async () => {
    renderZh(
      <ConfigMapCreateDialog open onOpenChange={() => undefined} namespace="default" onSubmit={() => undefined} />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'Bad_Name');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(await screen.findByText(/名称无效/)).toBeTruthy();
  });

  it('reports a name that is already taken', async () => {
    renderZh(
      <ConfigMapCreateDialog
        open
        onOpenChange={() => undefined}
        namespace="default"
        isNameTaken={async () => true}
        onSubmit={() => undefined}
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'app-config');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(await screen.findByText('名称已存在，请输入其他名称。')).toBeTruthy();
  });

  it('advances to the data step and submits the draft', async () => {
    const onSubmit = vi.fn();
    renderZh(<ConfigMapCreateDialog open onOpenChange={() => undefined} namespace="default" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'new-config');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.type(screen.getByRole('textbox', { name: '键' }), 'k');
    await userEvent.type(screen.getByRole('textbox', { name: '值' }), 'v');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await userEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'new-config', namespace: 'default', alias: '', description: '', data: { k: 'v' } });
  });

  it('creates in the project picked in the dialog, not the one it opened with', async () => {
    const onSubmit = vi.fn();
    renderZh(
      <ConfigMapCreateDialog
        open
        onOpenChange={() => undefined}
        namespace="default"
        projects={[
          { value: 'default', label: 'default' },
          { value: 'kube-frontend-demo', label: 'kube-frontend-demo' },
        ]}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'new-config');

    // Open the picker and choose the other project.
    await userEvent.click(screen.getByRole('combobox', { name: '项目' }));
    await userEvent.click(await screen.findByRole('option', { name: 'kube-frontend-demo' }));

    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    await userEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new-config', namespace: 'kube-frontend-demo' }),
    );
  });

  it('checks the taken name against the selected project', async () => {
    const isNameTaken = vi.fn(async () => false);
    renderZh(
      <ConfigMapCreateDialog
        open
        onOpenChange={() => undefined}
        namespace="default"
        projects={[
          { value: 'default', label: 'default' },
          { value: 'other', label: 'other' },
        ]}
        isNameTaken={isNameTaken}
        onSubmit={() => undefined}
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'app-config');
    await userEvent.click(screen.getByRole('combobox', { name: '项目' }));
    await userEvent.click(await screen.findByRole('option', { name: 'other' }));
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    // Names are unique per namespace, so the check must follow the chosen project.
    expect(isNameTaken).toHaveBeenCalledWith('app-config', 'other');
  });

  it('refuses to continue without a project', async () => {
    // "All projects" on the list has no namespace to seed, which is exactly when
    // the reader has to choose one.
    renderZh(<ConfigMapCreateDialog open onOpenChange={() => undefined} namespace="" onSubmit={() => undefined} />);

    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'new-config');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(await screen.findByText('请选择项目')).toBeTruthy();
    // Still on the basic step: the data editor is not rendered.
    expect(screen.queryByRole('button', { name: /添加数据/ })).toBeNull();
  });
});
