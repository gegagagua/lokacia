export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<{ id: string }>;
}
export const SMS = Symbol('SMS');
