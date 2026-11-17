import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntakePage from '../app/intake/[id]/page';
import { IntakeForm } from '../app/intake/[id]/intake-form';
import { previewIntakes } from './intake-registry';
import { eventRegistrationExample } from './registration-example';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));
beforeEach(() => { vi.spyOn(previewIntakes, 'load').mockResolvedValue(eventRegistrationExample()); });
afterEach(() => { vi.restoreAllMocks();vi.unstubAllEnvs(); });

describe('registration page mode is chosen server-side', () => {
  it.each([['filemaker', 'filemaker'], ['sample', 'sample'], ['', 'sample']])('passes only the chosen mode (%s)', async (configured, expected) => {
    vi.stubEnv('FMWEB_REGISTRATION_MODE', configured);vi.stubEnv('FMWEB_BRIDGE_TOKEN', 'server-private-token-canary');
    const page = await IntakePage({ params: Promise.resolve({ id: 'event-registration' }) });
    const form = React.Children.toArray((page as React.ReactElement<{ children: React.ReactNode }>).props.children)
      .find((child) => React.isValidElement(child) && child.type === IntakeForm) as React.ReactElement<{ mode: string }>;
    expect(form.props.mode).toBe(expected);expect(JSON.stringify(page)).not.toContain('server-private-token-canary');
  });
  it('does not render a missing saved form', async () => {
    vi.mocked(previewIntakes.load).mockResolvedValueOnce(undefined);
    await expect(IntakePage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('not found');
  });
});
