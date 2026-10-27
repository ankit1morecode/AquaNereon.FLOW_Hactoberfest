import { useCallback, useSyncExternalStore } from 'react';
import { usePlatform } from '../services/ApiProvider';
import type { PlatformSimulator } from '../services/platformSimulator';
import './simulation-controls.css';

function PlaybackControls({ platform }: { platform: PlatformSimulator }) {
  const subscribe = useCallback((listener: () => void) => platform.subscribe(listener), [platform]);
  const snapshot = useCallback(() => `${platform.running}:${platform.playbackSpeed}`, [platform]);
  useSyncExternalStore(subscribe, snapshot);
  const running = platform.running;

  return <div className="simulation-controls" role="group" aria-label="Simulation playback">
    <span className="simulation-clock" role="status">Demo {running ? 'running' : 'paused'}</span>
    <button type="button" className="btn" onClick={() => running ? platform.stop() : platform.start()}>
      {running ? 'Pause simulation' : 'Resume simulation'}
    </button>
    <button type="button" className="btn" disabled={running} onClick={() => platform.stepOnce()}
      title="Advance one simulated second while paused">Step +1s</button>
    <label>Speed <select aria-label="Simulation speed" value={platform.playbackSpeed}
      onChange={(event) => platform.setPlaybackSpeed(Number(event.target.value))}>
      {[1, 3, 6, 12, 24].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
    </select></label>
  </div>;
}

/** Real backend sessions never expose local simulation controls. */
export function SimulationControls() {
  const platform = usePlatform();
  return platform ? <PlaybackControls platform={platform} /> : null;
}
