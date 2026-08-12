'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only wrapper around dashboard-charts.tsx: recharts is a sizeable
 * dependency and its SVG measurement doesn't SSR meaningfully anyway, so
 * these are fetched as a separate chunk after the dashboard's own content is
 * already interactive instead of bloating its initial JS payload.
 */
function ChartSkeleton() {
  return <div className="h-[240px] w-full animate-pulse rounded-md bg-tenant-gray" aria-hidden />;
}

export const SourceBar = dynamic(
  () => import('./dashboard-charts').then((m) => m.SourceBar),
  { ssr: false, loading: ChartSkeleton },
);

export const PipelineBar = dynamic(
  () => import('./dashboard-charts').then((m) => m.PipelineBar),
  { ssr: false, loading: ChartSkeleton },
);

export const VolumeLine = dynamic(
  () => import('./dashboard-charts').then((m) => m.VolumeLine),
  { ssr: false, loading: ChartSkeleton },
);
