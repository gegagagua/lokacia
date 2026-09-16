import { OrgDetailView } from '@/views/org-detail';

export const metadata = { title: 'ორგანიზაცია' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgDetailView id={id} />;
}
