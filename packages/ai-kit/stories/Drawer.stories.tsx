import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Drawer } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';
import { Text } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

/* ---------------- Drawer ---------------- */

const drawerMeta: Meta<typeof Drawer> = {
  title: 'Components/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Drawer"
          summary="从侧边滑出的面板，适合查看详情或填写多步表单。"
          description={
            <>
              与 Modal 的分工：Drawer 允许用户边看列表边处理详情，适合不需要中断上下文的操作；
              需要用户先作答才能继续时用 Modal。
            </>
          }
        />
      ),
    },
  },
};

export default drawerMeta;

type DrawerStory = StoryObj<typeof Drawer>;

export const BasicDrawer: DrawerStory = {
  name: 'basic drawer',
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>打开抽屉</Button>
        <Drawer open={open} onOpenChange={setOpen} title="实例详情" description="从右侧滑出">
          <Text size="sm" tone="muted">抽屉内容。</Text>
        </Drawer>
      </>
    );
  },
};
