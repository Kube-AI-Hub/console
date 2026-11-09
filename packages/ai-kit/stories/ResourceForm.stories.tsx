import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ResourceForm, type FormSchema } from '../src/schema/ResourceForm';
import { Text } from '../src/primitives/Display';

interface WorkloadForm extends Record<string, unknown> {
  name: string;
  replicas: number;
  image: string;
  strategy: string;
  restartPolicy: string;
  autoscale: boolean;
  cpuLimit: number;
  schedule: string;
  labels: Record<string, string>;
  tags: string[];
  note: string;
}

const schema: FormSchema = {
  layout: { columns: 2 },
  submit: { label: '创建', cancelLabel: '取消' },
  fields: [
    {
      key: 'name',
      label: '名称',
      type: 'text',
      required: true,
      placeholder: 'my-workload',
      hint: '小写字母、数字与连字符',
      rules: [
        {
          validate: (value: unknown) =>
            typeof value === 'string' && value && !/^[a-z0-9-]+$/.test(value)
              ? '只能包含小写字母、数字与连字符'
              : null,
        },
      ],
    },
    { key: 'image', label: '镜像', type: 'text', required: true, placeholder: 'registry/app:tag' },
    { key: 'replicas', label: '副本数', type: 'number', min: 1, max: 50, placeholder: '1' },
    {
      key: 'strategy',
      label: '更新策略',
      type: 'select',
      options: [
        { value: 'rolling', label: '滚动更新' },
        { value: 'recreate', label: '重建' },
      ],
    },
    {
      key: 'restartPolicy',
      label: '重启策略',
      type: 'radio',
      options: [
        { value: 'always', label: '总是' },
        { value: 'onFailure', label: '失败时' },
      ],
    },
    { key: 'autoscale', label: '启用自动伸缩', type: 'switch' },
    {
      key: 'cpuLimit',
      label: 'CPU 上限',
      type: 'slider',
      min: 1,
      max: 16,
      hint: '单位为核',
      visible: (values) => Boolean(values.autoscale),
    },
    { key: 'schedule', label: '调度时间', type: 'date' },
    { key: 'tags', label: '标签', type: 'tags', wide: true },
    { key: 'labels', label: '注解', type: 'key-value', wide: true },
    { key: 'note', label: '说明', type: 'textarea', wide: true, placeholder: '可选' },
  ],
};

const meta: Meta = {
  title: 'Schema/ResourceForm',
  parameters: { layout: 'padded' },
};
export default meta;

export const AllFieldTypes: StoryObj = {
  render: () => {
    const [submitted, setSubmitted] = React.useState<WorkloadForm | null>(null);
    return (
      <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-base font-semibold text-ai-fg">创建工作负载</h1>
            <p className="mt-1 text-xs text-ai-fg-muted">提交时会校验必填与自定义规则；打开自动伸缩会多出 CPU 上限。</p>
          </div>
          <ResourceForm
            schema={schema}
            defaultValues={{
              name: '',
              replicas: 1,
              image: '',
              strategy: 'rolling',
              restartPolicy: 'always',
              autoscale: false,
              cpuLimit: 2,
              schedule: '',
              labels: {},
              tags: [],
              note: '',
            }}
            onSubmit={(values) => setSubmitted(values)}
          />
          {submitted ? (
            <div className="mt-6 rounded-ai-md border border-ai-line bg-ai-surface-2 p-3">
              <Text size="xs" tone="muted">提交结果</Text>
              <pre className="mt-1 overflow-x-auto font-ai-mono text-[11px] text-ai-fg-secondary">
                {JSON.stringify(submitted, null, 2)}
              </pre>
            </div>
          ) : null}
      </div>
    );
  },
};
