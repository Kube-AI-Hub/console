import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Text } from '../src/primitives/Display';

const meta: Meta = {
  title: 'Foundation/Colors',
  parameters: { layout: 'padded' },
};
export default meta;

/**
 * Token reference.
 *
 * Renders the semantic layer rather than the raw ramps, because that is what
 * components are allowed to use. Switching accent or mode here shows the same
 * swatch resolving to a different colour, which is the whole point of the
 * two-layer token design.
 */

const SEMANTIC_GROUPS: Array<{ title: string; tokens: Array<{ token: string; note: string }> }> = [
  {
    title: '背景与表面',
    tokens: [
      { token: '--ai-bg', note: '页面底色' },
      { token: '--ai-bg-elevated', note: '浮起层（卡片、弹窗）' },
      { token: '--ai-bg-overlay', note: '覆盖层（下拉、菜单）' },
      { token: '--ai-bg-deep', note: '更深的底（表头）' },
      { token: '--ai-surface-1', note: '一级表面' },
      { token: '--ai-surface-2', note: '二级表面 / hover' },
      { token: '--ai-surface-3', note: '三级表面' },
    ],
  },
  {
    title: '文字',
    tokens: [
      { token: '--ai-fg', note: '主文字' },
      { token: '--ai-fg-secondary', note: '次要文字' },
      { token: '--ai-fg-muted', note: '辅助文字' },
      { token: '--ai-fg-faint', note: '占位 / 禁用' },
    ],
  },
  {
    title: '边框',
    tokens: [
      { token: '--ai-line', note: '常规边框' },
      { token: '--ai-line-strong', note: '强调边框' },
    ],
  },
  {
    title: '语义色',
    tokens: [
      { token: '--ai-accent', note: '主色' },
      { token: '--ai-accent-hover', note: '主色 hover' },
      { token: '--ai-accent-fg', note: '主色上的文字' },
      { token: '--ai-accent-soft', note: '主色柔和态' },
      { token: '--ai-info', note: '信息' },
      { token: '--ai-success', note: '成功' },
      { token: '--ai-warning', note: '警告' },
      { token: '--ai-danger', note: '危险' },
      { token: '--ai-ring', note: '焦点环' },
    ],
  },
];

function Swatch({ token, note }: { token: string; note: string }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = React.useState('');

  // Read the computed value instead of printing the token name: a reader needs
  // to see what the token currently resolves to under the active theme.
  React.useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    setResolved(value);
  });

  return (
    <div className="flex items-center gap-3 rounded-ai-md border border-ai-line bg-ai-surface-1 p-2">
      <div
        ref={ref}
        aria-hidden="true"
        className="size-10 shrink-0 rounded-ai-sm border border-ai-line"
        style={{ backgroundColor: `rgb(var(${token}))` }}
      />
      <div className="min-w-0">
        <p className="truncate font-ai-mono text-[11px] text-ai-fg">{token.replace('--ai-', '')}</p>
        <p className="truncate text-[10px] text-ai-fg-muted">{note}</p>
        <p className="truncate font-ai-mono text-[10px] text-ai-fg-faint">{resolved || '—'}</p>
      </div>
    </div>
  );
}

export const SemanticTokens: StoryObj = {
  render: () => (
    <div className="mx-auto max-w-5xl">
      <Text size="sm" tone="muted" className="mb-4">
        组件只允许消费语义层 token。切换右上角的配色与深浅色，观察同一 token 如何解析成不同色值。
      </Text>
      {SEMANTIC_GROUPS.map((group) => (
        <section key={group.title} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold text-ai-fg-muted">{group.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.tokens.map((item) => (
              <Swatch key={item.token} token={item.token} note={item.note} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
