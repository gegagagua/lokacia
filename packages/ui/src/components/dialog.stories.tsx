import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from './overlay';
import { Button } from './button';
import { Field, Input } from './form';
import { Calendar } from './calendar';

const meta = { title: 'Components/Dialog', component: Dialog, args: { title: 'ჩვენების ჯავშნა' } } satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithTrigger: Story = {
  render: (args) => (
    <Dialog
      {...args}
      description="აირჩიეთ დღე — ბროკერი დაადასტურებს დროს."
      trigger={<Button>ჩვენების ჯავშნა</Button>}
      footer={
        <>
          <Button variant="ghost">გაუქმება</Button>
          <Button>ჯავშნის დადასტურება</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Calendar value={new Date(2026, 8, 18)} minDate={new Date(2026, 8, 16)} />
        <Field label="სახელი">
          <Input placeholder="თქვენი სახელი" />
        </Field>
      </div>
    </Dialog>
  ),
};
export const Open: Story = {
  args: { open: true, size: 'sm', title: 'განცხადების წაშლა', description: 'ეს ქმედება შეუქცევადია.' },
  render: (args) => <Dialog {...args} footer={<Button variant="danger">წაშლა</Button>} />,
};
