import type { Meta, StoryObj } from '@storybook/react-vite';
import { PriceTag } from './listing-card';

const meta = { title: 'Components/PriceTag', component: PriceTag, args: { priceMinor: 450_000, period: 'month', areaM2: 64 } } satisfies Meta<typeof PriceTag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MonthlyRent: Story = {};
export const Sale: Story = { args: { priceMinor: 112_000_000, period: 'total', areaM2: undefined, size: 'lg' } };
export const ShortTerm: Story = { args: { priceMinor: 12_000, period: 'hour', areaM2: undefined, size: 'sm' } };
export const UsdPrice: Story = { args: { priceMinor: 250_000, currency: 'USD', period: 'month' } };
