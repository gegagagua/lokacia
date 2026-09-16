import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEAL_TYPE_LABELS_KA, formatDateKa, formatMoney, type ListingCard } from '@lokacia/contracts';
import { Table, type Column } from './data';
import { Badge } from './display';
import { listings } from '../stories/fixtures';

const columns: Column<ListingCard>[] = [
  { key: 'title', header: 'ფართი', cell: (l) => <span className="font-medium">{l.districtName} · {l.address}</span>, sortValue: (l) => l.districtName },
  { key: 'deal', header: 'გარიგება', cell: (l) => <Badge tone="outline">{DEAL_TYPE_LABELS_KA[l.dealType]}</Badge> },
  { key: 'area', header: 'მ²', align: 'right', cell: (l) => l.areaM2, sortValue: (l) => l.areaM2 },
  { key: 'price', header: 'ფასი', align: 'right', cell: (l) => formatMoney(l.priceMinor), sortValue: (l) => l.priceMinor },
  { key: 'published', header: 'გამოქვეყნდა', cell: (l) => (l.publishedAt ? formatDateKa(l.publishedAt) : '—'), sortValue: (l) => l.publishedAt },
];

function ListingsTable(props: { empty?: boolean; clickable?: boolean }) {
  return (
    <Table<ListingCard>
      columns={columns}
      rows={props.empty ? [] : listings}
      rowKey={(l) => l.id}
      initialSort={{ key: 'price', dir: 'desc' }}
      empty="ფართები არ მოიძებნა"
      stickyFirst
    />
  );
}

const meta = { title: 'Components/Table', component: ListingsTable } satisfies Meta<typeof ListingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sortable: Story = {};
export const Empty: Story = { args: { empty: true } };
