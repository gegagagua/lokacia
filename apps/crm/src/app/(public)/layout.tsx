/** Public tokenized pages (client portal, presentations, e-sign) — no CRM shell, no login. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-h-dvh bg-bg">
      {children}
    </main>
  );
}
