'use client';
import * as React from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button, useToast, type ButtonProps } from '@lokacia/ui';

/** Copies an absolute URL (path relative to current origin) to the clipboard. */
export function CopyLinkButton({ path, label, copiedLabel, ...props }: { path: string; label: string; copiedLabel: string } & Omit<ButtonProps, 'onClick'>) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      {...props}
      icon={copied ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : <Link2 className="size-4" strokeWidth={1.5} aria-hidden />}
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt(label, url);
        }
        setCopied(true);
        toast({ title: copiedLabel, tone: 'success' });
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {label}
    </Button>
  );
}
