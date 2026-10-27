import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FlowState, NetworkGraph, NodeId, NodeSummary, WaterEvent } from '../../types';
import { MAP_VIEW, zoneHull } from '../../services/topology';
import { propagationPath, suspectRegion } from '../../services/propagation';
import { STATE_LABEL } from '../ui';

/**
 * The hydraulic network on a map.
 *
 * Geographic rather than schematic, because the questions asked of this view
 * are ultimately about ground: which part of the city, what is upstream of it,
 * and where do we send someone. Pipes are drawn between the junctions they
 * connect, so the graph structure the digital twin reasons over (dossier §12)
 * is visible on top of the streets it runs under.
 *
 * Driven imperatively rather than through React. Node states update several
 * times a second and there are twenty-odd markers plus their pipes; restyling
 * existing Leaflet layers is far cheaper than reconciling a component tree at
 * that rate, and it keeps the map from flickering as data arrives.
 *
 * Scope note: the layout is illustrative. It is a plausible distribution
 * network drawn over real ground, not a survey of anyone's actual water
 * infrastructure, and the map says so.
 */

const STATE_COLOR: Record<FlowState, string> = {
  STABLE: '#4fe0a0',
  DRIFT: '#ffd166',
  PRE_DISTURBANCE: '#ff9a4d',
  DISTURBANCE: '#ff5f7a',
};

/** Leaflet interprets string content as HTML; keep API text literal inside our markup. */
function htmlText(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/**
 * Basemap.
 *
 * Three sources, in order of preference:
 *
 *   1. VITE_TILE_URL — any provider you want, used verbatim.
 *   2. VITE_CARTO_KEY — CARTO's raster basemaps, which look right for a dark
 *      instrument UI without needing a filter.
 *   3. Neither — plain OpenStreetMap tiles, darkened in CSS. Keyless, so the
 *      map works for anyone who clones this with no setup at all.
 *
 * The key is read from the environment rather than written here because this
 * repository is public. It is worth being clear that this does not make it
 * secret: Vite inlines every VITE_* variable into the client bundle, so a
 * browser map key is always readable by whoever loads the page. That is normal
 * for this class of credential — the protection is a domain restriction in the
 * provider's dashboard, not concealment.
 *
 * If the chosen provider starts failing — an expired key, a revoked domain,
 * a network with the CDN blocked — the layer falls back to OSM rather than
 * leaving a dark rectangle where the city should be.
 */
const CUSTOM_TILE_URL = import.meta.env.VITE_TILE_URL as string | undefined;
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY as string | undefined;
const CARTO_STYLE = (import.meta.env.VITE_CARTO_STYLE as string | undefined) ?? 'dark_all';

interface TileSource {
  url: string;
  attribution: string;
  /** Light tiles that need inverting to sit under a dark interface. */
  darken: boolean;
}

const OSM_SOURCE: TileSource = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  darken: true,
};

