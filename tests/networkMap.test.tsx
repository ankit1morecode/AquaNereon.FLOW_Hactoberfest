/**
 * @vitest-environment jsdom
 *
 * The map's re-render discipline.
 *
 * Telemetry refreshes several times a second, and every refresh hands this
 * component a brand-new `nodes` array and a brand-new event object. Anything
 * keyed off those identities runs at that rate — which is right for repainting
 * a marker and wrong for everything else. Re-framing the view four times a
 * second makes the map impossible to pan, because each drag is undone before
 * the next frame; rebuilding the overlay at that rate restarts the animation
 * on the propagation path. Both read as the map shaking, and neither is
 * visible in a screenshot or a snapshot.
 *
 * So the guarantees are asserted directly: a refresh that changes nothing
 * structural must not move the camera, must not replace a layer, and must not
 * write styles — while a real change to what is being framed still must.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import L from 'leaflet';

import { NetworkMap } from '../src/components/NetworkMap';
import type {
  NetworkGraph,
  NodeSummary,
  FlowState,
  WaterEvent,
} from '../src/types';

afterEach(cleanup);

/**
 * jsdom has no ResizeObserver, and the map uses one to notice its panel being
 * resized. A stub is enough: these tests drive re-renders, not layout.
 */
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

/* ------------------------------------------------------------------ */
/* Fixtures: a three-node chain, so one node is upstream of another    */
/* ------------------------------------------------------------------ */

const NETWORK: NetworkGraph = {
  vertices: [
    { id: 'AN-J-001', kind: 'JUNCTION', zone_id: 'Z-A', location: { lat: 54.98, lng: -1.62, label: 'One' } },
    { id: 'AN-J-002', kind: 'JUNCTION', zone_id: 'Z-A', location: { lat: 54.97, lng: -1.61, label: 'Two' } },
    { id: 'AN-J-003', kind: 'JUNCTION', zone_id: 'Z-B', location: { lat: 54.96, lng: -1.59, label: 'Three' } },
  ],
  edges: [
    {
      pipe_id: 'P-1',
      from: 'AN-J-001',
      to: 'AN-J-002',
      diameter_mm: 300,
      length_m: 900,
      nominal_flow_lps: 40,
      nominal_pressure_kpa: 320,
    },
    {
      pipe_id: 'P-2',
      from: 'AN-J-002',
      to: 'AN-J-003',
      diameter_mm: 250,
      length_m: 700,
      nominal_flow_lps: 30,
      nominal_pressure_kpa: 300,
    },
  ],
  zones: [
    { zone_id: 'Z-A', name: 'Zone A', population: 1000, node_ids: ['AN-J-001', 'AN-J-002'] },
    { zone_id: 'Z-B', name: 'Zone B', population: 1000, node_ids: ['AN-J-003'] },
  ],
};

function node(id: string, over: Partial<NodeSummary> = {}): NodeSummary {
  const vertex = NETWORK.vertices.find((v) => v.id === id)!;
  return {
    node_id: id,
    zone_id: vertex.zone_id,
    hardware_version: 'AN-HW-2.1',
    firmware_version: '0.9.4',
    location: vertex.location,
    nominal_flow_lps: 36,
    upstream: id === 'AN-J-002' ? ['AN-J-001'] : id === 'AN-J-003' ? ['AN-J-002'] : [],
    downstream: id === 'AN-J-001' ? ['AN-J-002'] : id === 'AN-J-002' ? ['AN-J-003'] : [],
    commissioned_at: '',
    state: 'STABLE',
    health: 'OK',
    anomaly_score: 0.04,
    flow_lps: 24,
    sampling_mode: 'NORMAL',
    last_seen: new Date().toISOString(),
    ...over,
  };
}

const BASE_NODES = [node('AN-J-001'), node('AN-J-002'), node('AN-J-003')];

/**
 * What a refresh actually looks like: new objects throughout, with the
 * continuously-varying fields moved on a little. Nothing structural changes.
 */
