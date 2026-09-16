import type { Meta, StoryObj } from '@storybook/react-vite';
import { Info } from 'lucide-react';
import { Tooltip } from './overlay';
import { IconButton } from './button';

const meta = { title: 'Components/Tooltip', component: Tooltip } satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { content: 'ფასი მოიცავს დღგ-ს', children: null },
  render: (args) => (
    <div className="p-10">
      <Tooltip content={args.content}>
        <IconButton label="ფასის შესახებ" variant="secondary">
          <Info className="size-4" strokeWidth={1.5} aria-hidden />
        </IconButton>
      </Tooltip>
    </div>
  ),
};
