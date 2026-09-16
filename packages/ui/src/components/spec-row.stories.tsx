import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpDown, Car, Layers, Ruler, Zap } from 'lucide-react';
import { SpecRow } from './display';

const i = 'size-4';
const meta = { title: 'Components/SpecRow', component: SpecRow, args: { label: 'ფართობი', value: '64', unit: 'მ²' } } satisfies Meta<typeof SpecRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Passport: Story = {
  render: () => (
    <div className="max-w-md rounded-card border border-border bg-surface px-4 py-2">
      <SpecRow icon={<Ruler className={i} strokeWidth={1.5} aria-hidden />} label="ფართობი" value="64" unit="მ²" />
      <SpecRow icon={<ArrowUpDown className={i} strokeWidth={1.5} aria-hidden />} label="ჭერის სიმაღლე" value="3,4" unit="მ" />
      <SpecRow icon={<Zap className={i} strokeWidth={1.5} aria-hidden />} label="ელექტროენერგია" value="25" unit="კვტ" />
      <SpecRow icon={<Layers className={i} strokeWidth={1.5} aria-hidden />} label="სართული" value="1 / 9" />
      <SpecRow icon={<Car className={i} strokeWidth={1.5} aria-hidden />} label="პარკინგი" value="არა" muted />
    </div>
  ),
};
