import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover } from './overlay';
import { Button } from './button';
import { Slider } from './form';

const meta = { title: 'Components/Popover', component: Popover } satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AreaFilter: Story = {
  args: { trigger: <Button variant="secondary">ფართობი</Button>, children: null },
  render: (args) => (
    <Popover trigger={args.trigger}>
      <p className="mb-3 text-small font-medium">ფართობი, მ²</p>
      <Slider min={0} max={1000} defaultValue={[40, 200]} formatValue={(n) => `${n} მ²`} />
    </Popover>
  ),
};
export const Open: Story = {
  args: { trigger: <Button variant="secondary">ფართობი</Button>, children: null },
  render: (args) => (
    <div className="h-48">
      <Popover trigger={args.trigger} open>
        <p className="mb-3 text-small font-medium">ფართობი, მ²</p>
        <Slider min={0} max={1000} defaultValue={[40, 200]} formatValue={(n) => `${n} მ²`} />
      </Popover>
    </div>
  ),
};
