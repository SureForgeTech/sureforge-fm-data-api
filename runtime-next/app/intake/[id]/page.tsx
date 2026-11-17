import { standardFieldsCss } from '@fmweb/shared';
import { notFound } from 'next/navigation';
import { eventRegistrationExample } from '../../../lib/registration-example';
import { IntakeForm } from './intake-form';

export default async function IntakePage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const example = eventRegistrationExample();
  if (id !== example.definition.id) notFound();
  return <main style={{ maxWidth: 688, margin: '0 auto', padding: 24, boxSizing: 'border-box', width: '100%' }}>
    <style>{standardFieldsCss()}</style>
    <IntakeForm definition={example.definition} layout={example.layout} />
  </main>;
}
