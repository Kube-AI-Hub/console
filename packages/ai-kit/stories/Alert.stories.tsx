import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from '../src/primitives/Feedback';
import { ComponentDocs } from './_docs-layout';

const alertMeta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Alert"
          summary="用于在页面内持续展示一条需要用户注意的信息。"
          description={
            <>
              与 <code>Notify</code> / <code>Toast</code> 的区别：Alert 是<strong>页面内常驻</strong>的，
              随内容一起滚动、不自动消失；Notify 是浮在角落、会定时关闭的临时提示。
              需要用户确认或必须看到的信息用 Alert，操作结果回执用 Notify。
            </>
          }
        />
      ),
    },
  },
};

export default alertMeta;
type Story = StoryObj<typeof Alert>;

const SAMPLE = 'Kube AI Hub 是面向 AI 工作负载的容器管理平台。';

/** 四种语义色覆盖了需要提示用户的全部场景。 */
export const BasicAlerts: Story = {
  name: 'basic alerts',
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Alert>{SAMPLE}</Alert>
      <Alert tone="info">{SAMPLE}</Alert>
      <Alert tone="success">{SAMPLE}</Alert>
      <Alert tone="warning">{SAMPLE}</Alert>
      <Alert tone="danger">{SAMPLE}</Alert>
    </div>
  ),
};

/** 带标题时，标题承担结论，正文补充细节。 */
export const AlertsTitle: Story = {
  name: 'alerts title',
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Alert tone="info" title="Kube AI Hub">一条中性提示，标题写结论，正文写原因。</Alert>
      <Alert tone="success" title="已保存">配置已写入 etcd，10 秒内生效。</Alert>
      <Alert tone="warning" title="磁盘接近上限">节点 a100-04 的数据盘已使用 87%，建议清理或扩容。</Alert>
      <Alert tone="danger" title="连接失败">无法连接到集群 API，请检查 kubeconfig 与网络连通性。</Alert>
    </div>
  ),
};

/** 不设标题时只渲染正文，适合表格上方的一行说明。 */
export const InlineNote: Story = {
  name: 'inline note',
  render: () => (
    <div className="max-w-xl">
      <Alert tone="warning">当前筛选结果不包含已删除的资源。</Alert>
    </div>
  ),
};
