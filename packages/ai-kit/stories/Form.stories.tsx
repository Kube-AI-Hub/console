import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Form, FormItem, FormGroup } from '../src/primitives/Form';
import { Input, Textarea } from '../src/primitives/Input';
import { InputNumber } from '../src/primitives/InputNumber';
import { Select } from '../src/primitives/Select';
import { Switch } from '../src/primitives/Toggles';
import { Button } from '../src/primitives/Button';
import { Text } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Form> = {
  title: 'Components/Form',
  component: Form,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Form"
          summary="声明式表单：字段自动接线、集中校验。规则格式兼容 async-validator。"
          description={
            <>
              字段用 <code>name</code> 绑定到值的路径，<code>FormItem</code> 负责取值、回写、
              错误展示与必填标记。校验规则支持 <code>required</code>、<code>pattern</code>、
              <code>min</code> / <code>max</code> 与自定义 <code>validator</code>。
              需要由 schema 驱动的表单（字段动态生成、与列表/详情共用定义）时，用 <code>ResourceForm</code>。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Form>;

export const BasicForm: Story = {
  name: 'basic form',
  render: () => {
    const [submitted, setSubmitted] = React.useState<Record<string, unknown> | null>(null);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    return (
      <div className="max-w-xl">
        <Form
          defaultData={{ name: '', replicas: 1, strategy: 'rolling', description: '' }}
          onSubmit={setSubmitted}
          onError={setErrors}
        >
          <FormGroup title="基本信息">
            <FormItem
              name="name"
              label="名称"
              rules={[
                { required: true, message: '名称不能为空' },
                { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字与连字符' },
                { max: 24, message: '最多 24 个字符' },
              ]}
              hint="小写字母、数字与连字符"
            >
              <Input placeholder="my-workload" />
            </FormItem>
            <FormItem name="replicas" label="副本数" rules={[{ required: true, message: '副本数不能为空' }]}>
              <InputNumber min={1} max={50} />
            </FormItem>
            <FormItem name="strategy" label="更新策略">
              <Select
                options={[
                  { value: 'rolling', label: '滚动更新' },
                  { value: 'recreate', label: '重建' },
                ]}
              />
            </FormItem>
            <FormItem name="description" label="说明" hint="可选">
              <Textarea placeholder="补充说明" />
            </FormItem>
          </FormGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost">取消</Button>
            <Button type="submit" variant="primary">提交</Button>
          </div>
        </Form>

        {Object.keys(errors).length ? (
          <pre className="mt-4 overflow-x-auto rounded-ai-md border border-ai-danger/30 bg-ai-danger/10 p-3 font-ai-mono text-[11px] text-ai-fg-muted">
            {JSON.stringify(errors, null, 2)}
          </pre>
        ) : null}
        {submitted ? (
          <pre className="mt-4 overflow-x-auto rounded-ai-md border border-ai-line bg-ai-surface-2 p-3 font-ai-mono text-[11px] text-ai-fg-secondary">
            {JSON.stringify(submitted, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  },
};

/** 分组把长表单切成几段，每段有标题和说明，减少一次性阅读的压力。 */
export const GroupedFields: Story = {
  name: 'form group',
  render: () => (
    <div className="max-w-xl">
      <Form defaultData={{ name: '', cpu: 4, memory: 8, autoScale: true }}>
        <FormGroup title="基本信息" description="这些字段会写进资源对象的 metadata。">
          <FormItem name="name" label="名称" rules={[{ required: true, message: '名称不能为空' }]}>
            <Input placeholder="my-workload" />
          </FormItem>
        </FormGroup>

        <FormGroup title="资源规格" description="CPU 与内存会决定 Pod 的 QoS 等级。">
          <FormItem name="cpu" label="CPU 核数" rules={[{ required: true }]}>
            <InputNumber min={1} max={128} />
          </FormItem>
          <FormItem name="memory" label="内存 (GiB)" rules={[{ required: true }]}>
            <InputNumber min={1} max={1024} />
          </FormItem>
        </FormGroup>

        <FormGroup title="高级设置" description="留空则使用集群默认值。">
          <FormItem name="autoScale" label="自动伸缩">
            <Switch aria-label="自动伸缩" />
          </FormItem>
        </FormGroup>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost">取消</Button>
          <Button type="submit" variant="primary">创建</Button>
        </div>
      </Form>
    </div>
  ),
};

/** 失焦即校验，让用户在提交前就发现格式问题。 */
export const ValidateOnBlur: Story = {
  name: 'validate on blur',
  render: () => (
    <div className="max-w-md">
      <Form defaultData={{ email: '' }} onSubmit={() => undefined}>
        <FormItem
          name="email"
          label="邮箱"
          validateOnBlur
          rules={[
            { required: true, message: '邮箱不能为空' },
            { pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: '邮箱格式不正确' },
          ]}
        >
          <Input placeholder="name@example.com" />
        </FormItem>
        <FormItem name="notify" label="接收通知">
          <Switch aria-label="接收通知" />
        </FormItem>
      </Form>
      <Text size="xs" tone="muted" className="mt-3">
        留空或输入非法邮箱后失焦即可看到校验提示。
      </Text>
    </div>
  ),
};
