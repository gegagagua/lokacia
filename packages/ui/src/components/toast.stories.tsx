import type { Meta, StoryObj } from '@storybook/react-vite';
import { useToast } from './overlay';
import { Button } from './button';

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast({ title: 'ძებნა შეინახა', description: 'ახალი ფართების შესახებ შეტყობინებას მიიღებთ SMS-ით.', tone: 'success' })}>ძებნის შენახვა</Button>
      <Button variant="secondary" onClick={() => toast({ title: 'ბმული კოპირებულია' })}>
        ბმულის კოპირება
      </Button>
      <Button variant="danger" onClick={() => toast({ title: 'ფოტო არ ატვირთა', description: 'ფაილი 20 მბ-ზე დიდია.', tone: 'danger' })}>
        შეცდომის ჩვენება
      </Button>
    </div>
  );
}

const meta = { title: 'Components/Toast', component: ToastDemo } satisfies Meta<typeof ToastDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
