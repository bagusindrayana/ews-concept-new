<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import {
    generateContours,
    formatCoordinateDMS,
    formatDegree,
    type ContourLine,
    type GeoBbox,
  } from "$lib/utils/contourUtils";
  import type { StationItem } from "$lib/utils/mmiParser";

  let {
    lat = -5.81,
    lng = 106.56,
    mag = 5.9,
    depth = "376 Km",
    place = "KEPSERIBU-DKI",
    stations = [],
    selectedStation = null,
    onSelectStation,
  }: {
    lat?: number;
    lng?: number;
    mag?: number;
    depth?: string;
    place?: string;
    stations?: StationItem[];
    selectedStation?: StationItem | null;
    onSelectStation?: (station: StationItem) => void;
  } = $props();

  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLDivElement;

  // Viewport / Camera State (Center & Span in degrees)
  let centerLat = $state(lat);
  let centerLng = $state(lng);
  let spanDeg = $state(2.6); // width/height degree coverage
  let minSpanDeg = 0.5;
  let maxSpanDeg = 12.0;

  // Layer Toggles
  let showLand = $state(true);
  let showSea = $state(true);
  let showGrid = $state(true);
  let showStations = $state(true);

  // Mouse Interaction State
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCenterLng = 0;
  let dragStartCenterLat = 0;
  let mouseGeoPos = $state<{ lat: number; lng: number } | null>(null);
  let hoveredStation = $state<StationItem | null>(null);

  // Data Loading & Contour State
  let isLoading = $state(false);
  let contourLines = $state<ContourLine[]>([]);
  let pulseRadius = $state(0);
  let animFrameId: number | null = null;
  let gridPointsCount = $state(0);

  // Derive Bounding Box
  let bbox = $derived<GeoBbox>({
    south: centerLat - spanDeg / 2,
    north: centerLat + spanDeg / 2,
    west: centerLng - spanDeg / 2,
    east: centerLng + spanDeg / 2,
  });

  // Keep centered when props lat/lng change
  let lastHandledLat: number | null = null;
  let lastHandledLng: number | null = null;
  let isFetching = false;

  $effect(() => {
    const currentLat = lat;
    const currentLng = lng;

    if (
      typeof currentLat === 'number' &&
      typeof currentLng === 'number' &&
      (currentLat !== lastHandledLat || currentLng !== lastHandledLng)
    ) {
      lastHandledLat = currentLat;
      lastHandledLng = currentLng;

      // Untrack mutations and fetch calls to prevent Svelte 5 reactive feedback loop
      untrack(() => {
        centerLat = currentLat;
        centerLng = currentLng;
        lastFetchedCenter = { lat: 0, lng: 0, span: 0 };
        fetchAndComputeContours();
      });
    }
  });

  // Re-fetch contours when bbox expands significantly
  let lastFetchedCenter = { lat: 0, lng: 0, span: 0 };

  async function fetchAndComputeContours() {
    if (isFetching) return;

    const curBbox: GeoBbox = {
      south: centerLat - spanDeg / 2,
      north: centerLat + spanDeg / 2,
      west: centerLng - spanDeg / 2,
      east: centerLng + spanDeg / 2,
    };
    const distanceMoved = Math.hypot(
      centerLat - lastFetchedCenter.lat,
      centerLng - lastFetchedCenter.lng,
    );
    const spanRatio = spanDeg / (lastFetchedCenter.span || 1);

    if (
      contourLines.length > 0 &&
      lastFetchedCenter.span > 0 &&
      distanceMoved < spanDeg * 0.25 &&
      spanRatio > 0.75 &&
      spanRatio < 1.3
    ) {
      // Small movement, existing contours remain valid
      return;
    }

    isFetching = true;
    isLoading = true;
    lastFetchedCenter = { lat: centerLat, lng: centerLng, span: spanDeg };

    const GRID_SIZE = 10;
    const locs: string[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const pLat =
          curBbox.south +
          (r / (GRID_SIZE - 1)) * (curBbox.north - curBbox.south);
        const pLng =
          curBbox.west + (c / (GRID_SIZE - 1)) * (curBbox.east - curBbox.west);
        locs.push(`${pLat.toFixed(5)},${pLng.toFixed(5)}`);
      }
    }

    try {
      // Query our enhanced server proxy with GEBCO 2020 (covers bathymetry + topography)
      const res = await fetch("/api/map-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bathymetry",
          dataset: "gebco2020",
          locations: locs.join("|"),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const elevations = (data.results || []).map(
          (r: any) => r.elevation ?? 0,
        );
        gridPointsCount = elevations.length;

        // Extract 2D contours
        contourLines = generateContours(
          elevations,
          GRID_SIZE,
          GRID_SIZE,
          curBbox,
        );
      }
    } catch (err) {
      console.warn("Contour fetch failed:", err);
    } finally {
      isFetching = false;
      isLoading = false;
      render();
    }
  }

  // Coordinate Conversion
  function geoToCanvas(
    gLat: number,
    gLng: number,
    width: number,
    height: number,
  ) {
    const curBbox = bbox;
    const x = ((gLng - curBbox.west) / (curBbox.east - curBbox.west)) * width;
    const y =
      ((curBbox.north - gLat) / (curBbox.north - curBbox.south)) * height;
    return { x, y };
  }

  function pointToCanvas(
    p: { x: number; y: number },
    width: number,
    height: number,
  ) {
    const curBbox = bbox;
    const x = ((p.x - curBbox.west) / (curBbox.east - curBbox.west)) * width;
    const y =
      ((curBbox.north - p.y) / (curBbox.north - curBbox.south)) * height;
    return { x, y };
  }

  function canvasToGeo(px: number, py: number, width: number, height: number) {
    const curBbox = bbox;
    const gLng = curBbox.west + (px / width) * (curBbox.east - curBbox.west);
    const gLat =
      curBbox.north - (py / height) * (curBbox.north - curBbox.south);
    return { lat: gLat, lng: gLng };
  }

  // Main Render Loop
  function render() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvasEl.width / dpr;
    const height = canvasEl.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Dark Cybernetic Sea Background
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      20,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    bgGrad.addColorStop(0, "#0a1017");
    bgGrad.addColorStop(1, "#05070a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Contours
    for (const cLine of contourLines) {
      if (cLine.type === "land" && !showLand) continue;
      if (cLine.type === "sea" && !showSea) continue;

      ctx.beginPath();
      for (const [p1, p2] of cLine.segments) {
        const sc1 = pointToCanvas(p1, width, height);
        const sc2 = pointToCanvas(p2, width, height);
        ctx.moveTo(sc1.x, sc1.y);
        ctx.lineTo(sc2.x, sc2.y);
      }

      if (cLine.type === "land") {
        // Green land contours
        const intensity = Math.min(1, Math.max(0.2, cLine.iso / 1000));
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.4 + intensity * 0.5})`;
        ctx.lineWidth = cLine.iso % 250 === 0 ? 1.6 : 1.0;
        ctx.stroke();
      } else if (cLine.type === "sea") {
        // Orange ocean depth contours
        const depthRatio = Math.min(1, Math.abs(cLine.iso) / 2000);
        ctx.strokeStyle = `rgba(249, 115, 22, ${0.35 + depthRatio * 0.55})`;
        ctx.lineWidth = Math.abs(cLine.iso) % 500 === 0 ? 1.6 : 1.0;
        ctx.stroke();
      } else {
        // Coastline (iso 0): Distinct turquoise boundary
        ctx.strokeStyle = "#2dd4bf";
        ctx.lineWidth = 2.0;
        ctx.shadowColor = "#2dd4bf";
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // 3. Render Coordinate Grid Overlay
    if (showGrid) {
      renderCoordinateGrid(ctx, width, height);
    }

    // 4. Render Epicenter Marker
    renderEpicenter(ctx, width, height);

    // 5. Render Stations
    if (showStations) {
      renderStations(ctx, width, height);
    }

    // 6. Corner Reticle Brackets (Evangelion tactical view)
    renderTacticalHUD(ctx, width, height);

    ctx.restore();
  }

  function renderCoordinateGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const curBbox = bbox;
    ctx.save();
    ctx.font = '10px "Roboto Condensed", monospace';
    ctx.fillStyle = "#94a3b8";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 0.9;

    // Grid interval dynamically scaled to zoom
    const gridStep = spanDeg > 6 ? 1.0 : spanDeg > 2 ? 0.5 : 0.2;

    const startLat = Math.ceil(curBbox.south / gridStep) * gridStep;
    const endLat = Math.floor(curBbox.north / gridStep) * gridStep;

    const startLng = Math.ceil(curBbox.west / gridStep) * gridStep;
    const endLng = Math.floor(curBbox.east / gridStep) * gridStep;

    // Parallels (Latitudes)
    for (let gLat = startLat; gLat <= endLat; gLat += gridStep) {
      const pos = geoToCanvas(gLat, centerLng, width, height);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, pos.y);
      ctx.lineTo(width, pos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label on left margin with dark backing
      const labelText = formatDegree(gLat, true);
      const textW = ctx.measureText(labelText).width;
      ctx.fillStyle = "rgba(5, 7, 10, 0.7)";
      ctx.fillRect(4, pos.y - 11, textW + 6, 12);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(labelText, 7, pos.y - 2);
    }

    // Meridians (Longitudes)
    for (let gLng = startLng; gLng <= endLng; gLng += gridStep) {
      const pos = geoToCanvas(centerLat, gLng, width, height);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pos.x, 0);
      ctx.lineTo(pos.x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label on bottom margin with dark backing
      const labelText = formatDegree(gLng, false);
      const textW = ctx.measureText(labelText).width;
      ctx.fillStyle = "rgba(5, 7, 10, 0.7)";
      ctx.fillRect(pos.x + 2, height - 16, textW + 6, 12);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(labelText, pos.x + 5, height - 7);
    }

    // Draw Crosshairs at Intersections
    for (let gLat = startLat; gLat <= endLat; gLat += gridStep) {
      for (let gLng = startLng; gLng <= endLng; gLng += gridStep) {
        const pos = geoToCanvas(gLat, gLng, width, height);
        ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pos.x - 5, pos.y);
        ctx.lineTo(pos.x + 5, pos.y);
        ctx.moveTo(pos.x, pos.y - 5);
        ctx.lineTo(pos.x, pos.y + 5);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function renderEpicenter(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const pt = geoToCanvas(lat, lng, width, height);
    if (pt.x < -100 || pt.x > width + 100 || pt.y < -100 || pt.y > height + 100)
      return;

    ctx.save();

    // Concentric expanding shockwave pulse
    const maxRadius = 48;
    const pulseProgress = (pulseRadius % 100) / 100;
    const currentRadius = 8 + pulseProgress * maxRadius;
    const pulseAlpha = Math.max(0, 1 - pulseProgress);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha * 0.9})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Epicenter core reticle
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Crosshairs through epicenter
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pt.x - 24, pt.y);
    ctx.lineTo(pt.x - 10, pt.y);
    ctx.moveTo(pt.x + 10, pt.y);
    ctx.lineTo(pt.x + 24, pt.y);
    ctx.moveTo(pt.x, pt.y - 24);
    ctx.lineTo(pt.x, pt.y - 10);
    ctx.moveTo(pt.x, pt.y + 10);
    ctx.lineTo(pt.x, pt.y + 24);
    ctx.stroke();

    // Epicenter Tactical Badge
    ctx.shadowBlur = 0;
    ctx.font = 'bold 10px "Roboto Condensed", monospace';
    const tagText = `EPICENTER M${Number(mag).toFixed(1)}`;
    const tagW = ctx.measureText(tagText).width;

    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(pt.x + 14, pt.y - 22, tagW + 12, 18);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pt.x + 14, pt.y - 22, tagW + 12, 18);

    ctx.fillStyle = "#fca5a5";
    ctx.fillText(tagText, pt.x + 20, pt.y - 9);

    ctx.restore();
  }

  function renderStations(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    ctx.save();
    ctx.font = '9px "Roboto Condensed", monospace';

    for (const sta of stations) {
      if (!sta.lat || !sta.lng) continue;
      const pt = geoToCanvas(sta.lat, sta.lng, width, height);

      // Skip offscreen stations
      if (pt.x < -20 || pt.x > width + 20 || pt.y < -20 || pt.y > height + 20)
        continue;

      const isSelected =
        selectedStation &&
        (selectedStation.stationCode === sta.stationCode ||
          selectedStation.id === sta.id);
      const isHovered =
        hoveredStation && hoveredStation.stationCode === sta.stationCode;

      if (isSelected || isHovered) {
        // Highlighting halo
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? "#ff0055" : "#38bdf8";
        ctx.lineWidth = 2;
        ctx.shadowColor = isSelected ? "#ff0055" : "#38bdf8";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Diamond shape station icon
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.PI / 4);

      ctx.fillStyle = isSelected
        ? "#ff0055"
        : isHovered
          ? "#38bdf8"
          : sta.status === "ACTIVE"
            ? "#0ea5e9"
            : "#e11d48";
      ctx.fillRect(-3, -3, 6, 6);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(-3, -3, 6, 6);
      ctx.restore();

      // Station code label
      ctx.fillStyle = isSelected
        ? "#ff80ab"
        : isHovered
          ? "#7dd3fc"
          : "#94a3b8";
      ctx.fillText(sta.stationCode, pt.x + 6, pt.y + 3);
    }

    ctx.restore();
  }

  function renderTacticalHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    ctx.save();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.5;
    const len = 12;

    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(8, 8 + len);
    ctx.lineTo(8, 8);
    ctx.lineTo(8 + len, 8);
    ctx.stroke();

    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(width - 8 - len, 8);
    ctx.lineTo(width - 8, 8);
    ctx.lineTo(width - 8, 8 + len);
    ctx.stroke();

    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(8, height - 8 - len);
    ctx.lineTo(8, height - 8);
    ctx.lineTo(8 + len, height - 8);
    ctx.stroke();

    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(width - 8 - len, height - 8);
    ctx.lineTo(width - 8, height - 8);
    ctx.lineTo(width - 8, height - 8 - len);
    ctx.stroke();

    ctx.restore();
  }

  // Animation Frame Loop
  function startAnimation() {
    function loop() {
      pulseRadius += 1.2;
      render();
      animFrameId = requestAnimationFrame(loop);
    }
    animFrameId = requestAnimationFrame(loop);
  }

  // Canvas Mouse & Interaction Handlers
  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCenterLng = centerLng;
    dragStartCenterLat = centerLat;
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    mouseGeoPos = canvasToGeo(px, py, rect.width, rect.height);

    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const dLng = -(dx / rect.width) * spanDeg;
      const dLat = (dy / rect.height) * spanDeg;

      centerLng = dragStartCenterLng + dLng;
      centerLat = dragStartCenterLat + dLat;
      render();
      return;
    }

    // Check hover near any station
    let foundStation: StationItem | null = null;
    for (const sta of stations) {
      if (!sta.lat || !sta.lng) continue;
      const pt = geoToCanvas(sta.lat, sta.lng, rect.width, rect.height);
      const dist = Math.hypot(px - pt.x, py - pt.y);
      if (dist < 12) {
        foundStation = sta;
        break;
      }
    }
    hoveredStation = foundStation;
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      fetchAndComputeContours();
    }
  }

  function handleClick(e: MouseEvent) {
    if (hoveredStation && onSelectStation) {
      onSelectStation(hoveredStation);
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
    spanDeg = Math.max(minSpanDeg, Math.min(maxSpanDeg, spanDeg * zoomFactor));
    render();
    fetchAndComputeContours();
  }

  function zoomIn() {
    spanDeg = Math.max(minSpanDeg, spanDeg * 0.75);
    render();
    fetchAndComputeContours();
  }

  function zoomOut() {
    spanDeg = Math.min(maxSpanDeg, spanDeg * 1.33);
    render();
    fetchAndComputeContours();
  }

  function resetView() {
    centerLat = lat;
    centerLng = lng;
    spanDeg = 2.6;
    render();
    fetchAndComputeContours();
  }

  // Handle Resize with guard against loop
  let lastWidth = 0;
  let lastHeight = 0;

  function handleResize() {
    if (!canvasEl) return;
    const parent = canvasEl.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (targetW <= 0 || targetH <= 0) return;
    if (targetW === lastWidth && targetH === lastHeight) return;

    lastWidth = targetW;
    lastHeight = targetH;
    canvasEl.width = targetW;
    canvasEl.height = targetH;
    render();
  }

  onMount(() => {
    handleResize();
    const parent = canvasEl?.parentElement || containerEl;
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (parent) resizeObserver.observe(parent);

    startAnimation();
    fetchAndComputeContours();

    return () => {
      resizeObserver.disconnect();
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  });
</script>

<div
  bind:this={containerEl}
  class="relative w-full h-full flex flex-col bg-[#05070a] border border-neutral-800 rounded-sm overflow-hidden select-none"
>
  <!-- Top HUD Status Header -->
  <div
    class="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-neutral-950/90 border-b border-neutral-800 text-[10px] font-mono text-neutral-300 z-10"
  >
    <div class="flex items-center gap-2"></div>

    {#if isLoading}
      <span class="text-amber-400 animate-pulse text-[10px]"
        >UPDATING GRID...</span
      >
    {:else}
      <span class="text-neutral-500">{contourLines.length} ISOLINES</span>
    {/if}
  </div>

  <!-- Interactive Canvas Container -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex-1 min-h-0 w-full h-full cursor-crosshair overflow-hidden"
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    onclick={handleClick}
    onwheel={handleWheel}
  >
    <canvas
      bind:this={canvasEl}
      class="absolute inset-0 w-full h-full block"
      style="width: 100%; height: 100%;"
    ></canvas>

    <!-- Floating Tooltip on Station Hover -->
    {#if hoveredStation}
      <div
        class="absolute top-4 left-4 z-20 px-2.5 py-1.5 bg-black/90 border border-sky-500 rounded text-white text-[11px] font-mono shadow-xl pointer-events-none backdrop-blur"
      >
        <div class="flex items-center gap-2">
          <span class="font-bold text-sky-400"
            >{hoveredStation.stationCode}</span
          >
          <span class="text-[9px] px-1 bg-sky-950 text-sky-300 rounded">
            {hoveredStation.mmi ? `MMI ${hoveredStation.mmi}` : "SENSOR"}
          </span>
        </div>
        <div class="text-neutral-300 text-[10px] truncate max-w-[200px]">
          {hoveredStation.site}
        </div>
        <div class="text-[9px] text-neutral-400 mt-0.5">
          DIST: <span class="text-neutral-200"
            >{hoveredStation.distance} km</span
          >
          | SITE:
          <span class="text-neutral-200">{hoveredStation.siteClass || "-"}</span
          >
        </div>
      </div>
    {/if}

    <!-- Quick Map Controls (Top-Right) -->
    <div
      class="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-black/80 p-1 border border-neutral-800 rounded backdrop-blur"
    >
      <button
        onclick={zoomIn}
        class="w-6 h-6 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold rounded border border-neutral-700 transition"
        title="Zoom In"
      >
        +
      </button>
      <button
        onclick={zoomOut}
        class="w-6 h-6 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold rounded border border-neutral-700 transition"
        title="Zoom Out"
      >
        -
      </button>
      <button
        onclick={resetView}
        class="w-6 h-6 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[10px] font-bold rounded border border-neutral-700 transition"
        title="Center Epicenter"
      >
        ⊙
      </button>
    </div>

    <!-- Layer Filter Toggles (Bottom-Left) -->
    <div
      class="absolute bottom-6 left-3 z-20 flex items-center gap-1.5 bg-black/85 px-2 py-1 border border-neutral-800 rounded text-[9px] font-mono backdrop-blur"
    >
      <button
        onclick={() => {
          showLand = !showLand;
          render();
        }}
        class="px-1.5 py-0.5 rounded border transition {showLand
          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
          : 'bg-neutral-900 border-neutral-700 text-neutral-500'}"
      >
        LAND
      </button>
      <button
        onclick={() => {
          showSea = !showSea;
          render();
        }}
        class="px-1.5 py-0.5 rounded border transition {showSea
          ? 'bg-orange-950/80 border-orange-500 text-orange-300'
          : 'bg-neutral-900 border-neutral-700 text-neutral-500'}"
      >
        SEA DEPTH
      </button>
      <button
        onclick={() => {
          showGrid = !showGrid;
          render();
        }}
        class="px-1.5 py-0.5 rounded border transition {showGrid
          ? 'bg-slate-900 border-slate-500 text-slate-300'
          : 'bg-neutral-900 border-neutral-700 text-neutral-500'}"
      >
        GRID
      </button>
      <button
        onclick={() => {
          showStations = !showStations;
          render();
        }}
        class="px-1.5 py-0.5 rounded border transition {showStations
          ? 'bg-sky-950/80 border-sky-500 text-sky-300'
          : 'bg-neutral-900 border-neutral-700 text-neutral-500'}"
      >
        STA
      </button>
    </div>
  </div>

  <!-- Bottom HUD Footer: Coordinate Readout & Legend -->
  <div
    class="flex items-center justify-between px-3 py-1.5 bg-neutral-950 border-t border-neutral-800 text-[10px] font-mono text-neutral-400 z-10"
  >
    <!-- Live Coordinates -->
    <div class="flex items-center gap-3">
      <div>
        POS:
        <span class="text-neutral-200">
          {mouseGeoPos
            ? `${formatCoordinateDMS(mouseGeoPos.lat, true)} ${formatCoordinateDMS(mouseGeoPos.lng, false)}`
            : `${formatCoordinateDMS(lat, true)} ${formatCoordinateDMS(lng, false)}`}
        </span>
      </div>
      <div>
        ZOOM: <span class="text-neutral-200">{(10 / spanDeg).toFixed(1)}x</span>
      </div>
    </div>

    <!-- Color Legend -->
    <div class="flex items-center gap-3 text-[9px]">
      <div class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-0.5 bg-emerald-500"></span>
        <span class="text-emerald-400">Land (&gt;0m)</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-0.5 bg-orange-500"></span>
        <span class="text-orange-400">Depth (&lt;0m)</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
        <span class="text-red-400">Epicenter</span>
      </div>
    </div>
  </div>
</div>
