import { UserDetailView } from '@/views/user-detail';

export const metadata = { title: 'მომხმარებელი' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView id={id} />;
}
