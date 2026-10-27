# AquaNereon.FLOW — Urban Water Intelligence Frontend

The full operator frontend for the AquaNereon.FLOW platform: five screens from
the software dossier (§27), the seven named components, a typed client covering
every REST endpoint in §23 and the MQTT topic design in §24 — and the 3D
hydraulic visualization embedded where it belongs, on the node it describes.

```bash
npm install
npm run dev        # http://localhost:5178
npm test           # physics, measurement chain, services, components and operator tools
npm run probe      # headless walk-through of the three flow scenarios
npm run build
```

It runs with no backend. A platform simulator advances twenty-one nodes in the
browser and serves them through the same `ApiClient` interface the HTTP client
implements, which is what the dossier asks for when it says simulation must use
the production ingestion and query contracts (§16, §30.2).

```bash
# Point it at a real backend instead — this is the whole switch.
VITE_API_BASE_URL=https://backend/api/v1 npm run dev
```

Copy `.env.example` to `.env.local` for basemap keys and the backend URL.

## First feature batch

This repository includes the current project and ten independently committed features:

1. **Node directory** (`/nodes`): search IDs, locations and addresses; filter by zone or state; sort by ID, anomaly or flow. Filters stay in the URL.
2. **Node watchlist**: star important junctions and filter to watched nodes. Saves in this browser, with session fallback when storage is unavailable.
3. **Node comparison** (`/compare`): choose up to three nodes from the directory or comparison selectors. Live flow, anomaly and design utilization appear side by side; the first node is the reference for differences. URLs preserve the selection.
4. **Event search and sorting**: combine search, severity, status and zone filters; order by priority, newest, oldest or anomaly. Share the URL to retain the query.
5. **Saved event views**: save, restore, update or delete named filter combinations in this browser.
6. **Event CSV export**: download exactly the filtered rows in their displayed order, with quoted cells and spreadsheet formula protection.
7. **Report date range**: inclusive local calendar dates and status filters apply to incident metrics, distributions, history, linked interventions and JSON export.
8. **Incident handoff**: export a Markdown report with source mode, selected scope, incident facts, evidence, model assessments, action recommendations and verification references.
9. **Quick navigation**: click Search or press Ctrl+K / ⌘K to find pages and nodes. Use arrow keys, Enter and Escape inside the dialog.
10. **Simulation playback**: pause, resume, select 1×–24× speed, or advance one simulated second while paused. Controls appear only in simulation mode and preserve the running model and history.

Event tools operate on the loaded subset (up to 200 events on Events and Reports). Report scope and exported handoffs disclose the loaded and available counts. Browser-saved watchlists and views are local preferences. The platform still uses the existing API contracts for live backend data.

The copied project excludes private environment files, dependencies and build output. Run `npm ci` after cloning, then `npm run dev`.

## Second feature batch

The next ten features each have their own commit:

11. **Telemetry windows and capture**: Node Diagnostics can show all loaded samples or the latest 15/60 seconds. Freeze captures the raw traces and their water-property metrics; the live signature, assessment and 3D view continue updating. Changing nodes clears the capture.
12. **Telemetry CSV**: export the displayed live or frozen samples, with source mode, capture scope, UTC and original timestamps, branch flow/pressure, water properties, all sensor channels and data-quality flags.
13. **Device health details**: reported sensor, power, communication and calibration health, telemetry age, packet loss, battery/RSSI when provided, report freshness and signature quality. Missing optional measurements remain unavailable.
14. **Zone overview** (`/zones`): search and rank zones by demand, shortage risk, inferred loss or supply margin; open their detail, nodes or events.
15. **Demand scenario planner**: adjust local supply and demand percentages against the current zone baseline. Balance and coverage use supply × (1 − inferred loss fraction), with the loss fraction held fixed. Reset restores the baseline inputs.
16. **Forecast CSV**: download the selected zone's loaded prediction, optional interval bounds and history, with source/model/horizon metadata and original plus UTC timestamps.
17. **Local incident notebook**: add, edit and delete notes scoped to an incident and node. Each incident supports up to 50 notes of 2,000 characters. Browser storage has a session fallback.
18. **Event bookmarks**: save incidents locally and show bookmarked loaded events through a URL-backed filter. Existing search, sorting and CSV export apply to that subset.
19. **Alert inbox**: review open high-priority incidents or incidents on watched nodes, switch to all open events, mark shown alerts as read, and open the incident directly. Read markers and inbox scope persist in this browser.
20. **Feed freshness and recovery**: see API refresh age, browser connection failures and cached-data status. Refresh all mounted queries manually; reconnect triggers a refresh. Queries clear the previous asset when the route changes and ignore late replies.

