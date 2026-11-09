import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Modal } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';
import { Text } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

/* ---------------- Form ---------------- */

const modalMeta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Modal"
          summary="中断当前流程并要求用户确认的对话框。"
          description={
            <>
              弹窗会打断用户，只用于需要明确确认或必须填完才能继续的操作。
              页内可直接完成的事情不要放进弹窗。内容较长时用 <code>Drawer</code>。
              打开时焦点移入弹窗，关闭后归还给触发元素；Esc 与点击遮罩都可关闭。
            </>
          }
        />
      ),
    },
  },
};

export default modalMeta;

type ModalStory = StoryObj<typeof Modal>;

export const BasicModal: ModalStory = {
  name: 'basic modal',
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button variant="primary" onClick={() => setOpen(true)}>打开弹窗</Button>
        <Modal
          open={open}
          onOpenChange={setOpen}
          title="确认重启"
          description="重启会中断正在运行的实例。"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>确认重启</Button>
            </>
          }
        >
          <Text size="sm" tone="muted">受影响的实例：3 个</Text>
        </Modal>
      </>
    );
  },
};
