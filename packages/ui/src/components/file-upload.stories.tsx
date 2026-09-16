import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileUpload, type UploadItem } from './file-upload';
import { drawingPhoto } from '../stories/fixtures';

function Demo({ initial }: { initial: UploadItem[] }) {
  const [items, setItems] = React.useState(initial);
  return (
    <div className="max-w-2xl">
      <FileUpload
        items={items}
        onFiles={(files) => setItems((s) => [...s, ...files.map((f, i) => ({ id: `${f.name}-${Date.now()}-${i}`, url: URL.createObjectURL(f), name: f.name, status: 'ready' as const }))])}
        onReorder={(ids) => setItems((s) => ids.map((id) => s.find((x) => x.id === id)!))}
        onRemove={(id) => setItems((s) => s.filter((x) => x.id !== id))}
      />
    </div>
  );
}

const meta = { title: 'Components/FileUpload', component: Demo, args: { initial: [] } } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithPhotos: Story = {
  args: {
    initial: [
      { id: 'a', url: drawingPhoto(1), name: 'ფასადი', status: 'ready' },
      { id: 'b', url: drawingPhoto(2), name: 'დარბაზი', status: 'ready' },
      { id: 'c', url: '', name: 'სამზარეულო', status: 'uploading', progress: 42 },
      { id: 'd', url: drawingPhoto(3), name: 'ნახაზი', status: 'processing' },
      { id: 'e', url: drawingPhoto(4), name: 'სველი წერტილი', status: 'failed' },
    ],
  },
};
