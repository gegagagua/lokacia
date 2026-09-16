import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './form';

const meta = { title: 'Components/Checkbox', component: Checkbox, args: { label: 'ვენტილაცია (გამწოვი)' } } satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Group: Story = {
  render: () => (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2 text-small font-medium">კომუნიკაციები</legend>
      <Checkbox label="ვენტილაცია (გამწოვი)" defaultChecked />
      <Checkbox label="ბუნებრივი აირი" defaultChecked />
      <Checkbox label="ცალკე შესასვლელი" />
      <Checkbox label="სამზარეულოს ნებართვა" disabled />
    </fieldset>
  ),
};
export const WithoutVisibleLabel: Story = { args: { label: undefined, 'aria-label': 'შედარებაში დამატება' } };