The notebook, bookmarks and inbox read markers are browser-local operator aids. Notes are separate from backend event records. Telemetry and forecast exports describe only the samples or horizons returned by the API. The scenario planner performs local arithmetic and sends no network commands.

## Third feature batch

21. **Comparison trends**: overlay up to three nodes' loaded signature histories by actual timestamps. Switch between baseline distance, flow and pressure; partial failures and mismatched-node data are disclosed.
22. **Named comparison sets**: save, restore, update and delete browser-local node selections while preserving the first node as the reference. Storage validation and a session fallback keep saved selections usable.
23. **Comparison snapshot CSV**: export the currently loaded comparison rows in table order, with reference differences, design utilization, source/capture metadata and original plus UTC last-seen timestamps.
24. **Incident report breakdowns**: severity and zone distributions plus local-calendar daily event counts follow the report's existing status/date filters and loaded-event scope.
25. **Previous-period comparison**: compare a selected inclusive date range with the equally long preceding calendar range, up to 366 days. Show event, high-priority, closed and verified counts with explicit zero-baseline and loaded-data limitations.
26. **Print-ready reports**: print the scoped report through the browser, with source/date/status metadata and tables that expand beyond their on-screen scroll areas. Navigation, dialogs and interactive controls stay out of the printed report.
27. **Pipe asset inventory** (`/network`): search pipe IDs, endpoint names/addresses and zones; rank by length, diameter or design flow. Cross-zone pipes match either endpoint. Asset dimensions and source details come from the loaded network graph.
28. **Structural topology tracing**: select a source or junction and trace upstream, downstream or both through the directed network graph. Cycle-safe traversals show the connected assets and pipes, with a derived map and shareable URL state.
29. **Display preferences**: choose comfortable or compact panels, higher text contrast, and system/reduced/full interface animation. Changes persist in this browser with a session fallback; 3D playback remains controlled separately.
30. **Searchable operator guide**: open Help or press `?` outside text fields to search workflows, data-scope explanations and keyboard controls, then navigate directly to the relevant screen. The 3D route retains its own help overlay.

Comparison histories and exports cover loaded data. Report comparisons use incidents' current recorded statuses; the API does not expose historical acknowledgement or closure timestamps. Topology traces describe graph connectivity and do not establish measured propagation or a field isolation plan.

---

## The one idea holding it together

**Every number on every screen is computed by the same physics the 3D view
runs.** Each simulated node drives the real velocity field, the real 16-element
sensor-ring model, the real baseline comparison and the real four-state
machine. A node's signature on City Command and the water in the Node
Diagnostics viewport are two renderings of one computation, not two mock
datasets that happen to agree.

That is why the disturbance you see in the viewport — inlet A surging, inlet B
starving, the vortex core breaking down — is the same disturbance that raised
the event, weighted the evidence, moved the loss estimate and pushed the node
into high-resolution sampling.

```
scenario dataset → junction condition → velocity field → sensor ring
   → flow signature → baseline distance → state machine
      → event + evidence → risk → recommendation → verification
```

---

## Screens

