import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search } from 'lucide-react';
import { Field, Input, Textarea } from './form';

const meta = { title: 'Components/Input', component: Input } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithField: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Field label="სათაური" hint="მაგ.: ფართი კაფესთვის ვაკეში" required>
        <Input placeholder="განცხადების სათაური" />
      </Field>
      <Field label="ფართობი">
        <Input type="number" inputMode="decimal" defaultValue={64} suffix="მ²" />
      </Field>
      <Field label="ძებნა">
        <Input prefixIcon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} placeholder="მისამართი ან უბანი" />
      </Field>
      <Field label="ტელეფონი" error="ნომერი უნდა იყოს 9 ციფრი">
        <Input type="tel" defaultValue="+995 555 12" />
      </Field>
      <Field label="აღწერა">
        <Textarea defaultValue="პირველი ხაზი, ორი შესასვლელი, ვენტილაციის შახტა." />
      </Field>
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <Field label="საკადასტრო კოდი">
      <Input disabled defaultValue="01.14.12.004.035" />
    </Field>
  ),
};
