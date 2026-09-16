import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './display';

const meta = { title: 'Components/Avatar', component: Avatar, args: { name: 'ნინო ბერიძე', size: 40 } } satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="გიორგი კაპანაძე" size={24} />
      <Avatar name="ქალაქის ფართები" size={40} />
      <Avatar name="ლევან ჯაფარიძე" size={64} />
      <Avatar name={null} size={40} />
    </div>
  ),
};
