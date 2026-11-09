import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Icon, ICON_NAMES } from '../src/primitives/Icon';
import { Input } from '../src/primitives/Input';
import { Text } from '../src/primitives/Display';

const meta: Meta = {
  title: 'Foundation/Icons',
  parameters: { layout: 'padded' },
};
export default meta;

/**
 * Icon catalogue.
 *
 * The sprite is inherited from kube-design (370 symbols), so this page doubles
 * as a migration checklist: anything the old product used is still addressable
 * by the same name.
 */
export const Gallery: StoryObj = {
  render: () => {
    const [query, setQuery] = React.useState('');
    const filtered = React.useMemo(() => {
      const keyword = query.trim().toLowerCase();
      return keyword ? ICON_NAMES.filter((name) => name.includes(keyword)) : ICON_NAMES;
    }, [query]);

    const copy = async (name: string) => {
      try {
        await navigator.clipboard.writeText(`<Icon name="${name}" />`);
      } catch {
        // Clipboard access can be denied; the name is still visible on screen.
      }
    };

    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            className="w-64"
            placeholder="按名称筛选图标"
            aria-label="按名称筛选图标"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Text size="sm" tone="muted">
            共 {ICON_NAMES.length} 个，当前显示 {filtered.length} 个
          </Text>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => copy(name)}
              title={`点击复制：<Icon name="${name}" />`}
              className="ai-lift flex flex-col items-center gap-1.5 rounded-ai-md border border-ai-line bg-ai-surface-1 p-3 text-ai-fg"
            >
              <Icon name={name} size={20} />
              <span className="w-full truncate text-center font-ai-mono text-[9px] text-ai-fg-muted">{name}</span>
            </button>
          ))}
        </div>
        {!filtered.length ? (
          <p className="py-12 text-center text-xs text-ai-fg-muted">没有匹配的图标</p>
        ) : null}
      </div>
    );
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-end gap-6">
      {[12, 16, 20, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon name="kubernetes" size={size} />
          <span className="font-ai-mono text-[10px] text-ai-fg-muted">{size}px</span>
        </div>
      ))}
    </div>
  ),
};

export const ColoredAndRotated: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <Icon name="check" size={20} className="text-ai-success" label="成功" />
      <Icon name="exclamation" size={20} className="text-ai-warning" label="警告" />
      <Icon name="close" size={20} className="text-ai-danger" label="失败" />
      <Icon name="information" size={20} className="text-ai-info" label="信息" />
      <Icon name="chevron-down" size={20} rotate={180} label="收起" />
    </div>
  ),
};
