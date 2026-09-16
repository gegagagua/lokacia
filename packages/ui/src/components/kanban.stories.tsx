import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { formatMoney } from '@lokacia/contracts';
import { Kanban, type KanbanColumn, type KanbanItem } from './kanban';
import { Avatar, Badge } from './display';

type Deal = KanbanItem & { client: string; space: string; budgetMinor: number; agent: string; hot?: boolean };

const columns: KanbanColumn[] = [
  { key: 'new', title: 'ახალი მოთხოვნა' },
  { key: 'viewing', title: 'ჩვენება' },
  { key: 'offer', title: 'შეთავაზება' },
  { key: 'won', title: 'ხელშეკრულება', tone: 'won' },
  { key: 'lost', title: 'უარი', tone: 'lost' },
];

const initial: Deal[] = [
  { id: 'd1', column: 'new', client: 'შპს „ყავის სახლი“', space: 'ვაკე, 60–80 მ²', budgetMinor: 500_000, agent: 'ნინო ბერიძე', hot: true },
  { id: 'd2', column: 'new', client: 'ფარმა პლუს', space: 'საბურთალო, 40 მ²', budgetMinor: 300_000, agent: 'ლევან ჯაფარიძე' },
  { id: 'd3', column: 'viewing', client: 'ბიუტი ლაბ', space: 'ჭავჭავაძის 37', budgetMinor: 450_000, agent: 'ნინო ბერიძე' },
  { id: 'd4', column: 'offer', client: 'ლოჯისტიკ ჯი', space: 'დიდუბე, საწყობი 620 მ²', budgetMinor: 1_200_000, agent: 'გიორგი კაპანაძე' },
  { id: 'd5', column: 'won', client: 'ოფის ჰაბ', space: 'ყაზბეგის 24, 7 სართ.', budgetMinor: 980_000, agent: 'ლევან ჯაფარიძე' },
];

function Board() {
  const [items, setItems] = React.useState(initial);
  return (
    <Kanban<Deal>
      columns={columns}
      items={items}
      onMove={(id, column, index) =>
        setItems((s) => {
          const moved = { ...s.find((d) => d.id === id)!, column };
          const rest = s.filter((d) => d.id !== id);
          const inCol = rest.filter((d) => d.column === column);
          const at = index >= inCol.length ? rest.length : rest.indexOf(inCol[index]!);
          return [...rest.slice(0, at), moved, ...rest.slice(at)];
        })
      }
      renderItem={(d) => (
        <div className="rounded-[8px] border border-border bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-snug">{d.client}</p>
            {d.hot && <Badge tone="accent">ცხელი</Badge>}
          </div>
          <p className="mt-1 text-small text-muted">{d.space}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-small tabular">{formatMoney(d.budgetMinor)}</span>
            <Avatar name={d.agent} size={24} />
          </div>
        </div>
      )}
    />
  );
}

const meta = { title: 'CRM/Kanban', component: Board } satisfies Meta<typeof Board>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pipeline: Story = {};
