import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatThread, type ChatMessage } from './chat-thread';
import { Avatar } from './display';

const at = (h: number, m: number) => new Date(2026, 8, 16, h, m).toISOString();
const initial: ChatMessage[] = [
  { id: 'm1', body: 'გამარჯობა! ფართი ჭავჭავაძეზე ისევ თავისუფალია?', mine: false, at: at(10, 2), author: 'ნინო (მოიჯარე)' },
  { id: 'm2', body: 'გამარჯობა, კი. ხვალ 12:00-ზე ჩვენება შეგიძლიათ?', mine: true, at: at(10, 5), readAt: at(10, 6) },
  { id: 'm3', body: 'კი, მომიწერეთ ზუსტი მისამართი.', mine: false, at: at(10, 7), author: 'ნინო (მოიჯარე)', channel: 'telegram' },
  { id: 'm4', body: 'ი. ჭავჭავაძის პრ. 37, შესასვლელი ქუჩის მხრიდან.', mine: true, at: at(10, 9), attachments: [{ url: '#plan', name: 'ნახაზი.pdf', type: 'application/pdf' }] },
];

function Demo() {
  const [messages, setMessages] = React.useState(initial);
  return (
    <div className="h-[520px] max-w-lg">
      <ChatThread
        messages={messages}
        header={
          <div className="flex items-center gap-2">
            <Avatar name="ნინო ბერიძე" size={32} />
            <div>
              <p className="font-medium leading-tight">ნინო ბერიძე</p>
              <p className="text-small text-muted">ფართი კაფესთვის, ვაკე</p>
            </div>
          </div>
        }
        onAttach={() => undefined}
        onSend={(body) => setMessages((s) => [...s, { id: String(s.length + 1), body, mine: true, at: new Date().toISOString() }])}
      />
    </div>
  );
}

const meta = { title: 'Components/ChatThread', component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {};
