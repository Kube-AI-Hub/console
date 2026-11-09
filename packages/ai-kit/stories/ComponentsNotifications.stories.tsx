import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Notify } from '../src/primitives/Notify';
import { ToastProvider, useToast } from '../src/primitives/Toast';
import { Button } from '../src/primitives/Button';
import { Text } from '../src/primitives/Display';

const meta: Meta = { title: 'Components/Notifications', parameters: { layout: 'padded' } };
export default meta;

/**
 * Two notification APIs.
 *
 * `Notify` is imperative and mounts its own host, which is what console calls
 * from request interceptors and action dispatchers. `Toast` is declarative and
 * needs a Provider; prefer it in new component code.
 */
export const ImperativeNotify: StoryObj = {
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <Text size="sm" tone="muted">
        命令式 API：可在任意函数中调用，无需组件上下文。适合请求拦截器、Promise 回调、action dispatcher。
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => Notify.info('同步中', '正在拉取集群资源')}>info</Button>
        <Button variant="secondary" onClick={() => Notify.success('保存成功', '配置已更新')}>success</Button>
        <Button variant="secondary" onClick={() => Notify.warning('磁盘接近上限', '已用 87%')}>warning</Button>
        <Button variant="secondary" onClick={() => Notify.error('请求失败', 'HTTP 502 Bad Gateway')}>error</Button>
        <Button variant="ghost" onClick={() => Notify.clear()}>清空全部</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => Notify.open({ title: '左下角', content: '不同 placement', placement: 'bottomLeft' })}
        >bottomLeft</Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => Notify.open({ title: '常驻通知', content: '不会自动关闭', duration: 0, closable: true })}
        >duration=0</Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => Notify.open({ key: 'sync-fixed', title: '固定 key', content: `重复点击只更新这一条（${new Date().toLocaleTimeString()}）` })}
        >key 去重</Button>
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
        >带操作</Button>
      </div>
    </div>
  ),
};

function ToastButtons(): React.ReactElement {
  const { push } = useToast();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <Text size="sm" tone="muted">
        声明式 API：需要 ToastProvider 包裹，从组件内读取上下文。批量失败时会排队而不是互相覆盖。
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => push({ title: '保存成功', tone: 'success', description: '配置已更新' })}>单条</Button>
        <Button
          variant="secondary"
          onClick={() => {
            push({ title: '第 1 行失败', tone: 'danger' });
            push({ title: '第 2 行失败', tone: 'danger' });
            push({ title: '第 3 行失败', tone: 'danger' });
          }}
        >批量三条</Button>
      </div>
    </div>
  );
}

export const DeclarativeToast: StoryObj = {
  render: () => (
    <ToastProvider position="bottom-right">
      <ToastButtons />
    </ToastProvider>
  ),
};
