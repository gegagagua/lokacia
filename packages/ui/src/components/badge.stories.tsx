import type { Meta, StoryObj } from '@storybook/react-vite';
import { LISTING_STATUS_LABELS_KA, type ListingStatus } from '@lokacia/contracts';
import { Badge, VerifiedBadge, VipBadge, type BadgeTone } from './display';

const statusTone: Record<ListingStatus, BadgeTone> = {
  draft: 'outline',
  pending_review: 'link',
  active: 'success',
  stale: 'accent',
  rented: 'primary',
  sold: 'primary',
  archived: 'neutral',
  rejected: 'danger',
};

const meta = { title: 'Components/Badge', component: Badge, args: { children: 'იჯარა', tone: 'neutral' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['neutral', 'primary', 'accent', 'link', 'danger', 'success', 'outline'] as const).map((t) => (
        <Badge key={t} tone={t}>
          {t}
        </Badge>
      ))}
    </div>
  ),
};
export const ListingStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(LISTING_STATUS_LABELS_KA) as ListingStatus[]).map((s) => (
        <Badge key={s} tone={statusTone[s]}>
          {LISTING_STATUS_LABELS_KA[s]}
        </Badge>
      ))}
    </div>
  ),
};
export const Vip: Story = { render: () => <VipBadge /> };
export const Verified: Story = { render: () => <VerifiedBadge /> };