function refreshed(nodes: NodeSummary[], tick = 1): NodeSummary[] {
  return nodes.map((n) => ({
    ...n,
    flow_lps: n.flow_lps + tick * 0.13,
    anomaly_score: Math.min(0.99, n.anomaly_score + tick * 0.002),
    last_seen: new Date(Date.now() + tick * 250).toISOString(),
  }));
}

function event(over: Partial<WaterEvent> = {}): WaterEvent {
  return {
    event_id: 'EV-1',
    event_type: 'LEAKAGE_SUSPECTED',
    node_id: 'AN-J-002',
    zone_id: 'Z-A',
    timestamp: new Date().toISOString(),
    severity: 'HIGH',
    anomaly_score: 0.7,
    state_transition: { from: 'DRIFT', to: 'DISTURBANCE' },
    evidence: [],
    model_outputs: [],
    network_context: { upstream_states: [], downstream_states: [], propagation: 'PROPAGATED' },
    data_quality: { completeness: 1, confidence: 0.9, stale: false, suspect_channels: [] },
    status: 'OPEN',
    suspected_origin: { description: 'Between AN-J-003 and its downstream', confidence: 0.6 },
    ...over,
  };
}

/* ------------------------------------------------------------------ */

let fitBounds: MockInstance<L.Map['fitBounds']>;
let setStyle: MockInstance<L.Path['setStyle']>;
/** Captured from the first framing call; Leaflet keeps no back-pointer. */
let mapInstance: L.Map | null = null;

