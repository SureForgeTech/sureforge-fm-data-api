import { standardFieldsCss } from '@fmweb/shared';
import { notFound } from 'next/navigation';
import { previewIntakes } from '../../../lib/intake-registry';
import { IntakeForm } from './intake-form';

export const dynamic = 'force-dynamic';

export default async function IntakePage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const example = await previewIntakes.load(id);
  if (!example) notFound();
  return <main style={{ maxWidth: 688, margin: '0 auto', padding: 24, boxSizing: 'border-box', width: '100%' }}>
    <style>{standardFieldsCss()}</style>
    <IntakeForm definition={example.definition} layout={example.layout} mode={process.env.FMWEB_REGISTRATION_MODE === 'filemaker' ? 'filemaker' : 'sample'} />
  </main>;
}
