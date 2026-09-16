import { BusinessTypeEditorView } from '@/views/business-type-editor';

export const metadata = { title: 'ბიზნესის ტიპი' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessTypeEditorView id={id === 'new' ? undefined : id} />;
}
