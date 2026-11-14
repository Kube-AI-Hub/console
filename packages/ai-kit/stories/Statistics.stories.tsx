import type { Meta, StoryObj } from '@storybook/react';
import { StatisticsGroup, MetricCell } from '../src/primitives/Statistics';

export default { title: 'Components/Statistics', component: StatisticsGroup, parameters: { layout: 'padded' } } satisfies Meta<typeof StatisticsGroup>;

export const SummaryAndMetrics: StoryObj = {
  render: () => <div className="flex flex-col gap-4">
    <StatisticsGroup unknownLabel="未上报" items={[
      { key: 'total', label: '集群节点', value: 120 },
      { key: 'healthy', label: '节点健康率', value: '99.2%', description: '119 / 120 健康节点', tone: 'success' },
      { key: 'vendor', label: '未知厂商的长名称', value: 0 },
      { key: 'loading', label: '加载中', value: null, state: 'loading' },
      { key: 'unknown', label: '未上报', value: null, state: 'unknown' },
    ]} />
    <div className="flex flex-wrap gap-8">
      <MetricCell value="0%" detail="0.00 / 8 卡" allocation="已分配：6 卡" />
      <MetricCell value="92%" detail="164 / 179 GiB" tone="warning" />
      <MetricCell value="-" detail="指标未上报" />
    </div>
  </div>,
};
