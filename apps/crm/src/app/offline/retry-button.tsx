'use client';
import { RotateCw } from 'lucide-react';
import { Button } from '@lokacia/ui';

export function RetryButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.location.reload()} className="w-full" icon={<RotateCw className="size-4" strokeWidth={2} aria-hidden />}>
      {label}
    </Button>
  );
}
