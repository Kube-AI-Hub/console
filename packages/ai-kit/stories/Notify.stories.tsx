import type { Meta, StoryObj } from '@storybook/react';
import { Notify } from '../src/primitives/Notify';
import { Button } from '../src/primitives/Button';
import { ComponentDocsPage } from './_docs-layout';

/**
 * `Notify` is an imperative API object, not a component, so this page has no
 * `component` field and therefore no auto-generated prop table — `Controls`
 * cannot resolve a meta without one. The API is documented inline instead.
 */
const meta: Meta = {
  title: 'Components/Notify',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocsPage
          name="Notify"
          summary="命令式通知：可在任意函数里调用，不需要组件上下文。"
          note={
            <>
              <code>Notify</code> 自己挂载宿主，适合请求拦截器、Promise 回调这类没有组件树的场景。
              组件内部请优先用 <code>Toast</code>（Provider + <code>useToast</code>）。
              相同的 <code>key</code> 会更新同一条通知而不是叠加；最后一条关闭后宿主机自动卸载。
              <br />
              <br />
              方法：<code>info</code> / <code>success</code> / <code>warning</code> / <code>error</code>
              接受 <code>(title, content)</code> 或一个选项对象；<code>open</code> 接受完整选项；
              <code>close(key)</code> 关闭指定通知；<code>clear()</code> 清空全部。
              选项包含 <code>title</code>、<code>content</code>、<code>tone</code>、<code>placement</code>、
              <code>duration</code>、<code>closable</code>、<code>key</code>、<code>actions</code>。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj;

export const BasicNotify: Story = {
  name: 'basic notify',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => Notify.info('同步中', '正在拉取集群资源')}>info</Button>
      <Button variant="secondary" onClick={() => Notify.success('保存成功', '配置已更新')}>success</Button>
      <Button variant="secondary" onClick={() => Notify.warning('磁盘接近上限', '已用 87%')}>warning</Button>
      <Button variant="secondary" onClick={() => Notify.error('请求失败', 'HTTP 502 Bad Gateway')}>error</Button>
      <Button variant="ghost" onClick={() => Notify.clear()}>清空</Button>
    </div>
  ),
};

/** 不同位置、常驻通知与去重 key。 */
export const PlacementsAndOptions: Story = {
  name: 'placements and options',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => Notify.open({ title: '左下角', content: '不同 placement', placement: 'bottomLeft' })}
      >
        bottomLeft
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => Notify.open({ title: '常驻通知', content: '不会自动关闭', duration: 0 })}
      >
        duration=0
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          Notify.open({
            key: 'sync-fixed',
            title: '固定 key',
            content: `重复点击只更新这一条（${new Date().toLocaleTimeString()}）`,
          })
        }
      >
        key 去重
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          Notify.open({
            title: '可撤销',
            content: '3 个资源将被删除',
            tone: 'warning',
            actions: <Button size="sm" variant="ghost">撤销</Button>,
          })
        }
      >
        带操作
      </Button>
    </div>
  ),
};
