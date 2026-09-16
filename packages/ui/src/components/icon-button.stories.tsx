import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heart, Moon, Share2, SlidersHorizontal } from 'lucide-react';
import { IconButton } from './button';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'ფავორიტებში დამატება', children: <Heart className="size-4" strokeWidth={1.5} aria-hidden /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Set: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton label="ფილტრები" variant="secondary">
        <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
      </IconButton>
      <IconButton label="გაზიარება" size="sm">
        <Share2 className="size-4" strokeWidth={1.5} aria-hidden />
      </IconButton>
      <IconButton label="მუქი თემა" size="lg">
        <Moon className="size-5" strokeWidth={1.5} aria-hidden />
      </IconButton>
    </div>
  ),
};
