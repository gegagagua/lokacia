import { SIGN_STATUS_LABELS_KA } from '@lokacia/contracts';
import { Pill, type Tone } from '@/components/common/ui';

export const SIGN_STATUS_TONE: Record<keyof typeof SIGN_STATUS_LABELS_KA, Tone> = { draft: 'neutral', sent: 2, signed: 'success', declined: 'danger' };

export function SignStatusBadge({ status }: { status: keyof typeof SIGN_STATUS_LABELS_KA }) {
  return (
    <Pill tone={SIGN_STATUS_TONE[status]} dot>
      {SIGN_STATUS_LABELS_KA[status]}
    </Pill>
  );
}
