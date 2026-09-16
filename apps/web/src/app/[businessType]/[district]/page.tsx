import { notFound } from 'next/navigation';
import { getLanding } from '@/components/portal/data';
import { LandingView } from '@/components/portal/landing/landing-view';
import { landingMetadata } from '@/components/portal/landing/landing-meta';

type Props = { params: Promise<{ businessType: string; district: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { businessType, district } = await params;
  return landingMetadata(await getLanding(businessType, district), `/${businessType}/${district}`);
}

/** SEO landing for business type × district, e.g. /cafe/vake. */
export default async function BusinessTypeDistrictLanding({ params }: Props) {
  const { businessType, district } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(businessType) || !/^[a-z0-9-]{2,60}$/.test(district)) notFound();
  const data = await getLanding(businessType, district);
  if (!data?.businessType || !data.district) notFound();
  return <LandingView data={data} path={`/${businessType}/${district}`} />;
}
