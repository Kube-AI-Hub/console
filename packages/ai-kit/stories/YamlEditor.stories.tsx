import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { YamlEditor } from '../src/editor/YamlEditor';
import { Button } from '../src/primitives/Button';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof YamlEditor> = {
  title: 'Components/YamlEditor',
  component: YamlEditor,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="YamlEditor"
          summary="YAML 编辑与查看。带语法高亮、解析校验和 Kubernetes 字段补全。"
          description={
            <>
              资源页的 YAML 入口共用这一个组件：查看详情、创建时切到 YAML、以及「编辑 YAML」弹窗。
              高亮与选区颜色取自 ai-kit 的 token，因此跟随深浅色切换，不会在深色页面上出现浅色选区。
              <br />
              解析失败时不阻塞输入：错误通过 <code>onValidityChange</code> 上报，
              由宿主决定是禁用提交还是只标红，编辑到一半的文档因此不会被弹窗挡回去。
              <br />
              补全会读取文档里的 <code>kind</code>，只提示这一类资源用得到的字段；
              <code>kind</code> 还没写时提示公共字段。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof YamlEditor>;

const CONFIG_MAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
  labels:
    app: demo
data:
  app.yaml: |
    server:
      port: 8080
  log.yaml: |
    level: info
`;

const BROKEN = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.yaml: |
    server:
      port: 8080
   bad-indent: here
`;

/**
 * Editable, the way the create and edit dialogs use it.
 *
 * `onValidityChange` is wired to a status line so the contract is visible: the
 * component never blocks typing, it only reports. A dialog decides whether a
 * parse error disables its submit button.
 */
export const Basic: Story = {
  name: 'basic',
  render: () => {
    const [value, setValue] = React.useState(CONFIG_MAP);
    const [error, setError] = React.useState<string | null>(null);
    return (
      <div className="flex max-w-2xl flex-col gap-2">
        <YamlEditor value={value} onChange={setValue} onValidityChange={setError} height="380px" />
        <p className="text-xs text-ai-fg-muted">
          {error ? <span className="text-ai-danger">解析失败：{error}</span> : '文档有效'}
        </p>
      </div>
    );
  },
};

/** Read-only, as the detail page shows an object. */
export const ReadOnly: Story = {
  name: 'read only',
  render: () => (
    <div className="max-w-2xl">
      <YamlEditor value={CONFIG_MAP} readOnly height="320px" ariaLabel="app-config YAML" />
    </div>
  ),
};

/**
 * A document that does not parse.
 *
 * The error is reported immediately; the editor stays editable so the reader can
 * fix the indentation rather than starting over.
 */
export const Invalid: Story = {
  name: 'invalid document',
  render: () => {
    const [value, setValue] = React.useState(BROKEN);
    const [error, setError] = React.useState<string | null>(null);
    return (
      <div className="flex max-w-2xl flex-col gap-2">
        <YamlEditor value={value} onChange={setValue} onValidityChange={setError} height="320px" />
        <p className="text-xs text-ai-danger">{error ?? '文档有效'}</p>
      </div>
    );
  },
};

/**
 * With host actions in the corner.
 *
 * The toolbar is a slot rather than a set of props: upload, download and format
 * differ per host, and a prop per action would grow the component's API without
 * making any of them more honest.
 */
export const WithToolbar: Story = {
  name: 'with toolbar',
  render: () => {
    const [value, setValue] = React.useState(CONFIG_MAP);
    return (
      <div className="max-w-2xl">
        <YamlEditor
          value={value}
          onChange={setValue}
          height="320px"
          toolbar={
            <>
              <Button variant="ghost" size="sm" onClick={() => setValue(CONFIG_MAP)}>
                重置
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(value);
                }}
              >
                复制
              </Button>
            </>
          }
        />
      </div>
    );
  },
};

/**
 * Field completion.
 *
 * Focus the body and type a new line, then `Ctrl`/`Cmd`+`Space` (or start typing a
 * field name) to see the suggestions for the document's `kind`.
 */
export const Completion: Story = {
  name: 'field completion',
  render: () => {
    const [value, setValue] = React.useState('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: demo\n');
    return (
      <div className="flex max-w-2xl flex-col gap-2">
        <YamlEditor value={value} onChange={setValue} height="300px" />
        <p className="text-xs text-ai-fg-muted">
          在空行上输入 <code>met</code> 或按 Ctrl+Space，可看到 <code>metadata</code> 等字段建议。
          把 <code>kind</code> 改成 <code>Secret</code>，建议会换成该类资源自己的字段。
        </p>
      </div>
    );
  },
};

/** Narrow layout: the editor fills the container and scrolls internally. */
export const Narrow: Story = {
  name: 'narrow container',
  render: () => (
    <div className="w-full max-w-sm">
      <YamlEditor value={CONFIG_MAP} readOnly height="260px" />
    </div>
  ),
};
