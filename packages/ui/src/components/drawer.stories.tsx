import type { Meta, StoryObj } from '@storybook/react-vite';
import { Drawer } from './overlay';
import { Button } from './button';
import { Checkbox, Field, Select } from './form';

const meta = { title: 'Components/Drawer', component: Drawer, args: { title: 'ფილტრები' } } satisfies Meta<typeof Drawer>;
export default meta;
type Story = StoryObj<typeof meta>;

const body = (
  <div className="grid gap-4">
    <Field label="ბიზნესის ტიპი">
      <Select options={[{ value: 'cafe', label: 'კაფე' }, { value: 'office', label: 'ოფისი' }]} placeholder="ყველა ტიპი" />
    </Field>
    <Checkbox label="ვერიფიცირებული მესაკუთრე" />
    <Checkbox label="ვენტილაცია" />
  </div>
);

export const Right: Story = {
  render: (args) => (
    <Drawer {...args} trigger={<Button variant="secondary">ფილტრები</Button>} footer={<Button className="w-full">312 ფართის ჩვენება</Button>}>
      {body}
    </Drawer>
  ),
};
export const BottomSheet: Story = {
  render: (args) => (
    <Drawer {...args} side="bottom" trigger={<Button variant="secondary">ფილტრები (მობილური)</Button>}>
      {body}
    </Drawer>
  ),
};
export const Open: Story = {
  args: { open: true },
  render: (args) => (
    <Drawer {...args} footer={<Button className="w-full">312 ფართის ჩვენება</Button>}>
      {body}
    </Drawer>
  ),
};
