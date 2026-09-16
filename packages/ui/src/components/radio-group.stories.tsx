import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup } from './form';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: {
    'aria-label': 'გარიგების ტიპი',
    defaultValue: 'rent',
    options: [
      { value: 'rent', label: 'იჯარა' },
      { value: 'sale', label: 'იყიდება' },
      { value: 'transfer', label: 'ბიზნესის გადაცემა' },
      { value: 'short_term', label: 'ხანმოკლე იჯარა', disabled: true },
    ],
  },
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Horizontal: Story = { args: { className: 'flex-row gap-6', orientation: 'horizontal' } };
