import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './display';

const meta = { title: 'Components/Skeleton', component: Skeleton, args: { className: 'h-6 w-48' } } satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const ListingCardLoading: Story = {
  render: () => (
    <div role="status" aria-label="ფართები იტვირთება" className="grid max-w-sm overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-2">
        <Skeleton className="aspect-[4/3] rounded-none" />
        <Skeleton className="aspect-[4/3] rounded-none opacity-70" />
      </div>
      <div className="grid gap-2 p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-7 w-28" />
      </div>
    </div>
  ),
};
