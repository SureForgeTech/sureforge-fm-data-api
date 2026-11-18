import Link from 'next/link';
import type { JSX } from 'react';

export default function HomePage(): JSX.Element {
  return (
    <main className="runtime-home">
      <h1>FM Web Runtime Template</h1>
      <p>Open a generated layout page to preview runtime rendering.</p>
      <p><Link href="/intake/event-registration">Try the event registration sample</Link></p>
      <p><Link href="/intake/feedback-request">Try the feedback or request sample</Link></p>
      <p><Link href="/layouts/example">Open Example Layout</Link></p>
    </main>
  );
}
