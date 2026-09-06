<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "mapbox-gl/dist/mapbox-gl.css";
  import "$lib/styles/components/Card.css";
  import mapboxgl from "mapbox-gl";
  import AnimatedPopup from "mapbox-gl-animated-popup";
  import { XMLParser } from "fast-xml-parser";
  import { env } from "$env/dynamic/public";
  import { mapStore, DATA_SOURCES } from "$lib/stores/mapStore.svelte";
  import { MapLayerService } from "$lib/services/mapLayerService";
  import { createGempaPopupHTML } from "$lib/utils/mapUtils";
  import Modal from "$lib/components/Modal.svelte";
  import RangeSlider from "$lib/components/RangeSlider.svelte";
  import Icon from "@iconify/svelte";
  import { fdsnFetch } from "$lib/utils/fdsnFetch";

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map;
  const mapLayerService = new MapLayerService();
  const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  // center of Indonesia — fallback only, akan di-override oleh bbox dari mapStore
  let lng = 118.0;
  let lat = -2.5;

  let loadingScreen = $state(true);
  let loadingError = $state<string | null>(null);
  let eventCount = $state(0);

  // Desktop menu
  let showDesktopMenu = $state(false);

  // Modals
  let showFilterModal = $state(false);
  let showSourceModal = $state(false);

  // Parsed features stored for client-side re-filtering
  let allFeatures: any[] = [];

  // Filter state
  let filters = $state({
    magMin: 0,
    magMax: 10,
    depthMin: 0,
    depthMax: 1000,
    timeMinHours: 0,
    timeMaxHours: 168, // 7 days
  });

  function formatHours(h: number) {
    const days = Math.floor(h / 24);
    const hours = h % 24;
    let res = "";
    if (days > 0) res += `${days}d `;
    if (hours > 0 || days === 0) res += `${hours}h`;
    return res.trim();
  }

  function resetFilters() {
    filters.magMin = 0;
    filters.magMax = 10;
    filters.depthMin = 0;
    filters.depthMax = 1000;
    filters.timeMinHours = 0;
    filters.timeMaxHours = 168;
  }

  $effect(() => {
    // Reactively re-filter whenever any filter value changes
    if (allFeatures.length && map && map.getSource("earthquakes")) {
      applyFilter();
    }
  });

  function applyFilter() {
    if (!allFeatures.length || !map?.getSource("earthquakes")) return;

    const filtered = allFeatures.filter((f: any) => {
      const { mag, depth, time } = f.properties;
      const magOk = mag >= filters.magMin && mag <= filters.magMax;
      const depthOk = depth >= filters.depthMin && depth <= filters.depthMax;
      let timeOk = true;
      if (time) {
        const diffHours = (Date.now() - new Date(time).getTime()) / 3_600_000;
        timeOk = diffHours >= filters.timeMinHours && diffHours <= filters.timeMaxHours;
      }
      return magOk && depthOk && timeOk;
    });

    eventCount = filtered.length;
    (map.getSource("earthquakes") as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: filtered,
    });
  }

  /**
   * Build FDSN URL with format=xml (QuakeML).
   * minmagnitude/maxmagnitude/mindepth/maxdepth are sent to the server
   * to reduce payload; time filtering is done client-side after parse.
   */
  function buildFdsnUrl(): string {
    const base = mapStore.dataSource.baseUrl;
    const endtime = new Date().toISOString();
    const starttime = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString(); // always fetch max 7 days

    const [minLng, minLat, maxLng, maxLat] = mapStore.bbox;
    const params = new URLSearchParams({
      format: "xml",
      starttime,
      endtime,
      minlatitude: String(minLat),
      maxlatitude: String(maxLat),
      minlongitude: String(minLng),
      maxlongitude: String(maxLng),
      minmagnitude: String(filters.magMin),
      maxmagnitude: String(filters.magMax),
      mindepth: String(filters.depthMin),
      maxdepth: String(filters.depthMax),
      orderby: "time",
      limit: "2000",
    });

    return `${base}/fdsnws/event/1/query?${params.toString()}`;
  }

  /**
   * Parse QuakeML XML into GeoJSON-like features.
   *
   * QuakeML path: q:quakeml > eventParameters > event[]
   * Each event has:
   *   - origin (or array of origins — pick the preferred one via preferredOriginID)
   *   - magnitude (or array — pick preferredMagnitudeID)
   *   - description[].text  (region name, type="region name")
   */
  function parseQuakeML(xmlText: string): any[] {
    const doc = xmlParser.parse(xmlText);

    // Root may be "q:quakeml" or "quakeml" depending on namespace handling
    const root = doc["q:quakeml"] ?? doc["quakeml"] ?? doc;
    const eventParameters =
      root["eventParameters"] ?? root["q:eventParameters"] ?? root;

    let events: any[] = eventParameters["event"] ?? [];
    if (!Array.isArray(events)) events = [events];

    const features: any[] = [];

    for (const ev of events) {
      if (!ev) continue;

      // ── Resolve preferred origin ──────────────────────────────────────
      let origins: any[] = ev["origin"] ?? [];
      if (!Array.isArray(origins)) origins = [origins];

      const prefOriginId: string = ev["preferredOriginID"] ?? "";
      let origin =
        origins.find((o: any) => o?.["@_publicID"] === prefOriginId) ??
        origins[0];
      if (!origin) continue;

      const lat = parseFloat(origin?.latitude?.value ?? origin?.latitude ?? 0);
      const lng = parseFloat(origin?.longitude?.value ?? origin?.longitude ?? 0);
      const depthM = parseFloat(origin?.depth?.value ?? origin?.depth ?? 0);
      const depthKm = depthM > 1000 ? depthM / 1000 : depthM; // QuakeML depth is in metres
      const time: string = origin?.time?.value ?? origin?.time ?? "";

      // ── Resolve preferred magnitude ───────────────────────────────────
      let magnitudes: any[] = ev["magnitude"] ?? [];
      if (!Array.isArray(magnitudes)) magnitudes = [magnitudes];

      const prefMagId: string = ev["preferredMagnitudeID"] ?? "";
      const magnitude =
        magnitudes.find((m: any) => m?.["@_publicID"] === prefMagId) ??
        magnitudes[0];
      const mag = parseFloat(magnitude?.mag?.value ?? magnitude?.mag ?? 0);

      // ── Region / place ────────────────────────────────────────────────
      let descriptions: any[] = ev["description"] ?? [];
      if (!Array.isArray(descriptions)) descriptions = [descriptions];
      const regionDesc = descriptions.find(
        (d: any) => d?.type === "region name" || d?.type === "Flinn-Engdahl region",
      );
      const place: string =
        regionDesc?.text ??
        descriptions[0]?.text ??
        origin?.region ??
        "";

      // ── Event ID ──────────────────────────────────────────────────────
      const id: string =
        ev?.["@_publicID"]?.split("/").pop() ??
        ev?.["@_publicID"] ??
        `ev-${features.length}`;

      if (isNaN(lat) || isNaN(lng)) continue;

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat, depthKm] },
        properties: { id, mag, depth: depthKm, time, place },
      });
    }

    return features;
  }

  async function loadEarthquakeData() {
    loadingError = null;
    loadingScreen = true;
    try {
      const url = buildFdsnUrl();
      const res = await fdsnFetch(url, "/api/fdsn/event");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const xmlText = await res.text();

      const features = parseQuakeML(xmlText);
      allFeatures = features;
      eventCount = features.length;
      addEarthquakeLayer(features);
    } catch (err: any) {
      console.error("Failed to load FDSN XML data:", err);
      loadingError = `Failed to load data from ${mapStore.dataSource.name}: ${err.message}`;
    } finally {
      loadingScreen = false;
    }
  }

  function addEarthquakeLayer(features: any[]) {
    // Remove existing layers/sources if reloading
    if (map.getLayer("earthquakes-layer")) map.removeLayer("earthquakes-layer");
    if (map.getSource("earthquakes")) map.removeSource("earthquakes");

    const geoJson = { type: "FeatureCollection" as const, features };
    map.addSource("earthquakes", { type: "geojson", data: geoJson });
    map.addLayer({
      id: "earthquakes-layer",
      type: "circle",
      source: "earthquakes",
      paint: {
        "circle-radius": ["to-number", ["get", "mag"]],
        "circle-stroke-width": 2,
        "circle-color": [
          "case",
          ["<=", ["to-number", ["get", "depth"]], 50], "red",
          ["<=", ["to-number", ["get", "depth"]], 100], "orange",
          ["<=", ["to-number", ["get", "depth"]], 250], "yellow",
          ["<=", ["to-number", ["get", "depth"]], 600], "green",
          "blue",
        ],
        "circle-stroke-color": "white",
      },
      layout: { visibility: "visible" },
    });

    map.on("click", "earthquakes-layer", (e: any) => {
      if (!e.features?.length) return;
      const coords = e.features[0].geometry.coordinates.slice();
      const d = e.features[0].properties;
      const placeholder = document.createElement("div");
      placeholder.innerHTML = createGempaPopupHTML({
        id: d.id ?? "",
        mag: d.mag,
        depth: String(d.depth),
        time: d.time ? new Date(d.time).toLocaleString() : "-",
        lat: coords[1],
        lng: coords[0],
        place: d.place ?? "-",
      });
      new AnimatedPopup({
        openingAnimation: { duration: 100, easing: "easeOutSine", transform: "scale" },
        closingAnimation: { duration: 100, easing: "easeInOutSine", transform: "scale" },
      })
        .setDOMContent(placeholder)
        .setLngLat(coords)
        .addTo(map);
    });

    map.on("mouseenter", "earthquakes-layer", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "earthquakes-layer", () => {
      map.getCanvas().style.cursor = "";
    });

    applyFilter();
  }

  function reloadData() {
    loadingScreen = true;
    loadEarthquakeData();
  }

  mapboxgl.accessToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

  let timezoneInterval: any = null;

  onMount(() => {
    map = new mapboxgl.Map({
      container: mapContainer,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 4,
      maxZoom: 22,
    });

    // Fit ke bbox yang disimpan dari status-map (kalau ada),
    // jika belum pernah di-set pakai default center Indonesia
    const [minLng, minLat, maxLng, maxLat] = mapStore.bbox;
    const hasCustomBbox =
      minLng !== 95 || minLat !== -11 || maxLng !== 141 || maxLat !== 6;

    if (hasCustomBbox) {
      map.fitBounds(mapStore.bbox as [number, number, number, number], {
        padding: 60,
        animate: false,
      });
    }

    map.on("load", () => {
      mapLayerService.addFaultLinesLayer(map);
      timezoneInterval = mapLayerService.addTimezoneLayer(map, mapboxgl);
      loadEarthquakeData();
    });
  });

  onDestroy(() => {
    if (timezoneInterval) clearInterval(timezoneInterval);
  });
