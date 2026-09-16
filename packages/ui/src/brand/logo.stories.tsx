import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo, LogoMark, LogoWordmark } from './logo';

const meta = { title: 'Brand/Logo', component: Logo, args: { size: 28, showGeorgian: true } } satisfies Meta<typeof Logo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Lockup: Story = {};
export const Mark: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-primary">
      <LogoMark size={20} />
      <LogoMark size={32} />
      <LogoMark size={64} />
      <LogoMark size={128} />
    </div>
  ),
};
export const Wordmark: Story = { render: () => <LogoWordmark /> };
export const LatinOnly: Story = { args: { showGeorgian: false, size: 40 } };
