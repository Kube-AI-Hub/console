import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Icon, ICON_NAMES, ICON_NAME_SET } from '../src/primitives/Icon';
import { Form, FormItem, FormGroup, runRules } from '../src/primitives/Form';
import { Notify } from '../src/primitives/Notify';
import { AutoComplete } from '../src/primitives/AutoComplete';
import { Columns, Column, Level, LevelItem } from '../src/primitives/Layout';
import { Input } from '../src/primitives/Input';
import { Button } from '../src/primitives/Button';

describe('Icon', () => {
  it('exposes a non-empty, deduplicated name list', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(300);
    expect(ICON_NAME_SET.size).toBe(ICON_NAMES.length);
  });

  it('renders a use reference to the requested symbol', () => {
    const { container } = render(<Icon name="kubernetes" />);
    const use = container.querySelector('use');
    expect(use?.getAttribute('href')).toBe('#icon-kubernetes');
  });

  it('injects the sprite once and reuses it', async () => {
    render(<Icon name="check" />);
    render(<Icon name="close" />);
    // The sprite loads lazily so the main bundle stays small; wait for the
    // chunk before asserting.
    await waitFor(() => {
      expect(document.querySelectorAll('#__ai-kit-svg-sprite__')).toHaveLength(1);
    });
  });

  it('is hidden from assistive tech unless labelled', () => {
    const { container: plain } = render(<Icon name="check" />);
    expect(plain.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    const { container: labelled } = render(<Icon name="check" label="成功" />);
    expect(labelled.querySelector('svg')).toHaveAttribute('aria-label', '成功');
    expect(labelled.querySelector('svg')).toHaveAttribute('role', 'img');
  });
});

describe('Form', () => {
  it('blocks submit and reports the first failing rule', async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();
    render(
      <Form defaultData={{ name: '' }} onSubmit={onSubmit} onError={onError}>
        <FormItem name="name" label="名称" rules={[{ required: true, message: '名称不能为空' }]}>
          <Input />
        </FormItem>
        <Button type="submit">提交</Button>
      </Form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ name: '名称不能为空' });
    expect(screen.getByRole('alert')).toHaveTextContent('名称不能为空');
  });

  it('submits once the value satisfies every rule', async () => {
    const onSubmit = vi.fn();
    render(
      <Form defaultData={{ name: 'ok-name' }} onSubmit={onSubmit}>
        <FormItem
          name="name"
          label="名称"
          rules={[
            { required: true },
            { pattern: /^[a-z-]+$/, message: '只允许小写字母与连字符' },
          ]}
        >
          <Input />
        </FormItem>
        <Button type="submit">提交</Button>
      </Form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ok-name' });
  });

  it('clears the error as soon as the user edits', async () => {
    render(
      <Form defaultData={{ name: '' }} onSubmit={() => undefined}>
        <FormItem name="name" label="名称" rules={[{ required: true, message: '不能为空' }]}>
          <Input aria-label="名称" />
        </FormItem>
        <Button type="submit">提交</Button>
      </Form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('名称'), 'a');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('supports a custom validator and keeps field wiring intact', async () => {
    const onSubmit = vi.fn();
    render(
      <Form defaultData={{ port: '99999' }} onSubmit={onSubmit}>
        <FormItem
          name="port"
          label="端口"
          rules={[{ validator: (value) => (Number(value) > 65535 ? '端口超范围' : null) }]}
        >
          <Input aria-label="端口" />
        </FormItem>
        <Button type="submit">提交</Button>
      </Form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(screen.getByRole('alert')).toHaveTextContent('端口超范围');
  });

  it('groups render as a fieldset', () => {
    render(
      <Form>
        <FormGroup title="基本信息">
          <span>字段</span>
        </FormGroup>
      </Form>,
    );
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByText('基本信息')).toBeInTheDocument();
  });

  it('runRules treats an empty optional field as valid', () => {
    expect(runRules([{ pattern: /^x$/ }], '', {})).toBeUndefined();
    expect(runRules([{ required: true }], '', {})).toBe('此项为必填');
  });
});

describe('Notify', () => {
  beforeEach(() => {
    Notify.clear();
  });

  it('mounts its own host and shows a message', async () => {
    act(() => {
      Notify.success('保存成功', '配置已更新');
    });
    expect(await screen.findByText('保存成功')).toBeInTheDocument();
  });

  it('updates in place when the same key is reused', async () => {
    act(() => {
      Notify.error({ key: 'fixed', title: '第一次' });
      Notify.error({ key: 'fixed', title: '第二次' });
    });
    expect(screen.queryByText('第一次')).not.toBeInTheDocument();
    expect(screen.getByText('第二次')).toBeInTheDocument();
  });

  it('clear removes every notice', async () => {
    act(() => {
      Notify.info('a');
      Notify.info('b');
    });
    expect(screen.getByText('a')).toBeInTheDocument();
    act(() => {
      Notify.clear();
    });
    await waitFor(() => expect(screen.queryByText('a')).not.toBeInTheDocument());
  });
});

describe('AutoComplete', () => {
  const options = ['default', 'kube-system', 'monitoring'].map((value) => ({ value }));

  it('filters suggestions by the typed value', async () => {
    render(<AutoComplete options={options} placeholder="命名空间" aria-label="命名空间" />);
    await userEvent.type(screen.getByLabelText('命名空间'), 'kube');
    expect(await screen.findByRole('option', { name: 'kube-system' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'monitoring' })).not.toBeInTheDocument();
  });

  it('selects an option on click and reports it', async () => {
    const onSelect = vi.fn();
    render(<AutoComplete options={options} onSelect={onSelect} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');
    await userEvent.type(input, 'mon');
    const option = await screen.findByRole('option', { name: 'monitoring' });
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith('monitoring');
  });

  it('shows the empty text when nothing matches', async () => {
    render(<AutoComplete options={options} placeholder="命名空间" aria-label="命名空间" />);
    await userEvent.type(screen.getByLabelText('命名空间'), 'zzz');
    expect(await screen.findByText('无匹配项')).toBeInTheDocument();
  });
});

describe('Layout', () => {
  it('renders columns and level items', () => {
    render(
      <Columns>
        <Column size={6}>左</Column>
        <Column size={6}>右</Column>
      </Columns>,
    );
    expect(screen.getByText('左')).toBeInTheDocument();
    expect(screen.getByText('右')).toBeInTheDocument();
  });

  it('renders a level heading as a heading element', () => {
    render(
      <Level>
        <LevelItem heading>节点列表</LevelItem>
      </Level>,
    );
    expect(screen.getByRole('heading', { name: '节点列表' })).toBeInTheDocument();
  });
});
