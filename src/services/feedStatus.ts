export function describeFeed({ mode, online, updatedAt, error, now = Date.now() }: {
  mode: 'REAL' | 'SIMULATION'; online: boolean; updatedAt: number | null; error: Error | null; now?: number;
}): { label: string; detail: string; tone: 'ok' | 'warn' | 'error' | 'pending' } {
  if (mode === 'REAL' && !online) return {
    label: 'Browser offline', tone: 'error',
    detail: updatedAt === null ? 'Waiting for a network connection.' : 'Showing the last successful API data while offline.',
  };
  if (error) return { label: updatedAt === null ? 'Feed unavailable' : 'Refresh failed', tone: 'error', detail: error.message };
  if (updatedAt === null) return { label: 'Connecting to data…', tone: 'pending', detail: 'Waiting for the first successful API read.' };
  if (mode === 'SIMULATION') return { label: 'Simulation feed', tone: 'ok', detail: 'Browser simulation. Playback controls determine whether the model advances.' };
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  return {
    label: seconds < 10 ? 'Data refreshed just now' : `Data refreshed ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago`,
    tone: seconds >= 60 ? 'warn' : 'ok',
    detail: 'Time of the last successful network overview API read. Device telemetry age is shown in node health.',
  };
}
