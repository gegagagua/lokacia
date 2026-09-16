import { RequirePerm } from '@/components/common/require-perm';
import { DataView } from '@/components/data/data-view';

export const metadata = { title: 'იმპორტი და ექსპორტი' };

export default function DataPage() {
  return (
    <RequirePerm perm="data.import">
      <DataView />
    </RequirePerm>
  );
}