function primarySource(): TileSource {
  if (CUSTOM_TILE_URL) {
    return {
      url: CUSTOM_TILE_URL,
      attribution: (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) ?? '',
      darken: false,
    };
  }
  if (CARTO_KEY) {
    return {
      url: `https://basemaps.cartocdn.com/rastertiles/${CARTO_STYLE}/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      // CARTO's dark styles are already dark; inverting them would undo that.
      darken: CARTO_STYLE.startsWith('voyager') || CARTO_STYLE.startsWith('positron'),
    };
  }
  return OSM_SOURCE;
}

const PRIMARY_SOURCE = primarySource();

export interface NetworkMapProps {
  network: NetworkGraph;
  nodes: NodeSummary[];
  events?: WaterEvent[];
  selected?: NodeId | null;
  onSelect?: (nodeId: NodeId) => void;
  /** Dim everything outside this zone and fit the view to it. */
  focusZone?: string | null;
  /**
   * Pixels, or any CSS length. Pass "100%" to fill a panel that is itself
   * sized by the grid — a map is a better use of spare height than a gap.
   */
  height?: number | string;
  /**
   * Trace one event on the map: the chain of disturbed feeders it came down,
   * and the stretch of pipe a suspected loss would be in. An event that says
   * "PROPAGATED" without showing the path is asking to be taken on trust.
   */
  focusEvent?: WaterEvent | null;
  /** Centre on the focused event rather than fitting the whole zone. */
  followEvent?: boolean;
}

interface NodeLayers {
  dot: L.CircleMarker;
  halo: L.CircleMarker;
  alert: L.CircleMarker;
}

export function NetworkMap({
  network,
  nodes,
  events = [],
  selected = null,
  onSelect,
  focusZone = null,
  height = 420,
  focusEvent = null,
  followEvent = false,
}: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const nodeLayersRef = useRef(new Map<NodeId, NodeLayers>());
  const pipeLayersRef = useRef(new Map<string, { casing: L.Polyline; flow: L.Polyline }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const highlightRef = useRef<L.Layer[]>([]);
  /** The view we want when nobody has panned or zoomed away from it. */
  const fitBoundsRef = useRef<L.LatLngBounds | null>(null);
  const fitZoomRef = useRef(13);
  /** What that view was framing, so a real change is told from a re-render. */
  const fitSignatureRef = useRef<string | null>(null);
  const userMovedRef = useRef(false);
  const programmaticRef = useRef(false);

  const [tilesFailed, setTilesFailed] = useState(false);
  /**
   * Whether the operator has moved away from the framing we chose. The map no
   * longer re-frames itself behind their back, so it owes them a way back —
   * a view with no way home is its own kind of trap.
   */
  const [moved, setMoved] = useState(false);
  const [darken, setDarken] = useState(PRIMARY_SOURCE.darken);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);
  const vertexById = useMemo(
    () => new Map(network.vertices.map((v) => [v.id, v])),
    [network],
  );
  const openByNode = useMemo(() => {
    const map = new Map<NodeId, number>();
    for (const e of events) {
      if (e.status === 'CLOSED') continue;
      map.set(e.node_id, (map.get(e.node_id) ?? 0) + 1);
    }
    return map;
  }, [events]);

  /**
   * Stable identities for everything that is not restyling.
   *
   * Telemetry refreshes several times a second, and each refresh hands this
   * component a brand-new `nodes` array and a brand-new event object. Keying
   * off those identities is right for repainting a marker and wrong for
   * anything that moves the camera or rebuilds a layer: re-fitting the view
   * four times a second makes the map impossible to pan, because every drag
   * is undone before the next frame. That reads as the map shaking.
   *
   * So the camera and the overlay key off what they actually depend on — node
   * *states*, and which event is selected — neither of which changes at that
   * rate. Positions and pipe geometry never change at all.
   */
  const stateKey = useMemo(
    () => nodes.map((n) => `${n.node_id}:${n.state}`).join(','),
    [nodes],
  );
  // Structurally current for every field the path walk reads. Anomaly scores
  // may lag a tick, which at most decides which of two equally disturbed
  // feeders is followed — not something worth re-deriving at 4 Hz.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const graphNodes = useMemo(() => nodes, [stateKey]);

  const focusNodeId = focusEvent?.node_id ?? null;
  const focusHasOrigin = Boolean(focusEvent?.suspected_origin);

  /** Live data for popups, which are built once and read when opened. */
  const liveRef = useRef({ byId, vertexById });
  liveRef.current = { byId, vertexById };

  /**
   * Restyle only what changed.
   *
   * `setStyle` writes half a dozen SVG attributes whether or not any of them
   * differ from what is already there, and every write invalidates style for
   * that element. Across a hundred paths at four refreshes a second that is
   * thousands of pointless attribute writes — enough to keep the overlay pane
   * permanently re-rasterising. Most refreshes change nothing visible, so
   * compare first and usually do nothing at all.
   */
  const appliedStyles = useRef(new WeakMap<L.Path, string>());
  const restyle = useCallback((layer: L.Path, style: L.PathOptions) => {
    const key = JSON.stringify(style);
    if (appliedStyles.current.get(layer) === key) return;
    appliedStyles.current.set(layer, key);
    layer.setStyle(style);
  }, []);

  /* ---- build the map once ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: MAP_VIEW.center,
      zoom: MAP_VIEW.zoom,
      minZoom: MAP_VIEW.minZoom,
      maxZoom: MAP_VIEW.maxZoom,
      zoomControl: true,
      attributionControl: true,
      // The map lives inside a scrolling page; grabbing the wheel as someone
      // scrolls past it is the single most irritating thing an embedded map
      // can do. Ctrl+wheel still zooms, and so do the buttons.
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    let usingFallback = false;

    const addTiles = (source: TileSource) => {
      const layer = L.tileLayer(source.url, {
        attribution: source.attribution,
        maxZoom: MAP_VIEW.maxZoom,
      });

      let errors = 0;
      layer.on('tileerror', () => {
        errors += 1;
        if (errors <= 3) return;
        if (!usingFallback && source !== OSM_SOURCE) {
          // The chosen provider is not answering. Swap to the keyless one
          // rather than leaving the city blank.
          usingFallback = true;
          layer.remove();
          setDarken(OSM_SOURCE.darken);
          addTiles(OSM_SOURCE);
          return;
        }
        // Even the fallback is unreachable. Vectors still draw, so this
        // degrades to a dark plan rather than an empty panel — say which.
        setTilesFailed(true);
      });
      layer.on('tileload', () => setTilesFailed(false));
      layer.addTo(map);
    };

    addTiles(PRIMARY_SOURCE);

    // Distinguish our own fitBounds from someone dragging the map, so a
    // container resize does not yank the view back from wherever they went.
    map.on('movestart', () => {
      if (programmaticRef.current) return;
      userMovedRef.current = true;
      setMoved(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      nodeLayersRef.current.clear();
      pipeLayersRef.current.clear();
    };
  }, []);

  /* ---- zones, pipes and markers ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layers: L.Layer[] = [];

    // --- zone areas ---
    for (const zone of network.zones) {
      const members = network.vertices.filter((v) => v.zone_id === zone.zone_id);
      const hull = zoneHull(members.map((m) => m.location));
      if (hull.length < 3) continue;

      const polygon = L.polygon(hull, {
        className: 'nm-zone',
        interactive: false,
      }).addTo(map);
      polygon.bindTooltip(htmlText(zone.name), {
        permanent: true,
        direction: 'center',
        className: 'nm-zone-label',
      });
      layers.push(polygon);
    }

    // --- pipes ---
    for (const edge of network.edges) {
      const from = vertexById.get(edge.from);
      const to = vertexById.get(edge.to);
      if (!from || !to) continue;

      const path: [number, number][] = [
        [from.location.lat, from.location.lng],
        [to.location.lat, to.location.lng],
      ];

      const casing = L.polyline(path, {
        className: 'nm-pipe',
        weight: 2 + (edge.diameter_mm / 260) * 4,
        interactive: false,
      }).addTo(map);

      const flow = L.polyline(path, {
        className: 'nm-flow',
        weight: 2,
        interactive: false,
      }).addTo(map);

      flow.bindTooltip(
        `${htmlText(edge.pipe_id)}<br>DN${htmlText(edge.diameter_mm)} · ${(edge.length_m / 1000).toFixed(2)} km`,
        { className: 'nm-tip', sticky: true },
      );

      pipeLayersRef.current.set(edge.pipe_id, { casing, flow });
      layers.push(casing, flow);
    }

    // --- sources ---
    for (const vertex of network.vertices) {
      if (vertex.kind === 'JUNCTION') continue;
      const marker = L.marker([vertex.location.lat, vertex.location.lng], {
        icon: L.divIcon({
          className: 'nm-source-icon',
          html: `<span class="nm-source-mark"></span><span class="nm-source-name">${htmlText(vertex.location.label)}</span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      layers.push(marker);
    }

    // --- junctions ---
    for (const vertex of network.vertices) {
      if (vertex.kind !== 'JUNCTION') continue;
      const pos: [number, number] = [vertex.location.lat, vertex.location.lng];

      // Drawn back to front: the alert pulse, then the selection halo, then
      // the node itself, so the node is always the thing you click.
      const alert = L.circleMarker(pos, {
        radius: 13,
        className: 'nm-alert',
        interactive: false,
      }).addTo(map);
      alert.setStyle({ opacity: 0, fillOpacity: 0 });

      const halo = L.circleMarker(pos, {
        radius: 12,
        className: 'nm-halo',
        interactive: false,
      }).addTo(map);
      halo.setStyle({ opacity: 0, fillOpacity: 0 });

      const dot = L.circleMarker(pos, {
        radius: 7,
        className: 'nm-dot',
        weight: 2,
      }).addTo(map);

      dot.on('click', () => onSelectRef.current?.(vertex.id));

      // Bound once, with a function evaluated when it opens. Re-binding on
      // every refresh unbinds first, which closes the popup a moment after
      // anyone opens it.
      dot.bindPopup(
        () => {
          const { byId: summaries, vertexById: vertices } = liveRef.current;
          const summary = summaries.get(vertex.id);
          const v = vertices.get(vertex.id);
          if (!summary) return `<strong>${htmlText(vertex.location.label)}</strong>`;
          return (
            `<strong>${htmlText(v?.location.label ?? vertex.id)}</strong>` +
            `<span class="nm-pop-id">${htmlText(vertex.id)}</span>` +
            `<span class="nm-pop-row">${STATE_LABEL[summary.state]} · ${summary.flow_lps.toFixed(1)} L/s</span>` +
            `<span class="nm-pop-row">anomaly ${summary.anomaly_score.toFixed(2)} · ${htmlText(summary.sampling_mode.toLowerCase())}</span>` +
            (v?.location.address ? `<span class="nm-pop-addr">${htmlText(v.location.address)}</span>` : '')
          );
        },
        { className: 'nm-popup', closeButton: false },
      );

      dot.bindTooltip(htmlText(vertex.id.replace('AN-J-', 'J')), {
        permanent: true,
        direction: 'top',
        offset: [0, -9],
        className: 'nm-id',
      });

      nodeLayersRef.current.set(vertex.id, { dot, halo, alert });
      layers.push(alert, halo, dot);
    }

    return () => {
      for (const layer of layers) layer.remove();
      nodeLayersRef.current.clear();
      pipeLayersRef.current.clear();
    };
  }, [network, vertexById]);

  /* ---- live styling: state colour, alerts, selection, focus ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [nodeId, { dot, halo, alert }] of nodeLayersRef.current) {
      const summary = byId.get(nodeId);
      const vertex = vertexById.get(nodeId);
      const dimmed = focusZone !== null && vertex?.zone_id !== focusZone;
      const colour = summary ? STATE_COLOR[summary.state] : '#56697a';
      const offline = summary?.health === 'OFFLINE';

      restyle(dot, {
        color: offline ? '#ff5f7a' : colour,
        fillColor: offline ? '#0a141d' : colour,
        fillOpacity: dimmed ? 0.25 : 1,
        opacity: dimmed ? 0.3 : 1,
        dashArray: offline ? '3 3' : undefined,
      });

      const isSelected = selected === nodeId;
      restyle(halo, {
        color: '#d6e9f5',
        opacity: isSelected && !dimmed ? 0.85 : 0,
        fillOpacity: 0,
      });

      const alerts = openByNode.get(nodeId) ?? 0;
      restyle(alert, {
        color: colour,
        opacity: alerts > 0 && !dimmed ? 0.6 : 0,
        fillOpacity: 0,
      });

      // The pulse is a CSS animation on the rendered path; toggling the class
      // is cheaper and smoother than animating the radius from JS.
      const el = (alert as unknown as { _path?: SVGElement })._path;
      if (el) el.classList.toggle('pulsing', alerts > 0 && !dimmed);
    }

    // Pipe animation speed follows the throughput of the node it feeds, so a
    // starved branch visibly slows instead of merely being labelled.
    for (const edge of network.edges) {
      const layer = pipeLayersRef.current.get(edge.pipe_id);
      if (!layer) continue;
      const downstream = byId.get(edge.to);
      const load = downstream ? downstream.flow_lps / Math.max(edge.nominal_flow_lps, 1) : 0.6;
      // Quantised, and written only when the step changes. Flow varies
      // continuously, and re-assigning animation-duration re-maps the elapsed
      // time onto the new period — so writing it on every refresh makes the
      // dashes stutter instead of run.
      const period = (Math.round(Math.max(0.7, 4.5 - load * 3.2) * 10) / 10).toFixed(1);

      const toVertex = vertexById.get(edge.to);
      const dimmed = focusZone !== null && toVertex?.zone_id !== focusZone;

      const el = (layer.flow as unknown as { _path?: SVGElement })._path;
      if (el && el.dataset.period !== period) {
        el.style.animationDuration = `${period}s`;
        el.dataset.period = period;
      }
      restyle(layer.flow, { opacity: dimmed ? 0.12 : 0.75 });
      restyle(layer.casing, { opacity: dimmed ? 0.12 : 1 });
    }
  }, [byId, openByNode, selected, focusZone, vertexById, network, restyle]);

  /* ---- trace the focused event: propagation path and suspect region ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of highlightRef.current) layer.remove();
    highlightRef.current = [];
    if (!focusNodeId) return;

    const added: L.Layer[] = [];

    // --- the run a suspected loss would be in ---
    // Drawn first so the propagation path sits on top of it where they meet.
    if (focusHasOrigin) {
      const region = suspectRegion(network, focusNodeId);
      for (const pipeId of region.pipes) {
        const edge = network.edges.find((e) => e.pipe_id === pipeId);
        const from = edge && vertexById.get(edge.from);
        const to = edge && vertexById.get(edge.to);
        if (!from || !to) continue;
        const band = L.polyline(
          [
            [from.location.lat, from.location.lng],
            [to.location.lat, to.location.lng],
          ],
          { className: 'nm-suspect', weight: 11, interactive: false },
        ).addTo(map);
        added.push(band);
      }
    }

    // --- the chain of disturbed feeders it came down ---
    const trace = propagationPath(network, graphNodes, focusNodeId);
    for (const pipeId of trace.pipes) {
      const edge = network.edges.find((e) => e.pipe_id === pipeId);
      const from = edge && vertexById.get(edge.from);
      const to = edge && vertexById.get(edge.to);
      if (!from || !to) continue;
      const line = L.polyline(
        [
          [from.location.lat, from.location.lng],
          [to.location.lat, to.location.lng],
        ],
        { className: 'nm-propagation', weight: 4, interactive: false },
      ).addTo(map);
      added.push(line);
    }

    // --- the origin of the chain, where there is one ---
    if (!trace.local) {
      const origin = vertexById.get(trace.path[0]);
      if (origin) {
        const marker = L.circleMarker([origin.location.lat, origin.location.lng], {
          radius: 15,
          className: 'nm-origin',
          interactive: false,
        }).addTo(map);
        marker.bindTooltip('origin', {
          permanent: true,
          direction: 'bottom',
          offset: [0, 10],
          className: 'nm-origin-label',
        });
        added.push(marker);
      }
    }

    highlightRef.current = added;
    return () => {
      for (const layer of added) layer.remove();
    };
    // Not `focusEvent` or `nodes`: both are fresh objects on every refresh,
    // and rebuilding these layers at that rate restarts the dash animation on
    // the propagation path several times a second.
  }, [focusNodeId, focusHasOrigin, network, graphNodes, vertexById]);

  /* ---- fit the view to whatever is in focus ---- */

  // The one place that moves the camera, so the `movestart` listener above can
  // always tell our own framing from someone dragging the map. The resize is
  // inside the flag too: invalidateSize pans to hold the centre, and that
  // counts as a move unless we say otherwise — which used to mark the map as
  // user-moved on the first resize and quietly stop it re-fitting for good.
  const applyFit = useCallback((bounds: L.LatLngBounds, maxZoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    programmaticRef.current = true;
    // The container may not have had its final size when the map was created,
    // and fitting against a zero-height box silently produces the wrong view.
    map.invalidateSize({ animate: false });
    map.fitBounds(bounds, { padding: [48, 48], maxZoom, animate: false });
    programmaticRef.current = false;
    userMovedRef.current = false;
    setMoved(false);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Following an event means framing the whole path it came down, not just
    // the node it surfaced at — the origin is the part worth seeing.
    const ids =
      followEvent && focusNodeId
        ? new Set(propagationPath(network, graphNodes, focusNodeId).path)
        : null;

    const members = network.vertices.filter((v) =>
      ids ? ids.has(v.id) : focusZone === null || v.zone_id === focusZone,
    );
    if (members.length === 0) return;

    // Move the camera only when what it frames has actually changed. A re-run
    // that would land on the same view must do nothing at all: fitting again
    // is not a no-op once the operator has panned — it throws their view away
    // and snaps back.
    const signature = `${focusZone ?? ''}|${members.map((m) => m.id).join(',')}`;
    if (signature === fitSignatureRef.current) return;
    fitSignatureRef.current = signature;

    const bounds = L.latLngBounds(members.map((m) => [m.location.lat, m.location.lng]));
    fitBoundsRef.current = bounds;
    fitZoomRef.current = ids || focusZone ? 14 : 13;
    // A new thing to frame outranks wherever the operator had panned to: they
    // asked for this zone, or this event.
    applyFit(bounds, fitZoomRef.current);
  }, [focusZone, network, followEvent, focusNodeId, graphNodes, applyFit]);

  /* ---- Leaflet needs telling when its container resizes ---- */
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    let lastW = 0;
    let lastH = 0;
    let frame = 0;

    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) return;
      // Sub-pixel reflow fires this constantly, and responding to it has
      // Leaflet resizing itself in a loop the browser reports as undelivered
      // notifications. Only a whole-pixel change is a real resize.
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;

      // Coalesce to one frame: several panels can settle in the same tick.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = fitBoundsRef.current;
        if (!bounds || userMovedRef.current) {
          // Still tell Leaflet its size, or half the viewport stays grey.
          programmaticRef.current = true;
          map.invalidateSize({ animate: false });
          programmaticRef.current = false;
          return;
        }
        applyFit(bounds, fitZoomRef.current);
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [applyFit]);

  return (
    <div className="network-map" style={{ height }}>
      <div
        ref={containerRef}
        className={darken ? 'nm-canvas nm-darken-tiles' : 'nm-canvas'}
      />

      {tilesFailed && (
        <div className="nm-tile-note">
          Basemap unavailable — showing the network without it.
        </div>
      )}

      {moved && (
        <button
          type="button"
          className="nm-refit"
          onClick={() => {
            const bounds = fitBoundsRef.current;
            if (bounds) applyFit(bounds, fitZoomRef.current);
          }}
        >
          Reset view
        </button>
      )}

      <ul className="nm-legend">
        {(['STABLE', 'DRIFT', 'PRE_DISTURBANCE', 'DISTURBANCE'] as FlowState[]).map((s) => (
          <li key={s}>
            <i style={{ background: STATE_COLOR[s] }} />
            {STATE_LABEL[s]}
          </li>
        ))}
      </ul>

      <p className="nm-disclaimer">Illustrative network layout, not survey data.</p>
    </div>
  );
}
