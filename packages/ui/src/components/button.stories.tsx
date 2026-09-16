import type { Meta, StoryObj } from '@storybook/react-vite';
import { Eye, Plus } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'ფართის გამოქვეყნება', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger', 'link', 'accent'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>ფართის გამოქვეყნება</Button>
      <Button variant="secondary">ძებნის შენახვა</Button>
      <Button variant="ghost">გაუქმება</Button>
      <Button variant="danger">განცხადების წაშლა</Button>
      <Button variant="link">ყველა ფართი</Button>
      <Button variant="accent">VIP სტატუსის ჩართვა</Button>
    </div>
  ),
};
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">ჩვენების ჯავშნა</Button>
      <Button size="md">ჩვენების ჯავშნა</Button>
      <Button size="lg">ჩვენების ჯავშნა</Button>
    </div>
  ),
};
export const WithIcon: Story = { args: { icon: <Eye className="size-4" strokeWidth={1.5} aria-hidden />, children: 'ნომრის ჩვენება', variant: 'secondary' } };
export const Loading: Story = { args: { loading: true, children: 'იგზავნება…' } };
export const Disabled: Story = { args: { disabled: true, icon: <Plus className="size-4" strokeWidth={1.5} aria-hidden /> } };
export const AsLink: Story = {
  render: () => (
    <Button asChild variant="secondary">
      <a href="#search">ფართების ძებნა</a>
    </Button>
  ),
};
