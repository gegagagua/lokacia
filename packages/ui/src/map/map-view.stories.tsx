import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapView, type MapPoint } from './map-view';
import { listings } from '../stories/fixtures';
import { formatMoney } from '@lokacia/contracts';

const points: MapPoint[] = listings.map((l) => ({ id: l.id, lat: l.lat!, lng: l.lng!, vip: l.vip, label: formatMoney(l.priceMinor), title: l.title }));

const meta = {
  title: 'Map/MapView',
  component: MapView,
  args: { points, ariaLabel: 'ფართების რუკა' },
  parameters: {
    // Map tiles come from the network; a11y still runs on the container and pin buttons.
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof MapView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PinDrop: Story = {
  render: (args) => {
    const [selected, setSelected] = React.useState<string | null>(null);
    return (
      <div className="h-[480px]">
        <MapView {...args} center={[44.787, 41.72]} zoom={13} selectedId={selected} onPointClick={setSelected} />
        <p className="mt-2 text-small text-muted" aria-live="polite">
          {selected ? `არჩეული: ${listings.find((l) => l.id === selected)?.title}` : 'დააჭირეთ ფასის ნიშნულს'}
        </p>
      </div>
    );
  },
};
export const RadiusAndPois: Story = {
  args: {
    points: points.slice(0, 1),
    center: [44.7671, 41.7094],
    zoom: 15,
    radiusM: 500,
    pois: [
      { id: 'p1', lat: 41.7101, lng: 44.7652, name: 'კონკურენტი კაფე', category: 'competitor' },
      { id: 'p2', lat: 41.7085, lng: 44.7699, name: 'ავტობუსის გაჩერება', category: 'transport' },
    ],
  },
  render: (args) => (
    <div className="h-[480px]">
      <MapView {...args} />
    </div>
  ),
};
export const DraggablePin: Story = {
  render: () => {
    const [pin, setPin] = React.useState({ lat: 41.7151, lng: 44.7925 });
    return (
      <div className="h-[420px]">
        <MapView draggablePin={pin} onPinMove={setPin} onMapClick={setPin} ariaLabel="ფართის ლოკაცია" />
        <p className="mt-2 text-small tabular text-muted">
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </p>
      </div>
    );
  },
};
