<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export interface MagiNodeItem {
    id: string;
    label: string;
    connected: boolean;
    bank: "diagonal" | "horizontal";
    trackIndex: number;
    // Positioning
    x: number;
    y: number;
    angle?: number;
    // Wire routing
    leadLeft?: number;
    leadRight?: number;
    diagLength?: number;
    // Metadata
    channelName?: string;
    category?: string;
    syncRate?: number;
    amberWhenDisconnected?: boolean;
  }

  let {
    nodes: propNodes,
    variant = "board",
    readonly = false,
    showControls = true,
    showTelemetry = true,
    className = "",
    onToggle,
  }: {
    nodes?: MagiNodeItem[];
    variant?: "board" | "single" | "rack";
    readonly?: boolean;
    showControls?: boolean;
    showTelemetry?: boolean;
    className?: string;
    onToggle?: (node: MagiNodeItem, isConnected: boolean) => void;
  } = $props();

  // -------------------------------------------------------------
  // Default authentic dataset replicating Image 1 and Image 2
  // -------------------------------------------------------------
  const DEFAULT_NODES: MagiNodeItem[] = [
    // --- Bank 1: Diagonal Left Bank (dual parallel lanes at -45 deg) ---
    // Lane 1 (Right Lane on track x + y = 570)
    { id: "00126", label: "00126", connected: true, bank: "diagonal", trackIndex: 0, x: 596, y: -26, angle: -45, channelName: "NERV-OPT-126", category: "Core Synapse" },
    { id: "00127", label: "00127", connected: true, bank: "diagonal", trackIndex: 1, x: 520, y: 50, angle: -45, channelName: "NERV-OPT-127", category: "Core Synapse" },
    { id: "00128", label: "00128", connected: true, bank: "diagonal", trackIndex: 2, x: 444, y: 126, angle: -45, channelName: "NERV-OPT-128", category: "Core Synapse" },
    { id: "00130", label: "00130", connected: true, bank: "diagonal", trackIndex: 4, x: 368, y: 202, angle: -45, channelName: "NERV-OPT-130", category: "Data Bus A" },
    { id: "00132", label: "00132", connected: true, bank: "diagonal", trackIndex: 6, x: 292, y: 278, angle: -45, channelName: "NERV-OPT-132", category: "Telemetry Link" },
    { id: "00134", label: "00134", connected: true, bank: "diagonal", trackIndex: 8, x: 216, y: 354, angle: -45, channelName: "NERV-OPT-134", category: "Telemetry Link" },
    { id: "00136", label: "00136", connected: true, bank: "diagonal", trackIndex: 10, x: 140, y: 430, angle: -45, channelName: "NERV-OPT-136", category: "Aux Relay" },
    { id: "00138", label: "00138", connected: true, bank: "diagonal", trackIndex: 12, x: 64, y: 506, angle: -45, channelName: "NERV-OPT-138", category: "Aux Relay" },

    // Lane 2 (Left Lane on track x + y = 505, shifted up-left, side-by-side with Lane 1)
    { id: "00129", label: "00129", connected: true, bank: "diagonal", trackIndex: 3, x: 422, y: 83, angle: -45, channelName: "NERV-OPT-129", category: "Data Bus A" },
    { id: "00131", label: "00131", connected: true, bank: "diagonal", trackIndex: 5, x: 346, y: 159, angle: -45, channelName: "NERV-OPT-131", category: "Data Bus A" },
    { id: "00133", label: "00133", connected: true, bank: "diagonal", trackIndex: 7, x: 270, y: 235, angle: -45, channelName: "NERV-OPT-133", category: "Telemetry Link" },
    { id: "00135", label: "00135", connected: true, bank: "diagonal", trackIndex: 9, x: 194, y: 311, angle: -45, channelName: "NERV-OPT-135", category: "Aux Relay" },
    { id: "00137", label: "00137", connected: true, bank: "diagonal", trackIndex: 11, x: 118, y: 387, angle: -45, channelName: "NERV-OPT-137", category: "Aux Relay" },

    // --- Bank 2: Horizontal Right Bank (horizontal nodes with 45 deg bends) ---
    { id: "00223", label: "00223", connected: true, bank: "horizontal", trackIndex: 0, x: 865, y: 50, leadLeft: 60, leadRight: 75, channelName: "SEIS-BMKG-223", category: "Primary Seismic" },
    { id: "00224", label: "00224", connected: true, bank: "horizontal", trackIndex: 1, x: 910, y: 88, leadLeft: 70, leadRight: 60, channelName: "SEIS-BMKG-224", category: "Primary Seismic" },
    { id: "00225", label: "00225", connected: true, bank: "horizontal", trackIndex: 2, x: 800, y: 126, leadLeft: 65, leadRight: 90, channelName: "SEIS-BMKG-225", category: "Primary Seismic" },
    { id: "00226", label: "00226", connected: true, bank: "horizontal", trackIndex: 3, x: 845, y: 164, leadLeft: 75, leadRight: 70, channelName: "SEIS-BMKG-226", category: "Primary Seismic" },
    { id: "00227", label: "00227", connected: true, bank: "horizontal", trackIndex: 4, x: 740, y: 202, leadLeft: 70, leadRight: 100, channelName: "SEIS-BMKG-227", category: "Subduction Array" },
    { id: "00228", label: "00228", connected: true, bank: "horizontal", trackIndex: 5, x: 785, y: 240, leadLeft: 80, leadRight: 80, channelName: "SEIS-BMKG-228", category: "Subduction Array" },
    { id: "00229", label: "00229", connected: true, bank: "horizontal", trackIndex: 6, x: 675, y: 278, leadLeft: 65, leadRight: 110, channelName: "SEIS-BMKG-229", category: "Subduction Array" },
    { id: "00230", label: "00230", connected: true, bank: "horizontal", trackIndex: 7, x: 720, y: 316, leadLeft: 75, leadRight: 90, channelName: "SEIS-BMKG-230", category: "Subduction Array" },
    { id: "00231", label: "00231", connected: true, bank: "horizontal", trackIndex: 8, x: 615, y: 354, leadLeft: 60, leadRight: 115, channelName: "SEIS-BMKG-231", category: "Infrasound Grid", amberWhenDisconnected: true },
    { id: "00232", label: "00232", connected: true, bank: "horizontal", trackIndex: 9, x: 660, y: 392, leadLeft: 70, leadRight: 95, channelName: "SEIS-BMKG-232", category: "Infrasound Grid" },
    { id: "00233", label: "00233", connected: true, bank: "horizontal", trackIndex: 10, x: 550, y: 430, leadLeft: 60, leadRight: 120, channelName: "SEIS-BMKG-233", category: "Tsunami Gauge" },
    { id: "00234", label: "00234", connected: true, bank: "horizontal", trackIndex: 11, x: 595, y: 468, leadLeft: 70, leadRight: 100, channelName: "SEIS-BMKG-234", category: "Tsunami Gauge" },
    { id: "00235", label: "00235", connected: true, bank: "horizontal", trackIndex: 12, x: 490, y: 506, leadLeft: 55, leadRight: 125, channelName: "SEIS-BMKG-235", category: "Tsunami Gauge" },
    { id: "00236", label: "00236", connected: true, bank: "horizontal", trackIndex: 13, x: 535, y: 544, leadLeft: 65, leadRight: 105, channelName: "SEIS-BMKG-236", category: "Tsunami Gauge" },
    { id: "00237", label: "00237", connected: true, bank: "horizontal", trackIndex: 14, x: 425, y: 582, leadLeft: 50, leadRight: 130, channelName: "SEIS-BMKG-237", category: "Ocean Buoy Link" },
    { id: "00238", label: "00238", connected: true, bank: "horizontal", trackIndex: 15, x: 470, y: 620, leadLeft: 60, leadRight: 110, channelName: "SEIS-BMKG-238", category: "Ocean Buoy Link" },
    { id: "00239", label: "00239", connected: true, bank: "horizontal", trackIndex: 16, x: 360, y: 658, leadLeft: 45, leadRight: 135, channelName: "SEIS-BMKG-239", category: "Ocean Buoy Link" },
    { id: "00240", label: "00240", connected: true, bank: "horizontal", trackIndex: 17, x: 405, y: 696, leadLeft: 55, leadRight: 115, channelName: "SEIS-BMKG-240", category: "Ocean Buoy Link" },
  ];

  // Disconnected nodes in Image 2
  const IMAGE_2_DISCONNECTED_IDS = new Set([
    "00130",
    "00132",
    "00135",
    "00136",
    "00225",
    "00228",
    "00229",
    "00231",
    "00234",
    "00235",
    "00237",
    "00238",
  ]);

  // Reactive state using Svelte 5 runes
  let nodes = $state<MagiNodeItem[]>(
    propNodes ? [...propNodes] : JSON.parse(JSON.stringify(DEFAULT_NODES))
  );

  let hoveredNode = $state<MagiNodeItem | null>(null);
  let searchQuery = $state("");
  let isSimulating = $state(false);
  let simulationInterval: any = null;

  // Track counts
  let totalCount = $derived(nodes.length);
  let connectedCount = $derived(nodes.filter((n) => n.connected).length);
  let severedCount = $derived(totalCount - connectedCount);
  let syncPercentage = $derived(
    totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0
  );

  // Single switch mode state (for variant="single")
  let singleConnected = $state(true);

  // Toggle a single node
  function toggleNode(node: MagiNodeItem) {
    if (readonly) return;
    node.connected = !node.connected;
    if (onToggle) {
      onToggle(node, node.connected);
    }
  }

  // Presets
  function applyPresetAllConnected() {
    nodes.forEach((n) => (n.connected = true));
  }

  function applyPresetImage2Severed() {
    nodes.forEach((n) => {
      n.connected = !IMAGE_2_DISCONNECTED_IDS.has(n.id);
    });
  }

  function severAll() {
    nodes.forEach((n) => (n.connected = false));
  }

  function connectAll() {
    nodes.forEach((n) => (n.connected = true));
  }

  function toggleSimulation() {
    isSimulating = !isSimulating;
    if (isSimulating) {
      simulationInterval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * nodes.length);
        const targetNode = nodes[randomIndex];
        if (targetNode) {
          targetNode.connected = !targetNode.connected;
          if (onToggle) {
            onToggle(targetNode, targetNode.connected);
          }
        }
      }, 800);
    } else {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
    }
  }

  onDestroy(() => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }
  });

  // -------------------------------------------------------------
  // Geometry & Wavy Path Generator
  // -------------------------------------------------------------
  // Generates 2-segment cubic bezier curve so CSS morphing transition is 100% continuous
  function getWirePath(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    isWavy: boolean,
    amplitude: number = 12
  ): string {
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;

    if (!isWavy) {
      // Straight line matching cubic bezier segments
      const c1x = p0.x + (midX - p0.x) / 3;
      const c1y = p0.y + (midY - p0.y) / 3;
      const c2x = p0.x + (2 * (midX - p0.x)) / 3;
      const c2y = p0.y + (2 * (midY - p0.y)) / 3;
      const c3x = midX + (p1.x - midX) / 3;
      const c3y = midY + (p1.y - midY) / 3;
      const c4x = midX + (2 * (p1.x - midX)) / 3;
      const c4y = midY + (2 * (p1.y - midY)) / 3;

      return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)} C ${c3x.toFixed(1)} ${c3y.toFixed(1)}, ${c4x.toFixed(1)} ${c4y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }

    // Wavy / slack S-curve path
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Crest in first half
    const c1x = p0.x + (midX - p0.x) * 0.35 + nx * amplitude;
    const c1y = p0.y + (midY - p0.y) * 0.35 + ny * amplitude;
    const c2x = p0.x + (midX - p0.x) * 0.75 + nx * amplitude;
    const c2y = p0.y + (midY - p0.y) * 0.75 + ny * amplitude;

    // Trough in second half
    const c3x = midX + (p1.x - midX) * 0.25 - nx * amplitude;
    const c3y = midY + (p1.y - midY) * 0.25 - ny * amplitude;
    const c4x = midX + (p1.x - midX) * 0.65 - nx * amplitude;
    const c4y = midY + (p1.y - midY) * 0.65 - ny * amplitude;

    return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)} C ${c3x.toFixed(1)} ${c3y.toFixed(1)}, ${c4x.toFixed(1)} ${c4y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  // Female connector socket shape path (Left half)
  function getFemalePiecePath(wHalf: number, h: number): string {
    const r = 2.5;
    const hHalf = h / 2;
    // Notch dimensions: width 5px into the piece, height 8px (-4 to +4)
    return `
      M ${-wHalf + r} ${-hHalf}
      L 0 ${-hHalf}
      L 0 -4
      L -5 -4
      L -5 4
      L 0 4
      L 0 ${hHalf}
      L ${-wHalf + r} ${hHalf}
      A ${r} ${r} 0 0 1 ${-wHalf} ${hHalf - r}
      L ${-wHalf} ${-hHalf + r}
      A ${r} ${r} 0 0 1 ${-wHalf + r} ${-hHalf}
      Z
    `.replace(/\s+/g, " ");
  }

  // Male connector plug tab shape path (Right half)
  function getMalePiecePath(wHalf: number, h: number): string {
    const r = 2.5;
    const hHalf = h / 2;
    // Plug tab dimensions: sticks 5px out towards the left (-5 to 0)
    return `
      M 0 ${-hHalf}
      L 0 -4
      L -5 -4
      L -5 4
      L 0 4
      L 0 ${hHalf}
      L ${wHalf - r} ${hHalf}
      A ${r} ${r} 0 0 0 ${wHalf} ${hHalf - r}
      L ${wHalf} ${-hHalf + r}
      A ${r} ${r} 0 0 0 ${wHalf - r} ${-hHalf}
      L 0 ${-hHalf}
      Z
    `.replace(/\s+/g, " ");
  }

  const NODE_W = 86;
  const NODE_H = 20;
  const W_HALF = NODE_W / 2;
  const femalePath = getFemalePiecePath(W_HALF, NODE_H);
  const malePath = getMalePiecePath(W_HALF, NODE_H);

  // Separation shift distance when severed
  const SEPARATE_SHIFT = 13;
</script>

{#if variant === "board"}
  <!-- ============================================================ -->
  <!-- FULL MAGI BUS BOARD VIEW                                     -->
  <!-- ============================================================ -->
  <div
    class="magi-board-container relative flex flex-col w-full rounded-md border border-neutral-800 bg-[#ff4e00] overflow-hidden text-neutral-900 shadow-2xl select-none {className}"
  >
    <!-- Top Cyber Deck Bar -->
    {#if showControls}
      <div
        class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-black/90 text-white border-b border-orange-500/40 z-20 backdrop-blur"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="font-mono font-bold tracking-widest text-xs text-orange-400">
              MAGI // SYNC BUS
            </span>
          </div>
          <span class="text-neutral-500 text-xs font-mono">|</span>
          <span class="text-[11px] font-mono text-neutral-300">
            NERV DATA HIGHWAY // BUS STATUS
          </span>
        </div>

        <!-- Presets & Actions -->
        <div class="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-emerald-400 hover:text-emerald-400 text-neutral-200 transition-colors"
            onclick={applyPresetAllConnected}
            title="Tampilkan semua terhubung sesuai Gambar 1"
          >
            PRESET 1 (CONNECTED)
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-orange-400 hover:text-orange-400 text-neutral-200 transition-colors"
            onclick={applyPresetImage2Severed}
            title="Tampilkan sever/terbelah sesuai Gambar 2"
          >
            PRESET 2 (SEVERED)
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-emerald-400 hover:text-emerald-400 text-neutral-300 transition-colors"
            onclick={connectAll}
          >
            CONNECT ALL
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-red-500 hover:text-red-400 text-neutral-300 transition-colors"
            onclick={severAll}
          >
            SEVER ALL
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded border transition-colors {isSimulating
              ? 'bg-amber-600/30 border-amber-400 text-amber-300 animate-pulse'
              : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-amber-400 hover:text-amber-400'}"
            onclick={toggleSimulation}
          >
            {isSimulating ? "SIMULATING..." : "SIMULATE GLITCH"}
          </button>

          <!-- Filter / Search -->
          <input
            type="text"
            placeholder="FIND NODE..."
            bind:value={searchQuery}
            class="w-24 px-2 py-0.5 text-[11px] bg-neutral-950 border border-neutral-700 text-white rounded font-mono focus:outline-none focus:border-orange-400 placeholder:text-neutral-500"
          />
        </div>
      </div>
    {/if}

    <!-- Telemetry Strip -->
    {#if showTelemetry}
      <div
        class="flex items-center justify-between px-4 py-1.5 bg-black/75 border-b border-orange-600/30 text-xs font-mono text-neutral-200 z-10"
      >
        <div class="flex items-center gap-4 text-[11px]">
          <div>
            <span class="text-neutral-400">TOTAL CHANNELS:</span>
            <span class="font-bold text-white ml-1">{totalCount}</span>
          </div>
          <div>
            <span class="text-neutral-400">SYNCED:</span>
            <span class="font-bold text-emerald-400 ml-1">{connectedCount}</span>
          </div>
          <div>
            <span class="text-neutral-400">SEVERED:</span>
            <span class="font-bold text-rose-500 ml-1">{severedCount}</span>
          </div>
          <div>
            <span class="text-neutral-400">SYNC RATE:</span>
            <span
              class="font-bold ml-1 {syncPercentage > 70
                ? 'text-emerald-400'
                : syncPercentage > 30
                  ? 'text-amber-400'
                  : 'text-rose-500'}"
            >
              {syncPercentage}%
            </span>
          </div>
        </div>

        <div class="text-[11px] text-neutral-400 hidden sm:block">
          <span>INTERACTION: </span>
          <span class="text-orange-300 font-semibold">KLIK NODE UNTUK TOGGLE</span>
        </div>
      </div>
    {/if}

    <!-- SVG MAGI Circuit Canvas -->
    <div class="relative w-full aspect-[16/10] min-h-[460px] overflow-hidden bg-[#ff4e00]">
      <!-- Tech Grid overlay (subtle) -->
      <svg
        class="w-full h-full block cursor-default"
        viewBox="-40 0 1060 720"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <!-- Fine grid pattern -->
          <pattern id="magiGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(0, 0, 0, 0.05)"
              stroke-width="0.75"
            />
          </pattern>

          <!-- Glow filters -->
          <filter id="greenTextGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#34d399" flood-opacity="0.8" />
          </filter>
          <filter id="amberTextGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#fb923c" flood-opacity="0.9" />
          </filter>
        </defs>

        <!-- Background grid -->
        <rect width="100%" height="100%" fill="url(#magiGrid)" />

        <!-- ============================================================== -->
        <!-- 1. BANK 1: DIAGONAL BUS TRACKS & NODES (-45 deg tilt)          -->
        <!-- ============================================================== -->
        <!-- Continuous background track lines for Lane 1 and Lane 2 -->
        <!-- Lane 1 Track (Right Lane, x + y = 570) -->
        <line x1="640" y1="-70" x2="15" y2="555" stroke="#0c0c0c" stroke-width="1.8" />
        <!-- Lane 2 Track (Left Lane, x + y = 505) -->
        <line x1="560" y1="-55" x2="65" y2="440" stroke="#0c0c0c" stroke-width="1.8" />

        <!-- Fixed ferrite beads along Track 1 -->
        {#each [
          { x: 482, y: 88 },
          { x: 406, y: 164 },
          { x: 330, y: 240 },
          { x: 254, y: 316 },
          { x: 178, y: 392 },
          { x: 102, y: 468 },
        ] as bead}
          <g transform="translate({bead.x}, {bead.y}) rotate(-45)">
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>
        {/each}

        <!-- Fixed ferrite beads along Track 2 -->
        {#each [
          { x: 460, y: 45 },
          { x: 384, y: 121 },
          { x: 308, y: 197 },
          { x: 232, y: 273 },
          { x: 156, y: 349 },
          { x: 80, y: 425 },
        ] as bead}
          <g transform="translate({bead.x}, {bead.y}) rotate(-45)">
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>
        {/each}

        <!-- Individual Diagonal Nodes & Flexible Wires -->
        {#each nodes.filter((n) => n.bank === "diagonal") as node (node.id)}
          {@const isSevered = !node.connected}
          {@const isHighlighted =
            searchQuery.trim().length > 0 &&
            node.label.toLowerCase().includes(searchQuery.toLowerCase())}

          <!-- Direction vectors along -45 deg track in SVG (dx = cos(-45) = 0.7071, dy = sin(-45) = -0.7071) -->
          {@const cosA = 0.7071}
          {@const sinA = -0.7071}

          <!-- Wire lead distance along track -->
          {@const wireSpan = 20}

          <!-- Upper flexible wire: between node top cap and fixed track anchor -->
          {@const topShift = isSevered ? SEPARATE_SHIFT : 0}
          {@const upperWireNodeCap = {
            x: node.x + (W_HALF + topShift) * cosA,
            y: node.y + (W_HALF + topShift) * sinA,
          }}
          {@const upperWireFixedEnd = {
            x: node.x + (W_HALF + wireSpan) * cosA,
            y: node.y + (W_HALF + wireSpan) * sinA,
          }}

          <!-- Lower flexible wire: between node bottom cap and fixed track anchor -->
          {@const bottomShift = isSevered ? SEPARATE_SHIFT : 0}
          {@const lowerWireNodeCap = {
            x: node.x - (W_HALF + bottomShift) * cosA,
            y: node.y - (W_HALF + bottomShift) * sinA,
          }}
          {@const lowerWireFixedEnd = {
            x: node.x - (W_HALF + wireSpan) * cosA,
            y: node.y - (W_HALF + wireSpan) * sinA,
          }}

          <!-- Wires: straight when connected; wavy S-curve ripple when severed -->
          <path
            d={getWirePath(upperWireFixedEnd, upperWireNodeCap, isSevered, 8)}
            fill="none"
            stroke="#0c0c0c"
            stroke-width="1.8"
            stroke-linecap="round"
            class="magi-wire transition-all duration-500 ease-out"
          />

          <path
            d={getWirePath(lowerWireNodeCap, lowerWireFixedEnd, isSevered, 8)}
            fill="none"
            stroke="#0c0c0c"
            stroke-width="1.8"
            stroke-linecap="round"
            class="magi-wire transition-all duration-500 ease-out"
          />

          <!-- Interactive Node Capsule Group (rotated -45 deg) -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group cursor-pointer group"
            transform="translate({node.x}, {node.y}) rotate(-45)"
            onclick={() => toggleNode(node)}
            onmouseenter={() => (hoveredNode = node)}
            onmouseleave={() => (hoveredNode = null)}
          >
            <!-- Highlight halo if searched -->
            {#if isHighlighted}
              <rect
                x={-W_HALF - 4}
                y={-NODE_H / 2 - 4}
                width={NODE_W + 8}
                height={NODE_H + 8}
                rx="6"
                fill="none"
                stroke="#00ffff"
                stroke-width="2"
                class="animate-pulse"
              />
            {/if}

            <!-- Left Piece (Female Socket Notch) -->
            <path
              d={femalePath}
              class="node-piece female-piece transition-all duration-500 ease-out"
              style="transform: translate({isSevered ? -SEPARATE_SHIFT : 0}px, 0);"
              fill={isSevered ? "#220505" : "#050505"}
              stroke={isSevered ? "#520e0e" : "#000000"}
              stroke-width="1.2"
            />

            <!-- Right Piece (Male Plug Tab) -->
            <path
              d={malePath}
              class="node-piece male-piece transition-all duration-500 ease-out"
              style="transform: translate({isSevered ? SEPARATE_SHIFT : 0}px, 0);"
              fill={isSevered ? "#220505" : "#050505"}
              stroke={isSevered ? "#520e0e" : "#000000"}
              stroke-width="1.2"
            />

            <!-- Text Display -->
            {#if !isSevered}
              <!-- Connected: Unified glowing phosphor-green monospace text -->
              <text
                x="0"
                y="4.5"
                text-anchor="middle"
                font-family="'Roboto Condensed', monospace"
                font-size="13"
                font-weight="700"
                letter-spacing="2"
                fill="#44ff99"
                filter="url(#greenTextGlow)"
                class="pointer-events-none transition-opacity duration-300"
              >
                {node.label}
              </text>
            {:else}
              <!-- Severed: Dimmed or amber text on the shifted piece -->
              <text
                x={SEPARATE_SHIFT + 8}
                y="4.5"
                text-anchor="middle"
                font-family="'Roboto Condensed', monospace"
                font-size="11"
                font-weight="700"
                letter-spacing="1"
                fill={node.amberWhenDisconnected ? "#ff9933" : "#6e1c1c"}
                filter={node.amberWhenDisconnected ? "url(#amberTextGlow)" : "none"}
                class="pointer-events-none transition-all duration-300"
              >
                {node.label}
              </text>
            {/if}
          </g>
        {/each}

        <!-- ============================================================== -->
        <!-- 2. BANK 2: HORIZONTAL-TO-DIAGONAL BUS TRACKS & NODES           -->
        <!-- ============================================================== -->
        {#each nodes.filter((n) => n.bank === "horizontal") as node (node.id)}
          {@const isSevered = !node.connected}
          {@const isHighlighted =
            searchQuery.trim().length > 0 &&
            node.label.toLowerCase().includes(searchQuery.toLowerCase())}

          <!-- Track measurements -->
          {@const leadL = node.leadLeft ?? 65}
          {@const leadR = node.leadRight ?? 90}

          <!-- Left side routing: -->
          {@const bendLeft = { x: node.x - W_HALF - leadL, y: node.y }}
          {@const diagLeftLen = 140}
          {@const endLeft = {
            x: bendLeft.x - diagLeftLen * 0.7071,
            y: bendLeft.y - diagLeftLen * 0.7071,
          }}

          <!-- Right side routing: -->
          {@const bendRight = { x: node.x + W_HALF + leadR, y: node.y }}
          {@const diagRightLen = 130}
          {@const endRight = {
            x: bendRight.x + diagRightLen * 0.7071,
            y: bendRight.y + diagRightLen * 0.7071,
          }}

          <!-- Node cap endpoints when connected vs severed -->
          {@const leftCapX = isSevered ? node.x - W_HALF - SEPARATE_SHIFT : node.x - W_HALF}
          {@const rightCapX = isSevered ? node.x + W_HALF + SEPARATE_SHIFT : node.x + W_HALF}

          <!-- 1. Diagonal Lead-in track (fixed straight 45 deg line) -->
          <line
            x1={endLeft.x}
            y1={endLeft.y}
            x2={bendLeft.x}
            y2={bendLeft.y}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- 2. Left wire: from bendLeft to node left cap -->
          <!-- Straight when connected; wavy S-curve ripple when severed -->
          <path
            d={getWirePath(bendLeft, { x: leftCapX, y: node.y }, isSevered, 11)}
            fill="none"
            stroke="#0c0c0c"
            stroke-width="1.8"
            stroke-linecap="round"
            class="magi-wire transition-all duration-500 ease-out"
          />

          <!-- 3. Right wire: from node right cap to bendRight -->
          <!-- Straight when connected; wavy S-curve ripple when severed -->
          <path
            d={getWirePath({ x: rightCapX, y: node.y }, bendRight, isSevered, 11)}
            fill="none"
            stroke="#0c0c0c"
            stroke-width="1.8"
            stroke-linecap="round"
            class="magi-wire transition-all duration-500 ease-out"
          />

          <!-- 4. Diagonal Lead-out track (fixed straight 45 deg line) -->
          <line
            x1={bendRight.x}
            y1={bendRight.y}
            x2={endRight.x}
            y2={endRight.y}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite bead markers along diagonal traces -->
          <g
            transform="translate({bendLeft.x - 45 * 0.7071}, {bendLeft.y -
              45 * 0.7071}) rotate(-45)"
          >
            <rect x="-6" y="-3" width="12" height="6" rx="2.5" fill="#0c0c0c" />
          </g>
          <g
            transform="translate({bendRight.x + 50 * 0.7071}, {bendRight.y +
              50 * 0.7071}) rotate(45)"
          >
            <rect x="-6" y="-3" width="12" height="6" rx="2.5" fill="#0c0c0c" />
          </g>

          <!-- Interactive Node Capsule Group (horizontal) -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group cursor-pointer group"
            transform="translate({node.x}, {node.y})"
            onclick={() => toggleNode(node)}
            onmouseenter={() => (hoveredNode = node)}
            onmouseleave={() => (hoveredNode = null)}
          >
            <!-- Highlight halo if searched -->
            {#if isHighlighted}
              <rect
                x={-W_HALF - 4}
                y={-NODE_H / 2 - 4}
                width={NODE_W + 8}
                height={NODE_H + 8}
                rx="6"
                fill="none"
                stroke="#00ffff"
                stroke-width="2"
                class="animate-pulse"
              />
            {/if}

            <!-- Left Piece (Female Socket Notch) -->
            <path
              d={femalePath}
              class="node-piece female-piece transition-all duration-500 ease-out"
              style="transform: translate({isSevered ? -SEPARATE_SHIFT : 0}px, 0);"
              fill={isSevered ? "#220505" : "#050505"}
              stroke={isSevered ? "#520e0e" : "#000000"}
              stroke-width="1.2"
            />

            <!-- Right Piece (Male Plug Tab) -->
            <path
              d={malePath}
              class="node-piece male-piece transition-all duration-500 ease-out"
              style="transform: translate({isSevered ? SEPARATE_SHIFT : 0}px, 0);"
              fill={isSevered ? "#220505" : "#050505"}
              stroke={isSevered ? "#520e0e" : "#000000"}
              stroke-width="1.2"
            />

            <!-- Text Display -->
            {#if !isSevered}
              <!-- Connected: Unified bright glowing green text -->
              <text
                x="0"
                y="4.5"
                text-anchor="middle"
                font-family="'Roboto Condensed', monospace"
                font-size="13"
                font-weight="700"
                letter-spacing="2"
                fill="#44ff99"
                filter="url(#greenTextGlow)"
                class="pointer-events-none transition-opacity duration-300"
              >
                {node.label}
              </text>
            {:else}
              <!-- Severed: Amber glowing text or dim crimson indicator -->
              <text
                x={SEPARATE_SHIFT + 8}
                y="4.5"
                text-anchor="middle"
                font-family="'Roboto Condensed', monospace"
                font-size="11"
                font-weight="700"
                letter-spacing="1"
                fill={node.amberWhenDisconnected || node.id === "00231"
                  ? "#ff9933"
                  : "#6e1c1c"}
                filter={node.amberWhenDisconnected || node.id === "00231"
                  ? "url(#amberTextGlow)"
                  : "none"}
                class="pointer-events-none transition-all duration-300"
              >
                {node.label}
              </text>
            {/if}
          </g>
        {/each}
      </svg>

      <!-- Hover Tooltip HUD Card -->
      {#if hoveredNode}
        <div
          class="absolute bottom-3 left-4 px-3 py-2 bg-black/95 border border-orange-500 text-white font-mono text-xs rounded shadow-lg pointer-events-none z-30 flex flex-col gap-1 backdrop-blur"
        >
          <div class="flex items-center justify-between gap-4">
            <span class="text-orange-400 font-bold">NODE ID: {hoveredNode.id}</span>
            <span
              class="px-1.5 py-0.5 text-[10px] rounded font-bold {hoveredNode.connected
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                : 'bg-rose-950 text-rose-300 border border-rose-600'}"
            >
              {hoveredNode.connected ? "CONNECTED // SYNC" : "SEVERED // OFFLINE"}
            </span>
          </div>
          <div class="text-neutral-400 text-[11px]">
            CHANNEL: <span class="text-neutral-200">{hoveredNode.channelName ?? "BUS-LINK"}</span>
          </div>
          <div class="text-neutral-400 text-[11px]">
            CATEGORY: <span class="text-neutral-200">{hoveredNode.category ?? "DATA-STREAM"}</span>
          </div>
          <div class="text-[10px] text-neutral-500 italic mt-0.5">
            Klik untuk {hoveredNode.connected ? "memutuskan (sever)" : "menghubungkan (connect)"}
          </div>
        </div>
      {/if}
    </div>
  </div>

{:else if variant === "single"}
  <!-- ============================================================ -->
  <!-- SINGLE TOGGLE SWITCH VARIANT (For Forms / Setting Panels)    -->
  <!-- ============================================================ -->
  <button
    type="button"
    class="magi-single-toggle group relative flex items-center justify-between gap-3 px-3 py-2 bg-[#ff4e00] rounded border border-orange-700/80 cursor-pointer overflow-hidden transition-all shadow-md select-none {className}"
    onclick={() => {
      singleConnected = !singleConnected;
      if (onToggle) {
        onToggle(
          {
            id: "SINGLE-01",
            label: "00130",
            connected: singleConnected,
            bank: "horizontal",
            trackIndex: 0,
            x: 100,
            y: 20,
          },
          singleConnected
        );
      }
    }}
  >
    <div class="flex items-center gap-2 z-10">
      <span class="w-2 h-2 rounded-full {singleConnected ? 'bg-emerald-400' : 'bg-rose-600'}"></span>
      <span class="font-mono text-xs font-bold text-black tracking-wider">
        {singleConnected ? "CONNECTED" : "SEVERED"}
      </span>
    </div>

    <!-- Inline SVG visualization -->
    <div class="w-40 h-10 relative">
      <svg class="w-full h-full" viewBox="0 0 160 40">
        <!-- Wires -->
        <path
          d={getWirePath({ x: 5, y: 20 }, { x: singleConnected ? 40 : 25, y: 20 }, !singleConnected, 7)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="transition-all duration-400 ease-out"
        />
        <path
          d={getWirePath({ x: singleConnected ? 120 : 135, y: 20 }, { x: 155, y: 20 }, !singleConnected, 7)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="transition-all duration-400 ease-out"
        />

        <!-- Node pieces -->
        <g transform="translate(80, 20)">
          <path
            d={getFemalePiecePath(40, 18)}
            class="transition-all duration-400 ease-out"
            style="transform: translate({!singleConnected ? -15 : 0}px, 0);"
            fill={!singleConnected ? "#220505" : "#050505"}
            stroke={!singleConnected ? "#520e0e" : "#000000"}
            stroke-width="1"
          />
          <path
            d={getMalePiecePath(40, 18)}
            class="transition-all duration-400 ease-out"
            style="transform: translate({!singleConnected ? 15 : 0}px, 0);"
            fill={!singleConnected ? "#220505" : "#050505"}
            stroke={!singleConnected ? "#520e0e" : "#000000"}
            stroke-width="1"
          />

          {#if singleConnected}
            <text
              x="0"
              y="4"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="11"
              font-weight="700"
              letter-spacing="1"
              fill="#44ff99"
            >
              SYNC // ON
            </text>
          {:else}
            <text
              x="18"
              y="4"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="9"
              font-weight="700"
              letter-spacing="0.5"
              fill="#ff9933"
            >
              CUT
            </text>
          {/if}
        </g>
      </svg>
    </div>
  </button>

{:else if variant === "rack"}
  <!-- ============================================================ -->
  <!-- RACK VARIANT: Vertical Bank for Multiple Data Streams        -->
  <!-- ============================================================ -->
  <div class="magi-rack-container flex flex-col gap-2 p-4 bg-[#ff4e00] rounded border border-orange-700 shadow-lg {className}">
    <div class="flex items-center justify-between pb-2 border-b border-black/20 text-xs font-mono font-bold text-black">
      <span>MAGI DATA RACK // CHANNELS</span>
      <span class="text-[10px] bg-black text-emerald-400 px-2 py-0.5 rounded font-mono">ONLINE</span>
    </div>

    <div class="flex flex-col gap-2">
      {#each nodes.slice(0, 4) as rackNode (rackNode.id)}
        <div
          class="flex items-center justify-between p-2 bg-black/10 rounded hover:bg-black/20 transition-colors cursor-pointer border border-black/10"
          onclick={() => toggleNode(rackNode)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && toggleNode(rackNode)}
        >
          <div class="flex flex-col">
            <span class="font-mono font-bold text-xs text-black">{rackNode.channelName ?? rackNode.id}</span>
            <span class="font-mono text-[10px] text-black/70">{rackNode.category ?? "FEED"}</span>
          </div>

          <div class="w-32 h-8">
            <svg class="w-full h-full" viewBox="0 0 130 32">
              <path
                d={getWirePath({ x: 5, y: 16 }, { x: rackNode.connected ? 30 : 18, y: 16 }, !rackNode.connected, 5)}
                fill="none"
                stroke="#0c0c0c"
                stroke-width="1.6"
              />
              <path
                d={getWirePath({ x: rackNode.connected ? 100 : 112, y: 16 }, { x: 125, y: 16 }, !rackNode.connected, 5)}
                fill="none"
                stroke="#0c0c0c"
                stroke-width="1.6"
              />
              <g transform="translate(65, 16)">
                <path
                  d={getFemalePiecePath(35, 16)}
                  class="transition-all duration-400"
                  style="transform: translate({!rackNode.connected ? -12 : 0}px, 0);"
                  fill={!rackNode.connected ? "#220505" : "#050505"}
                />
                <path
                  d={getMalePiecePath(35, 16)}
                  class="transition-all duration-400"
                  style="transform: translate({!rackNode.connected ? 12 : 0}px, 0);"
                  fill={!rackNode.connected ? "#220505" : "#050505"}
                />
                {#if rackNode.connected}
                  <text
                    x="0"
                    y="3.5"
                    text-anchor="middle"
                    font-family="monospace"
                    font-size="9"
                    font-weight="bold"
                    fill="#44ff99"
                  >
                    {rackNode.label}
                  </text>
                {:else}
                  <text
                    x="14"
                    y="3.5"
                    text-anchor="middle"
                    font-family="monospace"
                    font-size="8"
                    font-weight="bold"
                    fill="#ff9933"
                  >
                    CUT
                  </text>
                {/if}
              </g>
            </svg>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Transition for SVG path morphing */
  :global(.magi-wire) {
    transition: d 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), stroke 0.3s;
  }

  .node-piece {
    transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), fill 0.3s, stroke 0.3s;
  }

  .node-group:hover .node-piece {
    stroke: #ffffff;
    stroke-width: 1.5;
  }
</style>
