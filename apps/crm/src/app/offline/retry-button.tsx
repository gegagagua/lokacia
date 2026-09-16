'use client';
import { Button } from '@lokacia/ui';

export function RetryButton({ label }: { label: string }) {
  return <Button onClick={() => window.location.reload()}>{label}</Button>;
}
