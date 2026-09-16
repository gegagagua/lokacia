import { CmsEditorView } from '@/views/cms';

export const metadata = { title: 'ახალი გვერდი' };
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return <CmsEditorView kind={kind === 'static' ? 'static' : 'permits'} />;
}
