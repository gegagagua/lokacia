import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchX } from 'lucide-react';
import { EmptyState } from './display';
import { Button } from './button';

const meta = { title: 'Components/EmptyState', component: EmptyState, args: { title: 'ფავორიტები ცარიელია' } } satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { description: 'შეინახეთ ფართები გულის ღილაკით — ისინი აქ გამოჩნდება.', action: <Button variant="secondary">ფართების ძებნა</Button> } };
export const NoResults: Story = {
  args: {
    title: 'ამ ფილტრებით ფართი არ მოიძებნა',
    description: 'შეამცირეთ ფილტრები ან შეინახეთ ძებნა — ახალი ფართის გამოჩნდისას შეტყობინებას მიიღებთ.',
    icon: <SearchX className="size-5" strokeWidth={1.5} aria-hidden />,
    action: <Button>ძებნის შენახვა</Button>,
  },
};