| Screen | What it answers |
| --- | --- |
| **City Command** | Network-wide supply, demand, node states, events, risk. Network schematic at the centre, because every question here is spatial |
| **Zone Intelligence** | Consumption, forecast demand, inferred losses, shortage risk, per zone |
| **Node Diagnostics** | The physical-to-AI chain for one node, laid out as that chain |
| **Events** | Prioritised events beside the full evidence that formed each one |
| **Reports** | History, interventions, forecast backtest, and verification |
| **3D Junction** | The visualization full-screen ([detail below](#the-3d-module)) |

**Node Diagnostics** is the one the dossier is pointed about: it must expose the
physical-to-AI chain rather than being "a generic dashboard full of decorative
rectangles" (§28). So it reads top to bottom as that chain — the water, then
what the ring saw, then how far that is from baseline, then what the state
machine made of it, then **why the software believes it**, then the raw traces,
then neighbours and control. The 3D viewport and the circumferential plot beside
it are the same computation twice, not an illustration next to a number.

The "why this state" panel is shown for every node, not only ones that have
raised an event. A node reading STABLE is also an assessment, and being able to
see the evidence behind "nothing is wrong" is what makes the badge trustworthy
the rest of the time. It is computed by the same function the event engine uses
(`services/assessment.ts`), so the panel cannot disagree with the event it would
produce — two implementations would drift, and the screen would end up
explaining a conclusion the engine never reached.

**Events** never shows a conclusion without its basis. Each event carries the
nine things §16 requires — what changed, where, when, how far from baseline,
how fast, whether it persisted, what the neighbours did, which models agreed,
and how good the data was — and each evidence item shows its weight, so a
conclusion resting on one strong signal looks different from one resting on six
weak ones.

---

## Components

The seven from §27, plus the primitives they share.

| Component | Notes |
| --- | --- |
| `NetworkMap` | Leaflet, with the hydraulic graph drawn over real ground. Pipe flow animates at a rate set by actual throughput, so a starved branch visibly slows |
| `NodeStatus` | State, health, recent deviation, and whether the software has already raised its own sampling |
| `FlowSignatureChart` | Baseline distance against the thresholds it is classified on, so the badge is checkable rather than declarative |
| `CircumferentialProfile` | The 16 channels against baseline — the fingerprint, shown raw rather than reduced to a score (§2) |
| `ForecastChart` | Prediction interval drawn, not optional, plus the backtest error. A bare forecast line invites being read as fact |
| `EventTimeline` | Severity first, recency second: the worst thing happening now, not the newest |
| `EvidencePanel` | The nine questions, answered from the event's own evidence |
| `AssessmentPanel` | The same, for a node's *live* state — including one reading STABLE |
| `JunctionPreview` | Bridges a node's telemetry into the 3D module's data seam. Lazily loaded |

**Charts are hand-drawn SVG.** The dossier proposes Plotly or ECharts; both are
excellent and both are around half a megabyte, and neither matches the
instrument styling without a page of theme overrides. What the screens need is
four shapes — a line, a band, a bar row, a sparkline — so they are drawn
directly. That is the point to bring a real charting library in behind the same
component surface if brushing, zooming and export are ever needed.

---

## The network

Twenty-one diagnostic junctions across five zones, fed from three sources, on
a Leaflet map (dossier §18). Pipes are drawn between the junctions they
connect, so the graph the digital twin reasons over is visible on top of the
streets it runs under, and upstream/downstream means something you can point
at.

| Zone | Junctions | Served |
| --- | --- | --- |
| Northgate | 4 | 62,000 |
| Millfield | 4 | 51,000 |
| Central Basin | 5 | 93,000 |
| Dockside | 4 | 58,000 |
| Southbank | 4 | 67,400 |

The map is driven imperatively rather than through React components. Node
states update several times a second across twenty-odd markers and their
pipes; restyling existing Leaflet layers is far cheaper than reconciling a
component tree at that rate, and it stops the map flickering as data arrives.

> **The layout is illustrative.** It is a plausible distribution network drawn
> over real ground, not a survey of anyone's actual water infrastructure. The
> map says so on its face, and it should keep saying so.

### Tracing an event

Selecting an event on the Events screen draws two things the dossier asks for
and that text alone cannot convey:

- **The propagation path** (§12.1) — the chain of disturbed feeders the event
  came down, in amber, with the furthest one marked as the origin. Where two
  feeders are both disturbed the more anomalous is followed, because that is
  the likelier origin and a branching highlight would be unreadable. An event
  that says `PROPAGATED` without showing the path is asking to be taken on
  trust.
- **The candidate leak region** (§18) — the run *downstream* of the node, in
  red. A ring reports what passes it, not what leaks after it, so a one-sided
  pattern implicates the stretch between the node and whatever it feeds. That
  is a region, not a point, and saying so is more honest than dropping a pin.

Both are pure functions in `services/propagation.ts`, so they are tested
directly rather than only through a rendered map.

### Basemap

Three sources, in order of preference:

1. `VITE_TILE_URL` — any provider, used verbatim.
2. `VITE_CARTO_KEY` — CARTO raster basemaps, which suit a dark instrument UI.
3. Neither — plain OpenStreetMap tiles, darkened in CSS. Keyless, so a fresh
   clone shows a working map with no setup at all.

If the chosen provider starts failing — expired key, revoked domain, blocked
CDN — the layer falls back to OSM rather than leaving a dark rectangle where
the city should be. If even that is unreachable the vectors still draw, and
the map says the basemap is missing instead of looking broken.

Copy `.env.example` to `.env.local` to configure it. **A browser map key is not
a secret:** Vite inlines every `VITE_*` variable into the client bundle, so
whoever loads the page can read it. That is normal for this class of
credential — the protection is a domain restriction in the provider's
dashboard, not concealment. `.env.local` is gitignored so the key stays out of
the repository, which is a different concern and also worth doing.

---

## Services

```
services/
├── client.ts             the ApiClient interface — every endpoint in §23
├── httpClient.ts         the real backend
├── simulatedClient.ts    the in-browser platform, same interface
├── platformSimulator.ts  twenty-one nodes, events, forecasts, risk
├── nodeSimulator.ts      one node, running the real physics
├── mqtt.ts               §24 topics, QoS, retain, and a local device bus
└── ApiProvider.tsx       picks one client; useQuery reads from it
```

`ApiClient` is the seam. `SimulatedApiClient` and `HttpApiClient` implement it
identically, and a test asserts the surfaces match structurally rather than
trusting that someone ran the type checker before shipping.

Two things the live path handles that are easy to skip:

- **A stale feed reports zero flow, not the last good frame.** A frozen frame
  looks exactly like a healthy node reporting a steady condition.
- **The websocket reconnects underneath a source whose identity never changes**,
  so a backend restart does not remount the visualization and discard its
  baseline and history.

### MQTT

The frontend does not speak MQTT — the broker is the device plane and a browser
has no business on it. `services/mqtt.ts` exists so the topic strings, payload
shapes, QoS and retain flags live in one place shared by the edge, the backend
relay and the simulator, rather than being retyped as string literals in three
codebases.

| Topic | QoS | Retain | Why |
| --- | --- | --- | --- |
| `aquanereon/{node_id}/telemetry` | 0 | no | High rate, individually expendable |
| `aquanereon/{node_id}/signature` | 1 | no | Losing one loses a window of analysis |
| `aquanereon/{node_id}/health` | 1 | **yes** | Last-known state is worth keeping |
| `aquanereon/{node_id}/event` | **2** | no | Must not be lost, must not become two alerts |
| `aquanereon/{node_id}/command` | **2** | no | Same, in the other direction |
| `aquanereon/{node_id}/ack` | 1 | no | Correlated to a command that is still open |

---

## Design

One dark instrument palette across the platform. The 3D view has to be dark —
water read as illuminated tracers needs a black ground — so the rest matches it
rather than making an operator's eyes re-adapt on every navigation.

The four state colours are the backbone. They mean exactly one thing each and
are never used decoratively:

| | |
| --- | --- |
| **Stable** `#4fe0a0` | Behaviour matches baseline |
| **Drift** `#ffd166` | Small or developing deviation |
| **Pre-disturbance** `#ff9a4d` | Clear abnormal behaviour forming |
| **Disturbance** `#ff5f7a` | Strong deviation present |

Severity reuses the same ramp, because an event's severity is downstream of the
state that produced it and should not look unrelated. Everything is built from
one `Panel` primitive, so adding a screen does not mean inventing a container.
Monospace wherever numbers are compared column to column.

Two facts stay visible from every screen: the worst node state anywhere on the
network, and whether the data is real or simulated. The second because a
demonstration that does not say it is a demonstration is the easiest way to
lose an audience's trust later.

---

## The 3D module

`src/viz/` is self-contained and unchanged by the platform around it. Two
inlet streams interact inside a transparent chamber, the interaction produces a
swirling flow field, a circumferential ring reads that field around the outlet,
and the pattern it reads is the flow fingerprint.

| On screen | What it represents |
| --- | --- |
| Cyan / amber streaks | Water from inlet A / inlet B |
| Streak **length** | Local speed — distance covered in a fixed shutter time |
| Bright filament | The vortex core line, where it sits and how it precesses |
| Red spindle | Recirculation: the core has broken down and the water is moving backwards |
| Ring of 16 lit pods | Each pod shows its own channel reading |

Four camera presets on keys **1–4**; the **Sensor ring** one is a bore-scope
looking back up the outlet, and it is the only angle from which the
circumferential pattern reads as a *pattern* rather than a brightness gradient.
Scrubbable timeline, 0.25×–2× playback, a 30-second fingerprint waterfall, and
full keyboard control. Press **?** in the view for the legend and key map.

### How the vortex is produced

The two inlet ports sit off-axis in both y and z, point-symmetric about the
outlet axis, each carrying a tangential component. That makes the chamber a
swirl generator. Everything downstream follows from momentum bookkeeping:

| Quantity | Comes from |
| --- | --- |
| Swirl number `S = L / (R · M)` | Angular vs axial momentum flux. Geometric, so it barely moves — correct for a fixed chamber |
| Core displacement | The **transverse** momentum flux the branches fail to cancel. Zero when balanced |
| Momentum lean | The same imbalance tilting the whole bore. The larger effect at the ring |
| Axial core deficit | Rises with swirl and restriction. Above 1.0 a recirculation bubble opens |

So an unbalanced junction does not play a drift animation — it has a sideways
momentum surplus, which puts the core off-centre, which the ring reads as a
mode-1 asymmetry. Continuity holds to ~2% across the outlet, measured by
quadrature in the tests.

> **Scope.** The velocity field is phenomenological, built from named fluid
> mechanics terms. Every term corresponds to a real mechanism and the picture
> responds to an inlet change the way the hardware would, but it does not solve
> Navier-Stokes and must not be presented as if it does.

---

## Tests

`npm test` — the physics and service suites run in Node with no DOM
and no WebGL, because that layer is pure TypeScript; the component suite opts
into jsdom with a `@vitest-environment` docblock so the fast majority stays
fast.

The component tests are deliberately targeted rather than snapshot coverage.
Each exists because of a specific way this interface can mislead or break: a
badge that resizes when the state changes, a chart that throws on a flat
series, a canvas component in an environment with no 2D context, a boundary
that does not catch. Snapshots would pass through every one of those.

| File | Covers |
| --- | --- |
| `flowField.test.ts` | Continuity by quadrature, boundedness, wall confinement, solenoidal turbulence, core reversal |
| `fieldParams.test.ts` | Momentum bookkeeping: swirl is geometric, imbalance displaces the core |
| `sensorRing.test.ts` | Even ring when balanced, mode-1 dominance, broadband transition, baseline, hysteresis |
| `scenarios.test.ts` | Each dataset end-to-end; the three separate in order |
| `dataSources.test.ts` | Stale feeds, malformed frames, socket reconnect, recording round trip |
| `simulation.test.ts` | Tracer containment, engine seek, history and temporal features |
| `services.test.ts` | MQTT topics and QoS, device bus retain semantics, demand scale, event evidence completeness, client interchangeability, command acknowledgement |
| `assessment.test.ts` | Evidence completeness and weight clamping, leak-suspicion conditions, propagation paths (including cycles and branching), suspect regions, geo helpers |
| `components.test.tsx` | Badge width independence, reserved layout slots, charts on degenerate data, canvas components without a 2D context, event ordering, the page error boundary |

Several caught real bugs while being written — the axial velocity on the core
never actually reversed, freshly spawned tracers reported no velocity, and the
tracer depth used for size attenuation was measured in clip space rather than
view space.

---

## Layout

```
src/
├── app/AppShell.tsx       navigation and the always-visible status
├── pages/                 CityCommand, ZoneIntelligence, NodeDiagnostics, Events, Reports
├── components/            the seven from §27, plus charts/ and ui/ primitives
├── services/              API clients, platform simulator, MQTT contract, topology
├── types/api.ts           wire types, snake_case, matching §23
├── styles/                tokens, app, viz
└── viz/                   the 3D module — core/ has no Three.js import anywhere
```

**Performance.** The 3D renderer is code-split: the platform shell is 106 kB
gzipped, and the 1 MB renderer chunk downloads only when a 3D view is opened.
Tracer advection runs about 6.5 ms per frame at 18k particles; the budget is
chosen from `hardwareConcurrency` and adjustable live.

**If WebGL fails** — remote desktop, blocklisted driver, or simply too many
live contexts — the module detects it before mounting, catches anything that
throws after, and recovers from a lost context by remounting with a bounded
number of retries before explaining what happened. The failure mode is never a
blank white rectangle.

**If a page throws** — a null where a number was expected, a shape the frontend
has not been taught yet — the failure is contained to that page. The navigation
stays usable, the message says what went wrong, and the boundary is keyed on
the route so navigating away clears it. For an operations tool a white screen
is the worst outcome available: indistinguishable from the platform being down,
at exactly the moment someone needs to know whether it is.

---

## Props

```tsx
<JunctionFlow3D
  source={...}          // FlowDataSource; omit to replay the bundled scenarios
  particleCount={12000}
  chrome={false}        // hide the module's overlay panels when embedding
  keyboard={false}      // release the window key bindings
  onRecording={(rec) => ...}
/>
```
