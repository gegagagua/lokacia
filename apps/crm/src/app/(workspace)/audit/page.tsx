import { RequirePerm } from '@/components/common/require-perm';
import { AuditView } from '@/components/data/audit-view';

export const metadata = { title: 'ქმედებების ჟურნალი' };

export default function AuditPage() {
  return (
    <RequirePerm perm="audit.view">
      <AuditView />
    </RequirePerm>
  );
}
