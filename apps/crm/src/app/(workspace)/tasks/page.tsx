import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TasksScreen } from '@/components/tasks/tasks-screen';

export const metadata: Metadata = { title: 'დავალებები' };

export default function TasksPage() {
  return (
    <Suspense>
      <TasksScreen />
    </Suspense>
  );
}
