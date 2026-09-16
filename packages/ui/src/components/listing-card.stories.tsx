import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListingCard } from './listing-card';
import { businessTypeName, listings } from '../stories/fixtures';

const meta = {
  title: 'Components/ListingCard',
  component: ListingCard,
  args: { listing: listings[0]!, href: '#listing', businessTypeName },
} satisfies Meta<typeof ListingCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const VipVerifiedOwner: Story = { render: (args) => <div className="max-w-sm"><ListingCard {...args} /></div> };
export const BrokerWithCommission: Story = { args: { listing: listings[1]! }, render: (args) => <div className="max-w-sm"><ListingCard {...args} /></div> };
export const NoPhotoForSale: Story = { args: { listing: listings[2]! }, render: (args) => <div className="max-w-sm"><ListingCard {...args} /></div> };
export const OffPlanTransfer: Story = { args: { listing: listings[3]! }, render: (args) => <div className="max-w-sm"><ListingCard {...args} /></div> };
export const Favorite: Story = {
  render: (args) => {
    const [fav, setFav] = React.useState(false);
    return (
      <div className="max-w-sm">
        <ListingCard {...args} favorite={fav} onFavorite={() => setFav((f) => !f)} />
      </div>
    );
  },
};
export const RowLayout: Story = { args: { layout: 'row' } };
export const Grid: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l, i) => (
        <ListingCard key={l.id} listing={l} href={`#${l.slug}`} businessTypeName={businessTypeName} priority={i === 0} />
      ))}
    </div>
  ),
};
