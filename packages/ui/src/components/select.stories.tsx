import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, Select } from './form';

const types = [
  { value: 'cafe', label: 'კაფე' },
  { value: 'restaurant', label: 'რესტორანი' },
  { value: 'office', label: 'ოფისი' },
  { value: 'retail', label: 'მაღაზია' },
  { value: 'warehouse', label: 'საწყობი', disabled: true },
];

const meta = { title: 'Components/Select', component: Select, args: { options: types } } satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field label="ბიზნესის ტიპი" className="max-w-xs">
      <Select {...args} placeholder="ყველა ტიპი" />
    </Field>
  ),
};
export const WithError: Story = {
  render: (args) => (
    <Field label="გარიგების ტიპი" error="აირჩიეთ გარიგების ტიპი" className="max-w-xs">
      <Select {...args} options={[{ value: 'rent', label: 'იჯარა' }, { value: 'sale', label: 'იყიდება' }]} placeholder="აირჩიეთ" />
    </Field>
  ),
};
