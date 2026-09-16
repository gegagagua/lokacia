import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { formatMoney } from '@lokacia/contracts';
import { Slider } from './form';

const meta = { title: 'Components/Slider', component: Slider } satisfies Meta<typeof Slider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PriceRange: Story = {
  render: () => {
    const [v, setV] = React.useState([1500, 6000]);
    return (
      <div className="max-w-sm">
        <p className="mb-2 text-small font-medium">ფასი თვეში</p>
        <Slider min={0} max={20000} step={100} value={v} onValueChange={setV} formatValue={(n) => formatMoney(n * 100)} />
      </div>
    );
  },
};
export const Single: Story = {
  render: () => (
    <div className="max-w-sm">
      <p className="mb-2 text-small font-medium">მინიმალური ფართობი</p>
      <Slider min={10} max={1000} defaultValue={[60]} formatValue={(n) => `${n} მ²`} />
    </div>
  ),
};
