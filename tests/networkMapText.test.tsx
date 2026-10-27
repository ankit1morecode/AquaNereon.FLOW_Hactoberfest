/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import L from 'leaflet';
import { NetworkMap } from '../src/components/NetworkMap';
import type { NetworkGraph, NodeSummary, SamplingMode } from '../src/types';

class ResizeObserverStub implements ResizeObserver { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = ResizeObserverStub;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const hostile = '<img src=x onerror="alert(1)"> & "asset"';
const graph: NetworkGraph = {
  vertices: [
    { id: 'SOURCE', kind: 'RESERVOIR', zone_id: 'Z', location: { lat: 54, lng: -1.01, label: hostile } },
    { id: 'A<img src=x>', kind: 'JUNCTION', zone_id: 'Z', location: { lat: 54.01, lng: -1, label: hostile, address: hostile } },
    { id: 'B', kind: 'JUNCTION', zone_id: 'Z', location: { lat: 54.02, lng: -1.02, label: 'B' } },
  ],
  edges: [{ pipe_id: hostile, from: 'SOURCE', to: 'A<img src=x>', diameter_mm: 300, length_m: 600, nominal_flow_lps: 40, nominal_pressure_kpa: 300 }],
  zones: [{ zone_id: 'Z', name: hostile, population: 1000, node_ids: ['A<img src=x>', 'B'] }],
};
function captureMap() {
  let map: L.Map | undefined;
  const realFit = L.Map.prototype.fitBounds;
  vi.spyOn(L.Map.prototype, 'fitBounds').mockImplementation(function (this: L.Map, bounds, options) {
    map = this;
    return realFit.call(this, bounds, options);
  });
  return () => { if (!map) throw new Error('Map did not initialize'); return map; };
}
function assertLiteralHtml(markup: string, expected: string) {
  const element = document.createElement('div');
  element.innerHTML = markup;
  expect(element.querySelector('img')).toBeNull();
  expect(element.textContent).toContain(expected);
  return element;
}

describe('map API text rendering', () => {
  it('preserves labels and IDs as text in source icons, zone labels, pipe tips and fallback popups', () => {
    const getMap = captureMap();
    const { container } = render(<NetworkMap network={graph} nodes={[]} />);
    expect(container.querySelector('.nm-source-name')?.textContent).toBe(hostile);
    expect(container.querySelector('.nm-zone-label')?.textContent).toBe(hostile);
    expect(container.querySelector('.nm-id')?.textContent).toBe('A<img src=x>');
    expect(container.querySelector('img[src="x"]')).toBeNull();
    let checkedPipe = false; let checkedPopup = false;
    getMap().eachLayer((layer) => {
      const tip = layer.getTooltip()?.getContent();
      if (typeof tip === 'string' && tip.includes('<br>DN')) {
        assertLiteralHtml(tip, hostile); checkedPipe = true;
      }
      const content = layer.getPopup()?.getContent();
      if (typeof content === 'function') {
        const markup = content(layer);
        if (typeof markup === 'string' && markup.includes('&lt;img')) {
          const element = assertLiteralHtml(markup, hostile);
          expect(element.querySelector('strong')?.textContent).toBe(hostile);
          checkedPopup = true;
        }
      }
    });
    expect(checkedPipe).toBe(true); expect(checkedPopup).toBe(true);
  });
  it('keeps live popup labels, address, node ID and sampling mode literal while retaining static layout markup', () => {
    const getMap = captureMap();
    const vertex = graph.vertices[1];
    const node: NodeSummary = { node_id: vertex.id, zone_id: 'Z', hardware_version: 'v1', firmware_version: 'v1', location: vertex.location,
      nominal_flow_lps: 40, upstream: [], downstream: [], commissioned_at: '', state: 'STABLE', health: 'OK', anomaly_score: 0.1,
      flow_lps: 20, sampling_mode: hostile as SamplingMode, last_seen: new Date().toISOString() };
    render(<NetworkMap network={graph} nodes={[node]} />);
    let checked = false;
    getMap().eachLayer((layer) => {
      const content = layer.getPopup()?.getContent();
      if (typeof content !== 'function') return;
      const markup = content(layer);
      if (typeof markup !== 'string' || !markup.includes('nm-pop-id')) return;
      const element = assertLiteralHtml(markup, hostile);
      expect(element.querySelector('.nm-pop-id')?.textContent).toBe(vertex.id);
      expect(element.querySelector('.nm-pop-addr')?.textContent).toBe(hostile);
      expect(element.querySelector('.nm-pop-row')).toBeTruthy();
      expect(element.textContent).toContain(hostile.toLowerCase());
      checked = true;
    });
    expect(checked).toBe(true);
  });
});
