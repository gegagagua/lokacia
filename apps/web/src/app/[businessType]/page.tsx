import { notFound } from 'next/navigation';
import { getLanding } from '@/components/portal/data';
import { LandingView } from '@/components/portal/landing/landing-view';
import { landingMetadata } from '@/components/portal/landing/landing-meta';

type Props = { params: Promise<{ businessType: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { businessType } = await params;
  return landingMetadata(await getLanding(businessType), `/${businessType}`);
}

/** SEO landing for a business type, e.g. /cafe. Unknown slugs 404. */
export default async function BusinessTypeLanding({ params }: Props) {
  const { businessType } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(businessType)) notFound();
  const data = await getLanding(businessType);
  if (!data?.businessType) notFound();
  return <LandingView data={data} path={`/${businessType}`} />;
}
