import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResultView } from './result-view';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'გადახდის შედეგი', robots: { index: false, follow: false } };

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ invoice?: string; status?: string; return?: string }> }) {
  const sp = await searchParams;
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(`/checkout/result?invoice=${sp.invoice ?? ''}${sp.status ? `&status=${sp.status}` : ''}`)}`);
  const back = sp.return && sp.return.startsWith('/') && !sp.return.startsWith('//') ? sp.return : null;
  return (
    <div className="drawing-grid min-h-[60dvh] py-12">
      <div className="container-page flex justify-center">
        <ResultView invoiceId={sp.invoice ?? null} failedHint={sp.status === 'failed'} back={back} />
      </div>
    </div>
  );
}
