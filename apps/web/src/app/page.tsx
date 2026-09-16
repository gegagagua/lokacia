import Link from 'next/link';
import { Button, SpacePlan } from '@lokacia/ui';

export default function HomePage() {
  return (
    <section className="drawing-grid border-b border-border">
      <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="text-h1 font-semibold md:text-display">იმუშავებს თუ არა ჩემი ბიზნესი აქ?</h1>
          <p className="mt-4 max-w-lg text-[18px] text-muted">კომერციული ფართები ბიზნესის თვალით: ტექნიკური პასპორტი, ლოკაციის ანალიტიკა და ყველა განცხადება — დადასტურებული.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/search">ფართის ძებნა</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/account/listings/new">ფართის გამოქვეყნება</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-card border border-border bg-surface p-6">
          <SpacePlan areaM2={64} widthM={8} depthM={8} ceilingM={3.4} powerKw={25} />
        </div>
      </div>
    </section>
  );
}
