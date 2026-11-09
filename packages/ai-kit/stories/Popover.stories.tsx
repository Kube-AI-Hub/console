import type { Meta, StoryObj } from '@storybook/react';
import { Popover } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';
import { Text } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

/* ---------------- Popover ---------------- */

const popoverMeta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Popover"
          summary="点击触发的浮层，可以承载交互内容。"
          description={
            <>
              与 Tooltip 的区别：Popover 的内容<strong>可以交互</strong>（按钮、表单），
              需要用户点击触发，且点击外部才关闭。底层由 Radix Popover 提供定位与焦点管理。
            </>
          }
        />
      ),
    },
  },
};

export default popoverMeta;

type PopoverStory = StoryObj<typeof Popover>;

export const BasicPopover: PopoverStory = {
  name: 'basic popover',
  render: () => (
    <Popover trigger={<Button variant="secondary">弹出面板</Button>}>
      <Text size="sm">弹出层内容，可放任意组件。</Text>
    </Popover>
  ),
};
