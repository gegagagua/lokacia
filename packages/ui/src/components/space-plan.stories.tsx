import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpacePlan } from './space-plan';

const meta = {
  title: 'Signature/SpacePlan',
  component: SpacePlan,
  args: { widthM: 8, depthM: 8, areaM2: 64, ceilingM: 3.4, powerKw: 25 },
} satisfies Meta<typeof SpacePlan>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Cafe: Story = { render: (args) => <div className="max-w-md"><SpacePlan {...args} /></div> };
export const Warehouse: Story = { args: { widthM: 20, depthM: 31, areaM2: 620, ceilingM: 6, powerKw: 80 }, render: (args) => <div className="max-w-md"><SpacePlan {...args} /></div> };
export const LShapedOutline: Story = {
  args: { widthM: 12, depthM: 10, areaM2: 96, outline: [[0, 0], [12, 0], [12, 5], [6, 5], [6, 10], [0, 10]] },
  render: (args) => <div className="max-w-md"><SpacePlan {...args} /></div>,
};
export const UnknownDimensions: Story = { args: { widthM: null, depthM: null, areaM2: 95.5, ceilingM: 4.2, powerKw: null }, render: (args) => <div className="max-w-md"><SpacePlan {...args} /></div> };
export const Compact: Story = { args: { compact: true }, render: (args) => <div className="drawing-grid max-w-[220px] bg-bg p-2"><SpacePlan {...args} /></div> };
