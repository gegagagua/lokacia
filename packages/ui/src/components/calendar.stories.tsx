import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { formatDateKa } from '@lokacia/contracts';
import { Calendar } from './calendar';

const d = (day: number) => new Date(2026, 8, day);
const meta = {
  title: 'Components/Calendar',
  component: Calendar,
  args: {
    value: d(18),
    events: [
      { id: 'e1', date: d(17), label: 'ჩვენება — ვაკე' },
      { id: 'e2', date: d(18), label: 'ჩვენება — საბურთალო' },
      { id: 'e3', date: d(18), label: 'ხელშეკრულება', tone: 'accent' },
      { id: 'e4', date: d(24), label: 'ზარი მესაკუთრეს', tone: 'muted' },
    ],
  },
} satisfies Meta<typeof Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Viewings: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<Date>(args.value ?? d(18));
    return (
      <div className="max-w-sm">
        <Calendar {...args} value={value} onChange={setValue} minDate={d(16)} />
        <p className="mt-2 text-small text-muted" aria-live="polite">
          არჩეული: {formatDateKa(value)}
        </p>
      </div>
    );
  },
};
