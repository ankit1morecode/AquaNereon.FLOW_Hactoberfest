/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EventTimeline } from '../src/components/EventTimeline';
import type { WaterEvent } from '../src/types';

afterEach(cleanup);

it('keeps caller ordering when an event sort was selected', () => {
  const events = [
    { event_id: 'low-first', event_type: 'FLOW_ANOMALY', node_id: 'NODE-FIRST', timestamp: '2026-10-26T10:00:00Z', severity: 'LOW', status: 'OPEN' },
    { event_id: 'high-second', event_type: 'FLOW_ANOMALY', node_id: 'NODE-SECOND', timestamp: '2026-10-27T10:00:00Z', severity: 'CRITICAL', status: 'OPEN' },
  ].map((event) => ({ ...event, state_transition: { from: 'DRIFT', to: 'DISTURBANCE' }, network_context: { propagation: 'LOCAL' } })) as WaterEvent[];
  const { rerender } = render(<EventTimeline events={events} preserveOrder />);
  expect(screen.getAllByRole('button')[0].textContent).toContain('NODE-FIRST');
  rerender(<EventTimeline events={events} />);
  expect(screen.getAllByRole('button')[0].textContent).toContain('NODE-SECOND');
});