beforeEach(() => {
  mapInstance = null;
  const realFitBounds = L.Map.prototype.fitBounds;
  fitBounds = vi
    .spyOn(L.Map.prototype, 'fitBounds')
    .mockImplementation(function (this: L.Map, bounds, options) {
      mapInstance = this;
      return realFitBounds.call(this, bounds, options);
    });
  // Path, not CircleMarker: CircleMarker overrides setStyle and delegates to
  // this one, so spying here counts every write that reaches the DOM —
  // markers and pipes alike.
  setStyle = vi.spyOn(L.Path.prototype, 'setStyle');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkMap camera', () => {
  it('does not re-frame the view when telemetry refreshes', () => {
    // This is the pan-preservation guarantee stated as a call count. Every
    // re-fit throws away wherever the operator had panned to, so a refresh
    // that re-fits is a map that cannot be panned at all.
    const { rerender } = render(<NetworkMap network={NETWORK} nodes={BASE_NODES} />);
    const afterMount = fitBounds.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    for (let tick = 1; tick <= 8; tick++) {
      rerender(<NetworkMap network={NETWORK} nodes={refreshed(BASE_NODES, tick)} />);
    }

    expect(fitBounds.mock.calls.length).toBe(afterMount);
  });

  it('does not re-frame the view when a node changes state', () => {
    // A state change repaints a marker. It does not change which nodes are on
    // screen, so it is not a reason to move the camera.
    const { rerender } = render(<NetworkMap network={NETWORK} nodes={BASE_NODES} />);
    const afterMount = fitBounds.mock.calls.length;

    const states: FlowState[] = ['DRIFT', 'PRE_DISTURBANCE', 'DISTURBANCE'];
    for (const state of states) {
      rerender(
        <NetworkMap
          network={NETWORK}
          nodes={BASE_NODES.map((n) => (n.node_id === 'AN-J-002' ? { ...n, state } : { ...n }))}
        />,
      );
    }

    expect(fitBounds.mock.calls.length).toBe(afterMount);
  });

  it('does re-frame when the zone in focus changes', () => {
    const { rerender } = render(
      <NetworkMap network={NETWORK} nodes={BASE_NODES} focusZone="Z-A" />,
    );
    const afterMount = fitBounds.mock.calls.length;

    rerender(<NetworkMap network={NETWORK} nodes={BASE_NODES} focusZone="Z-B" />);
    expect(fitBounds.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it('does re-frame when a different event is followed', () => {
    const { rerender } = render(
      <NetworkMap
        network={NETWORK}
        nodes={BASE_NODES}
        focusEvent={event({ node_id: 'AN-J-003' })}
        followEvent
      />,
    );
    const afterMount = fitBounds.mock.calls.length;

    rerender(
      <NetworkMap
        network={NETWORK}
        nodes={BASE_NODES}
        focusEvent={event({ event_id: 'EV-2', node_id: 'AN-J-001' })}
        followEvent
      />,
    );
    expect(fitBounds.mock.calls.length).toBeGreaterThan(afterMount);
  });
});

describe('NetworkMap overlay', () => {
  it('keeps the same trace layers across a refresh', () => {
    // Removing and re-adding the polyline restarts the CSS animation that
    // makes the propagation path read as a direction of travel. At four
    // refreshes a second it never gets far enough to look like movement.
    const { container, rerender } = render(
      <NetworkMap
        network={NETWORK}
        nodes={BASE_NODES}
        focusEvent={event()}
        events={[event()]}
      />,
    );

    const first = container.querySelector('path.nm-suspect');
    expect(first).toBeTruthy();

    for (let tick = 1; tick <= 6; tick++) {
      rerender(
        <NetworkMap
          network={NETWORK}
          nodes={refreshed(BASE_NODES, tick)}
          focusEvent={{ ...event(), anomaly_score: 0.7 + tick * 0.01 }}
          events={[event()]}
        />,
      );
    }

    // The same element instance, not merely an equivalent one.
    expect(container.querySelector('path.nm-suspect')).toBe(first);
  });

  it('redraws the trace when the focused node changes', () => {
    const { container, rerender } = render(
      <NetworkMap network={NETWORK} nodes={BASE_NODES} focusEvent={event({ node_id: 'AN-J-002' })} />,
    );
    const first = container.querySelector('path.nm-suspect');
    expect(first).toBeTruthy();

    rerender(
      <NetworkMap network={NETWORK} nodes={BASE_NODES} focusEvent={event({ node_id: 'AN-J-001' })} />,
    );
    const second = container.querySelector('path.nm-suspect');

    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });
});

describe('NetworkMap restyling', () => {
  it('writes no styles when a refresh changes nothing visible', () => {
    // setStyle writes half a dozen SVG attributes whether or not any differ,
    // and each one invalidates style for that element. Across a real network
    // at 4 Hz that was thousands of pointless writes a second.
    const { rerender } = render(<NetworkMap network={NETWORK} nodes={BASE_NODES} />);
    setStyle.mockClear();

    for (let tick = 1; tick <= 6; tick++) {
      rerender(<NetworkMap network={NETWORK} nodes={refreshed(BASE_NODES, tick)} />);
    }

    expect(setStyle).not.toHaveBeenCalled();
  });

  it('still writes styles when a node changes state', () => {
    // The saving must not come at the cost of the map going stale.
    const { rerender } = render(<NetworkMap network={NETWORK} nodes={BASE_NODES} />);
    setStyle.mockClear();

    rerender(
      <NetworkMap
        network={NETWORK}
        nodes={BASE_NODES.map((n) =>
          n.node_id === 'AN-J-002' ? { ...n, state: 'DISTURBANCE' as FlowState } : n,
        )}
      />,
    );

    expect(setStyle).toHaveBeenCalled();
  });
});

describe('NetworkMap re-frame control', () => {
  it('is offered only once the operator has moved away from the framing', () => {
    const { container } = render(<NetworkMap network={NETWORK} nodes={BASE_NODES} />);
    expect(container.querySelector('.nm-refit')).toBeNull();

    // What a drag amounts to, as far as this component is concerned.
    expect(mapInstance).toBeTruthy();
    act(() => {
      mapInstance!.fire('movestart');
    });

    expect(container.querySelector('.nm-refit')).toBeTruthy();
  });
});
