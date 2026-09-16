'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@lokacia/ui';
import type { MapPoint } from '@lokacia/ui/map';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="h-full min-h-64 w-full rounded-card" /> });

/** Project location + unit pins. */
export function ProjectMap({ center, points, label }: { center: [number, number]; points: MapPoint[]; label: string }) {
  const router = useRouter();
  return (
    <div className="h-80 md:h-96">
      <MapView
        center={center}
        zoom={15}
        points={points}
        ariaLabel={label}
        onPointClick={(id) => {
          const p = points.find((x) => x.id === id);
          if (p?.href) router.push(p.href);
        }}
      />
    </div>
  );
}
