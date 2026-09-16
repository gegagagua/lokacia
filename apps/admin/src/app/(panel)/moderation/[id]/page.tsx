import { ModerationDetailView } from '@/views/moderation-detail';

export const metadata = { title: 'განცხადების მოდერაცია' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModerationDetailView id={id} />;
}
