import { randomBytes } from 'node:crypto';

export interface ESignProvider {
  readonly name: string;
  send(doc: { id: string; title: string; signerName: string; signerPhone?: string | null }): Promise<{ ref: string; signUrl: string }>;
  status(ref: string): Promise<'sent' | 'signed' | 'declined'>;
}
export const ESIGN = Symbol('ESIGN');

/** Mock e-sign: returns a portal link; signing happens on /sign/:ref page which calls the API. */
export class MockESign implements ESignProvider {
  readonly name = 'mock';
  private readonly statuses = new Map<string, 'sent' | 'signed' | 'declined'>();
  constructor(private readonly appUrl: string) {}
  async send(_doc: { id: string }) {
    // envelope ids must not be derivable from the document id (they end up in public links)
    const ref = `mock-${randomBytes(32).toString('base64url')}`;
    this.statuses.set(ref, 'sent');
    return { ref, signUrl: `${this.appUrl}/sign/${ref}` };
  }
  async status(ref: string) {
    return this.statuses.get(ref) ?? 'sent';
  }
}
