import { CmsEditorView } from '@/views/cms';

export const metadata = { title: 'გვერდის რედაქტირება' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CmsEditorView id={id} />;
}