</script>

<div class="min-h-screen bg-black font-mono relative overflow-hidden">
  <div bind:this={mapContainer} class="w-full h-screen"></div>

  <!-- DESKTOP MENU -->
  <div
    class="hidden md:flex no-snapshot fixed left-0 right-0 top-0 m-auto flex-col items-center z-5 pointer-events-none"
    style="width:fit-content"
  >
    <!-- Slide-down buttons -->
    <div
      class="flex flex-row gap-2 pointer-events-auto transition-all duration-300 ease-in-out overflow-hidden {showDesktopMenu
        ? 'max-h-24 opacity-100 pt-2'
        : 'max-h-0 opacity-0'}"
    >
      <a class="ews-btn ews-btn-primary" href="/">HOME</a>
      <button
        class="ews-btn ews-btn-primary"
        onclick={() => (showFilterModal = true)}>FILTER</button
      >
      <button
        class="ews-btn ews-btn-primary"
        onclick={() => (showSourceModal = true)}>SOURCE</button
      >
      <a class="ews-btn ews-btn-primary" href="/status-ui">STATION</a>
    </div>

    <!-- MENU / X toggle -->
    <button
      class="ews-btn ews-btn-primary pointer-events-auto mt-1 transition-all duration-300 min-w-[80px]"
      onclick={() => (showDesktopMenu = !showDesktopMenu)}
    >
      {#if showDesktopMenu}
        ✕ CLOSE
      {:else}
        ☰ MENU
      {/if}
    </button>
  </div>

  <!-- MOBILE MENU -->
  <div
    class="flex flex-col md:hidden justify-center fixed z-5 items-end left-auto right-0 top-0 bottom-0 m-auto"
  >
    <a class="ews-btn-primary p-1" href="/">
      <Icon icon="ic:baseline-home" width="20" height="20" />
    </a>
    <button
      class="ews-btn-primary p-1"
      onclick={() => (showFilterModal = true)}
    >
      <Icon icon="icon-park-solid:filter" width="20" height="20" />
    </button>
    <button
      class="ews-btn-primary p-1"
      onclick={() => (showSourceModal = true)}
    >
      <Icon icon="ic:baseline-source" width="20" height="20" />
    </button>
    <a class="ews-btn-primary p-1" href="/status-ui">
      <Icon icon="zondicons:station" width="20" height="20" />
    </a>
  </div>

  <!-- FILTER MODAL -->
  <Modal bind:show={showFilterModal} title="EVENT FILTER" variant="medium">
    <div class="flex flex-col gap-6 p-4 text-sm bg-[#050505]">
      <!-- Magnitude -->
      <div class="flex flex-col gap-2">
        <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
          <span>Magnitude</span>
          <span style="color:var(--red)">{filters.magMin.toFixed(1)} - {filters.magMax.toFixed(1)} M</span>
        </label>
        <RangeSlider min={0} max={10} step={0.1} bind:low={filters.magMin} bind:high={filters.magMax} />
      </div>

      <!-- Depth -->
      <div class="flex flex-col gap-2">
        <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
          <span>Depth</span>
          <span style="color:var(--red)">{filters.depthMin} - {filters.depthMax} KM</span>
        </label>
        <RangeSlider min={0} max={1000} step={10} bind:low={filters.depthMin} bind:high={filters.depthMax} />
      </div>

      <!-- Time -->
      <div class="flex flex-col gap-2">
        <label class="font-bold flex justify-between uppercase" style="color:var(--orange)">
          <span>Time Offset (Last 7 Days)</span>
          <span style="color:var(--red)">{formatHours(filters.timeMinHours)} - {formatHours(filters.timeMaxHours)} ago</span>
        </label>
        <RangeSlider min={0} max={168} step={1} bind:low={filters.timeMinHours} bind:high={filters.timeMaxHours} />
      </div>

      <div class="flex justify-between mt-4 pt-3" style="border-top: 1px solid rgba(var(--danger-glow-rgb), 0.3)">
        <button class="ews-btn ews-btn-danger" onclick={resetFilters}>RESET FILTER</button>
        <button class="ews-btn ews-btn-primary" onclick={() => { showFilterModal = false; reloadData(); }}>
          APPLY & RELOAD
        </button>
      </div>
    </div>
  </Modal>

  <!-- SOURCE MODAL -->
  <Modal bind:show={showSourceModal} title="DATA SOURCE" variant="large">
    <div class="flex flex-col gap-4 p-4">
      <p class="font-bold uppercase text-xs" style="color:var(--orange)">FDSN DATA SOURCE</p>
      <div class="grid grid-cols-3 gap-2">
        {#each DATA_SOURCES as ds}
          <label
            class="flex flex-col items-center justify-center py-2 px-2 text-center cursor-pointer transition-all duration-150 select-none relative min-h-[52px] {mapStore.dataSourceId === ds.id
              ? 'bg-[#00FF80] text-black font-extrabold shadow-[0_0_10px_rgba(0,255,128,0.4)]'
              : 'bg-[#E60003] text-white font-bold hover:brightness-110'}"
          >
            <input
              type="radio"
              name="dataSource"
              value={ds.id}
              bind:group={mapStore.dataSourceId}
              class="sr-only"
            />
            <span class="text-xs sm:text-sm font-black uppercase tracking-wide leading-tight truncate max-w-full">
              {ds.name}
            </span>
            <span
              class="text-[10px] mt-0.5 opacity-85 truncate max-w-full font-mono"
            >
              {ds.baseUrl}
            </span>
          </label>
        {/each}
      </div>

      <p class="text-xs text-gray-500 uppercase leading-relaxed">
        Data is fetched directly from the selected FDSN provider at<br />
        <span class="text-orange-500">{mapStore.dataSource.baseUrl}/fdsnws/event/1/query</span>
      </p>
    </div>

    {#snippet footer()}
      <div class="flex justify-end gap-2">
        <button class="ews-btn ews-btn-primary" onclick={() => { showSourceModal = false; reloadData(); }}>
          SAVE & RELOAD
        </button>
      </div>
    {/snippet}
  </Modal>

  <!-- LOADING SCREEN -->
  {#if loadingScreen}
    <div
      class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-10 -red"
      id="loading-screen"
    >
      <span class="loader"></span>
      <p class="my-2 red-color p-2">LOADING FDSN EVENT DATA — {mapStore.dataSource.name}</p>
    </div>
  {/if}

  <!-- ERROR NOTICE -->
  {#if loadingError && !loadingScreen}
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-sm w-full px-4">
      <div class="ews-card ews-card-red p-3 text-xs text-red-400 text-center">
        <p class="font-bold mb-1">⚠ DATA LOAD ERROR</p>
        <p>{loadingError}</p>
        <button class="ews-btn ews-btn-danger mt-2 w-full" onclick={reloadData}>RETRY</button>
      </div>
    </div>
  {/if}

  <!-- DEPTH LEGEND -->
  {#if !loadingScreen}
    <div
      class="fixed bottom-4 left-3 z-5 no-snapshot pointer-events-none"
      style="font-size:9px"
    >
      <div class="ews-card p-2 flex flex-col gap-1 opacity-80">
        <p class="font-bold uppercase mb-1" style="color:var(--orange)">DEPTH LEGEND</p>
        {#each [
          { color: "red",    label: "≤ 50 km" },
          { color: "orange", label: "51 – 100 km" },
          { color: "yellow", label: "101 – 250 km" },
          { color: "green",  label: "251 – 600 km" },
          { color: "blue",   label: "> 600 km" },
        ] as item}
          <div class="flex items-center gap-2">
            <span
              class="inline-block w-3 h-3 rounded-full border border-white"
              style="background:{item.color}"
            ></span>
            <span>{item.label}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- SOURCE LABEL -->
  <div
    class="fixed bottom-1 m-auto right-0 left-0 flex justify-center items-center gap-2 pointer-events-none opacity-50 hover:opacity-100 transition-opacity"
    style="font-size:10px; width:fit-content"
  >
    <span class="font-bold" style="color:var(--orange)">FDSN:</span>
    <span>{mapStore.dataSource.name}</span>
    <span class="text-gray-500">{mapStore.dataSource.baseUrl}</span>
    {#if eventCount > 0}
      <span style="color:var(--orange)">· {eventCount} events</span>
    {/if}
  </div>
</div>
