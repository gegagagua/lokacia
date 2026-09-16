import { notFound } from 'next/navigation';
import { getLanding } from '@/components/portal/data';
import { LandingView } from '@/components/portal/landing/landing-view';
import { landingMetadata } from '@/components/portal/landing/landing-meta';

type Props = { params: Promise<{ district: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { district } = await params;
  return landingMetadata(await getLanding(undefined, district), `/districts/${district}`);
}

/** SEO landing for a district, e.g. /districts/vake. */
export default async function DistrictLanding({ params }: Props) {
  const { district } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(district)) notFound();
  const data = await getLanding(undefined, district);
  if (!data?.district) notFound();
  return <LandingView data={data} path={`/districts/${district}`} />;
}
