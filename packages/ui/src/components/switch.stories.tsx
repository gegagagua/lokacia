import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './form';

const meta = { title: 'Components/Switch', component: Switch, args: { label: 'ახალი ფართების შეტყობინება' } } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Settings: Story = {
  render: () => (
    <div className="grid max-w-sm gap-3 rounded-card border border-border bg-surface p-4">
      <Switch label="SMS შეტყობინებები" defaultChecked />
      <Switch label="Telegram შეტყობინებები" />
      <Switch label="ელფოსტა" disabled />
    </div>
  ),
};
