import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { DatePicker } from '../src/primitives/DatePicker';
import { Text } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof DatePicker> = {
  title: 'Components/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="DatePicker"
          summary="选择日期，可选带时间。值是 ISO 字符串，便于直接存进接口请求。"
          description={
            <>
              值为 <code>YYYY-MM-DD</code>；开启 <code>withTime</code> 后变为
              <code>YYYY-MM-DD HH:mm</code>。默认带清除按钮，不需要时传 <code>clearable=false</code>。
              需要限制可选范围时用 <code>disabledDate</code>，被禁的日期会加删除线并阻止点击，
              而不是点完之后报错。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const BasicDatePicker: Story = {
  name: 'basic datePicker',
  render: () => {
    const [value, setValue] = React.useState('2026-11-10');
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <DatePicker value={value} onChange={setValue} id="dp-basic" />
        <Text size="xs" tone="muted">当前值：{value || '（空）'}</Text>
      </div>
    );
  },
};

/** 带时间时，选完日期面板保持打开，方便同一次操作里调整小时。 */
export const WithTime: Story = {
  name: 'with time',
  render: () => {
    const [value, setValue] = React.useState('2026-11-10 09:30');
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <DatePicker value={value} onChange={setValue} withTime id="dp-time" />
        <Text size="xs" tone="muted">当前值：{value || '（空）'}</Text>
      </div>
    );
  },
};

/**
 * 时间范围：两个日历各自独立，起止可以跨月、跨年，时间也各自设置。
 *
 * 点标题可切到月视图和年视图，因此不必逐月翻页就能跳到任意年份。
 */
export const TimeRange: Story = {
  name: 'time range',
  render: () => {
    const [value, setValue] = React.useState('2026-11-01 00:00,2026-11-10 23:59');
    return (
      <div className="flex max-w-md flex-col gap-2">
        <DatePicker value={value} onChange={setValue} withTime range id="dp-timerange" />
        <p className="text-xs text-ai-fg-muted">当前值：{value || '（空）'}</p>
      </div>
    );
  },
};

/**
 * 日期范围：左右两个日历各自独立翻页与跳年，先点开始、再点结束。
 *
 * 中间的日子显示为连续区间；已选完后再次点击会重新开始。
 */
export const DateRange: Story = {
  name: 'date range',
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <div className="flex max-w-md flex-col gap-2">
        <DatePicker value={value} onChange={setValue} range placeholder="选择日期范围" id="dp-daterange" />
        <p className="text-xs text-ai-fg-muted">当前值：{value || '（空）'}</p>
      </div>
    );
  },
};

/** 禁用过去的日期，防止选中已过期的保留期。 */
export const DisabledDates: Story = {
  name: 'disabled dates',
  render: () => {
    const [value, setValue] = React.useState('');
    const today = React.useMemo(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }, []);
    return (
      <div className="flex max-w-xs flex-col gap-2">
        <DatePicker
          value={value}
          onChange={setValue}
          id="dp-disabled"
          disabledDate={(candidate) => candidate < today}
        />
        <Text size="xs" tone="muted">今天之前的日期不可选。</Text>
      </div>
    );
  },
};

/** 必须提供值时关闭清除能力。 */
export const NotClearable: Story = {
  name: 'not clearable',
  render: () => {
    const [value, setValue] = React.useState('2026-11-10');
    return (
      <div className="max-w-xs">
        <DatePicker value={value} onChange={setValue} clearable={false} id="dp-noclear" />
      </div>
    );
  },
};
