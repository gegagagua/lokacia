import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CalendarScreen } from '@/components/calendar/calendar-screen';

export const metadata: Metadata = { title: 'ჩვენებები' };

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
