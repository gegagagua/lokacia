import { SIGN_STATUS_LABELS_KA } from '@lokacia/contracts';
import { Badge } from '@lokacia/ui';

export function SignStatusBadge({ status }: { status: keyof typeof SIGN_STATUS_LABELS_KA }) {
  const tone = status === 'signed' ? 'success' : status === 'sent' ? 'link' : status === 'declined' ? 'danger' : 'outline';
  return <Badge tone={tone}>{SIGN_STATUS_LABELS_KA[status]}</Badge>;
}
