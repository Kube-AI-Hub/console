import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardTitle, CardDescription } from '../src/primitives/Display';
import { Icon } from '../src/primitives/Icon';
import { ComponentDocs } from './_docs-layout';

const cardMeta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Card"
          summary="把相关内容归为一组。可交互时启用悬浮抬升与指针聚光。"
          description={
            <>
              <code>interactive</code> 只在整张卡片可点击时开启，它会带来位移与聚光动效；
              卡片内已有可点击元素时不要开启，否则用户分不清点哪里。
            </>
          }
        />
      ),
    },
  },
};

export default cardMeta;

type CardStory = StoryObj<typeof Card>;

export const BasicCard: CardStory = {
  name: 'basic card',
  render: () => (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
      {[
        { title: '节点概览', desc: '12 个节点，全部就绪', icon: 'kubernetes' as const },
        { title: 'GPU 使用率', desc: '平均 62%，峰值 94%', icon: 'gpu' as const },
        { title: '存储水位', desc: 'JuiceFS 已用 3.2 TiB', icon: 'storage' as const },
      ].map((item) => (
        <Card key={item.title} interactive>
          <CardContent className="pt-4">
            <Icon name={item.icon} size={18} className="mb-2 text-ai-accent" />
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.desc}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
