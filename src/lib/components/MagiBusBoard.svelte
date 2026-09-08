<script lang="ts">
  export interface MagiNodeItem {
    id: string;
    label: string;
    connected: boolean;
    bank: "diagonal" | "horizontal";
    traceIndex: number;
    // Positioning
    x: number;
    y: number;
    angle?: number;
    // Leads
    leadLeft?: number;
    leadRight?: number;
    // Fixed anchor points for diagonal trace integration
    topFixed?: { x: number; y: number };
    bottomFixed?: { x: number; y: number };
    topMargin?: number;
    botMargin?: number;
    // Metadata
    stationCode?: string;
    networkCode?: string;
    site?: string;
    channelName?: string;
    category?: string;
    rawItem?: any;
  }

  let {
    items = [],
    readonly = false,
    activeNodeId = null,
    highlightQuery = "",
    className = "",
    onToggle,
    onSelectNode,
  }: {
    items?: any[];
    readonly?: boolean;
    activeNodeId?: string | null;
    highlightQuery?: string;
    className?: string;
    onToggle?: (item: any, isConnected: boolean) => void;
    onSelectNode?: (item: any) => void;
  } = $props();

  // -------------------------------------------------------------
  // Default authentic 31-node configuration (Image 1 & 2 layout)
  // 18 Horizontal Traces (i=0..17) with 18 horizontal nodes
  // + 13 Diagonal Nodes placed along traces 4..16
  // -------------------------------------------------------------
  const DEFAULT_CONFIG = [
    // --- Bank 1: Diagonal Nodes (Lane 1 & Lane 2 along traces 4 to 16) ---
    // Lane 1 (Even traces: 4, 6, 8, 10, 12, 14, 16):
    { id: "00126", label: "00126", bank: "diagonal" as const, traceIndex: 4, channelName: "NERV-OPT-126", category: "Core Synapse" },
    { id: "00128", label: "00128", bank: "diagonal" as const, traceIndex: 6, channelName: "NERV-OPT-128", category: "Core Synapse" },
    { id: "00130", label: "00130", bank: "diagonal" as const, traceIndex: 8, channelName: "NERV-OPT-130", category: "Data Bus A" },
    { id: "00132", label: "00132", bank: "diagonal" as const, traceIndex: 10, channelName: "NERV-OPT-132", category: "Telemetry Link" },
    { id: "00134", label: "00134", bank: "diagonal" as const, traceIndex: 12, channelName: "NERV-OPT-134", category: "Telemetry Link" },
    { id: "00136", label: "00136", bank: "diagonal" as const, traceIndex: 14, channelName: "NERV-OPT-136", category: "Aux Relay" },
    { id: "00138", label: "00138", bank: "diagonal" as const, traceIndex: 16, channelName: "NERV-OPT-138", category: "Aux Relay" },

    // Lane 2 (Odd traces: 5, 7, 9, 11, 13, 15):
    { id: "00127", label: "00127", bank: "diagonal" as const, traceIndex: 5, channelName: "NERV-OPT-127", category: "Core Synapse" },
    { id: "00129", label: "00129", bank: "diagonal" as const, traceIndex: 7, channelName: "NERV-OPT-129", category: "Data Bus A" },
    { id: "00131", label: "00131", bank: "diagonal" as const, traceIndex: 9, channelName: "NERV-OPT-131", category: "Data Bus A" },
    { id: "00133", label: "00133", bank: "diagonal" as const, traceIndex: 11, channelName: "NERV-OPT-133", category: "Telemetry Link" },
    { id: "00135", label: "00135", bank: "diagonal" as const, traceIndex: 13, channelName: "NERV-OPT-135", category: "Aux Relay" },
    { id: "00137", label: "00137", bank: "diagonal" as const, traceIndex: 15, channelName: "NERV-OPT-137", category: "Aux Relay" },

    // --- Bank 2: Horizontal Nodes (00223 - 00240 on traces 0 to 17) ---
    { id: "00223", label: "00223", bank: "horizontal" as const, traceIndex: 0, channelName: "SEIS-BMKG-223", category: "Primary Seismic" },
    { id: "00224", label: "00224", bank: "horizontal" as const, traceIndex: 1, channelName: "SEIS-BMKG-224", category: "Primary Seismic" },
    { id: "00225", label: "00225", bank: "horizontal" as const, traceIndex: 2, channelName: "SEIS-BMKG-225", category: "Primary Seismic" },
    { id: "00226", label: "00226", bank: "horizontal" as const, traceIndex: 3, channelName: "SEIS-BMKG-226", category: "Primary Seismic" },
    { id: "00227", label: "00227", bank: "horizontal" as const, traceIndex: 4, channelName: "SEIS-BMKG-227", category: "Subduction Array" },
    { id: "00228", label: "00228", bank: "horizontal" as const, traceIndex: 5, channelName: "SEIS-BMKG-228", category: "Subduction Array" },
    { id: "00229", label: "00229", bank: "horizontal" as const, traceIndex: 6, channelName: "SEIS-BMKG-229", category: "Subduction Array" },
    { id: "00230", label: "00230", bank: "horizontal" as const, traceIndex: 7, channelName: "SEIS-BMKG-230", category: "Subduction Array" },
    { id: "00231", label: "00231", bank: "horizontal" as const, traceIndex: 8, channelName: "SEIS-BMKG-231", category: "Infrasound Grid" },
    { id: "00232", label: "00232", bank: "horizontal" as const, traceIndex: 9, channelName: "SEIS-BMKG-232", category: "Infrasound Grid" },
    { id: "00233", label: "00233", bank: "horizontal" as const, traceIndex: 10, channelName: "SEIS-BMKG-233", category: "Tsunami Gauge" },
    { id: "00234", label: "00234", bank: "horizontal" as const, traceIndex: 11, channelName: "SEIS-BMKG-234", category: "Tsunami Gauge" },
    { id: "00235", label: "00235", bank: "horizontal" as const, traceIndex: 12, channelName: "SEIS-BMKG-235", category: "Tsunami Gauge" },
    { id: "00236", label: "00236", bank: "horizontal" as const, traceIndex: 13, channelName: "SEIS-BMKG-236", category: "Tsunami Gauge" },
    { id: "00237", label: "00237", bank: "horizontal" as const, traceIndex: 14, channelName: "SEIS-BMKG-237", category: "Ocean Buoy Link" },
    { id: "00238", label: "00238", bank: "horizontal" as const, traceIndex: 15, channelName: "SEIS-BMKG-238", category: "Ocean Buoy Link" },
    { id: "00239", label: "00239", bank: "horizontal" as const, traceIndex: 16, channelName: "SEIS-BMKG-239", category: "Ocean Buoy Link" },
    { id: "00240", label: "00240", bank: "horizontal" as const, traceIndex: 17, channelName: "SEIS-BMKG-240", category: "Ocean Buoy Link" },
  ];

  // Derive active nodes reactively by mapping passed `items` or defaults
  let nodes = $derived.by(() => {
    return DEFAULT_CONFIG.map((cfg, idx): MagiNodeItem => {
      // Find matching item from props if provided
      let matchedItem: any = null;
      if (items && items.length > 0) {
        if (idx < items.length) {
          matchedItem = items[idx];
        } else {
          // If items has fewer entries, cycle or look by id
          matchedItem = items.find((it: any) => it.id === cfg.id || it.stationCode === cfg.label);
        }
      }

      const isConnected = matchedItem
        ? (matchedItem.status ? matchedItem.status === "ACTIVE" : matchedItem.connected ?? true)
        : true;

      const label = matchedItem
        ? (matchedItem.stationCode || matchedItem.label || matchedItem.title || cfg.label)
        : cfg.label;

      const channelName = matchedItem
        ? (matchedItem.title || `${matchedItem.networkCode || "NERV"}-${matchedItem.stationCode || label}`)
        : cfg.channelName;

      const site = matchedItem?.site ?? "";
      const networkCode = matchedItem?.networkCode ?? "GE";
      const stationCode = matchedItem?.stationCode ?? label;

      // Coordinate geometry calculation
      const traceIdx = cfg.traceIndex;
      const yNode = 55 + traceIdx * 33;
      const pair = Math.floor(traceIdx / 2);
      const odd = traceIdx % 2 === 1;
      const xNode = 940 - pair * 64 + (odd ? 44 : 0);

      // Left lead & in-bend
      const leadL = odd ? 80 : 36;
      const xBendIn = xNode - 43 - leadL;

      // Right lead & out-bend
      const leadR = odd ? 40 : 85;
      const xBendOut = xNode + 43 + leadR;

      if (cfg.bank === "horizontal") {
        return {
          ...cfg,
          label,
          connected: isConnected,
          x: xNode,
          y: yNode,
          leadLeft: leadL,
          leadRight: leadR,
          channelName,
          site,
          networkCode,
          stationCode,
          rawItem: matchedItem,
        };
      } else {
        // Diagonal node sitting on trace's diagonal corridor
        // The diagonal segment goes from (xTurnIn, yEntry) to (xBendIn, yNode)
        const yEntry = 15 + traceIdx * 16;
        const diagLen = yNode - yEntry;
        const xTurnIn = xBendIn - diagLen;

        // Staggering: Lane 1 (even traces) t = 0.52, Lane 2 (odd traces) t = 0.42
        const isLane1 = traceIdx % 2 === 0;
        const t = isLane1 ? 0.52 : 0.42;
        const diagX = xTurnIn + diagLen * t;
        const diagY = yEntry + diagLen * t;

        const sinA = 0.7071;
        const wireSpan = 16;
        const diagWireDelta = (43 + wireSpan) * sinA;

        const topFixed = {
          x: diagX - diagWireDelta,
          y: diagY - diagWireDelta,
        };
        const bottomFixed = {
          x: diagX + diagWireDelta,
          y: diagY + diagWireDelta,
        };

        const topMargin = topFixed.y - yEntry;
        const botMargin = yNode - bottomFixed.y;

        return {
          ...cfg,
          label,
          connected: isConnected,
          x: diagX,
          y: diagY,
          topFixed,
          bottomFixed,
          topMargin,
          botMargin,
          channelName,
          site,
          networkCode,
          stationCode,
          rawItem: matchedItem,
        };
      }
    });
  });

  // Calculate 18 planar non-overlapping traces
  const traces = $derived.by(() => {
    const res = [];
    for (let i = 0; i < 18; i++) {
      const yNode = 55 + i * 33;
      const pair = Math.floor(i / 2);
      const odd = i % 2 === 1;
      const xNode = 940 - pair * 64 + (odd ? 44 : 0);
      
      const leadL = odd ? 80 : 36;
      const xBendIn = xNode - 43 - leadL;
      
      const leadR = odd ? 40 : 85;
      const xBendOut = xNode + 43 + leadR;

      const yEntry = 15 + i * 16;
      const diagL = yNode - yEntry;
      const xTurnIn = xBendIn - diagL;

      const diagR = 25 + (17 - i) * 6;
      const yExit = yNode + diagR;
      const xTurnOut = xBendOut + diagR;

      // Find if this trace has a diagonal node
      const diagNode = nodes.find((n) => n.bank === "diagonal" && n.traceIndex === i);

      res.push({
        i,
        yEntry,
        xTurnIn,
        xBendIn,
        yNode,
        xNode,
        xBendOut,
        xTurnOut,
        yExit,
        diagNode,
      });
    }
    return res;
  });

  let hoveredNode = $state<MagiNodeItem | null>(null);

  function toggle(node: MagiNodeItem) {
    if (readonly) return;
    const newStatus = !node.connected;
    if (node.rawItem) {
      if (node.rawItem.status !== undefined) {
        node.rawItem.status = newStatus ? "ACTIVE" : "OFFLINE";
        node.rawItem.type = newStatus ? "normal" : "danger";
      } else {
        node.rawItem.connected = newStatus;
      }
    }
    if (onToggle) {
      onToggle(node.rawItem || node, newStatus);
    }
    if (onSelectNode) {
      onSelectNode(node.rawItem || node);
    }
  }

  // Female connector socket shape path (Left half)
  function getFemalePiecePath(wHalf: number, h: number): string {
    const r = 2.5;
    const hHalf = h / 2;
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

  // 2-segment cubic Bézier wire path for morphing
  function getWirePath(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    isWavy: boolean,
    amplitude: number = 10
  ): string {
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;

    if (!isWavy) {
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

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const c1x = p0.x + (midX - p0.x) * 0.35 + nx * amplitude;
    const c1y = p0.y + (midY - p0.y) * 0.35 + ny * amplitude;
    const c2x = p0.x + (midX - p0.x) * 0.75 + nx * amplitude;
    const c2y = p0.y + (midY - p0.y) * 0.75 + ny * amplitude;

    const c3x = midX + (p1.x - midX) * 0.25 - nx * amplitude;
    const c3y = midY + (p1.y - midY) * 0.25 - ny * amplitude;
    const c4x = midX + (p1.x - midX) * 0.65 - nx * amplitude;
    const c4y = midY + (p1.y - midY) * 0.65 - ny * amplitude;

    return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)} C ${c3x.toFixed(1)} ${c3y.toFixed(1)}, ${c4x.toFixed(1)} ${c4y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const NODE_W = 86;
  const NODE_H = 20;
  const W_HALF = NODE_W / 2;
  const femalePath = getFemalePiecePath(W_HALF, NODE_H);
  const malePath = getMalePiecePath(W_HALF, NODE_H);
  const SEPARATE_SHIFT = 13;
</script>

<div
  class="magi-board-view relative w-full rounded-md border border-neutral-800 bg-[#ff4e00] overflow-hidden text-neutral-900 shadow-2xl select-none {className}"
>
  <!-- Main SVG MAGI Circuit Canvas with Edge-to-Edge traces (x=0 to x=1200) -->
  <div class="relative w-full aspect-[16/9] min-h-[480px] overflow-hidden bg-[#ff4e00]">
    <svg
      class="w-full h-full block cursor-default"
      viewBox="0 0 1200 680"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <!-- Fine engineering background grid -->
        <pattern id="boardGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 0, 0, 0.05)" stroke-width="0.75" />
        </pattern>

        <!-- Phosphor green glow for connected nodes -->
        <filter id="boardGreenGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#34d399" flood-opacity="0.8" />
        </filter>

        <!-- Amber glow for severed nodes -->
        <filter id="boardAmberGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#fb923c" flood-opacity="0.9" />
        </filter>
      </defs>

      <!-- Substrate grid -->
      <rect width="100%" height="100%" fill="url(#boardGrid)" />

      <!-- ============================================================== -->
      <!-- 18 PLANAR NON-OVERLAPPING CONTINUOUS TRACES (EDGE TO EDGE)    -->
      <!-- ============================================================== -->
      {#each traces as tr (tr.i)}
        <!-- Segment 1: Entry from Left Edge (x=0) to first 45° bend -->
        <line
          x1="0"
          y1={tr.yEntry}
          x2={tr.xTurnIn}
          y2={tr.yEntry}
          stroke="#0c0c0c"
          stroke-width="1.8"
        />

        {#if tr.diagNode && tr.diagNode.topFixed && tr.diagNode.bottomFixed}
          <!-- Segment 2A: From Entry Turn to Diagonal Node Top Lead -->
          <line
            x1={tr.xTurnIn}
            y1={tr.yEntry}
            x2={tr.diagNode.topFixed.x}
            y2={tr.diagNode.topFixed.y}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite bead on Segment 2A if space permits -->
          {#if (tr.diagNode.topMargin ?? 0) > 20}
            <g transform="translate({tr.xTurnIn + (tr.diagNode.topFixed.x - tr.xTurnIn) * 0.5}, {tr.yEntry + (tr.diagNode.topFixed.y - tr.yEntry) * 0.5}) rotate(45)">
              <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
            </g>
          {/if}

          <!-- Segment 2B: From Diagonal Node Bottom Lead to Horizontal Bend -->
          <line
            x1={tr.diagNode.bottomFixed.x}
            y1={tr.diagNode.bottomFixed.y}
            x2={tr.xBendIn}
            y2={tr.yNode}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite bead on Segment 2B if space permits -->
          {#if (tr.diagNode.botMargin ?? 0) > 20}
            <g transform="translate({tr.diagNode.bottomFixed.x + (tr.xBendIn - tr.diagNode.bottomFixed.x) * 0.5}, {tr.diagNode.bottomFixed.y + (tr.yNode - tr.diagNode.bottomFixed.y) * 0.5}) rotate(45)">
              <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
            </g>
          {/if}
        {:else}
          <!-- Segment 2: Unbroken 45° Diagonal Lead-in for traces without diagonal nodes -->
          <line
            x1={tr.xTurnIn}
            y1={tr.yEntry}
            x2={tr.xBendIn}
            y2={tr.yNode}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite Beads along diagonal in-track -->
          <g transform="translate({tr.xBendIn - 24}, {tr.yNode - 24}) rotate(45)">
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>
        {/if}

        <!-- Segment 4: 45° Diagonal Lead-out from Horizontal Node Bank -->
        <line
          x1={tr.xBendOut}
          y1={tr.yNode}
          x2={tr.xTurnOut}
          y2={tr.yExit}
          stroke="#0c0c0c"
          stroke-width="1.8"
        />

        <!-- Ferrite Beads along diagonal out-track -->
        <g transform="translate({tr.xBendOut + 22}, {tr.yNode + 22}) rotate(45)">
          <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
        </g>

        <!-- Segment 5: Exit to Right Edge (x=1200) -->
        <line
          x1={tr.xTurnOut}
          y1={tr.yExit}
          x2="1200"
          y2={tr.yExit}
          stroke="#0c0c0c"
          stroke-width="1.8"
        />
      {/each}

      <!-- ============================================================== -->
      <!-- BANK 1: DIAGONAL BUS NODES (LANE 1 & LANE 2 AT 45 DEG TILT)    -->
      <!-- ============================================================== -->
      {#each nodes.filter((n) => n.bank === "diagonal") as node (node.id)}
        {@const isSevered = !node.connected}
        {@const isSelected = activeNodeId === node.id || activeNodeId === node.stationCode}
        {@const isHighlighted =
          highlightQuery.trim().length > 0 &&
          (node.label.toLowerCase().includes(highlightQuery.toLowerCase()) ||
            node.channelName?.toLowerCase().includes(highlightQuery.toLowerCase()))}

        <!-- Direction along +45 deg tilt (dx = 0.7071, dy = 0.7071) -->
        {@const cosA = 0.7071}
        {@const sinA = 0.7071}
        {@const wireSpan = 16}

        <!-- Flexible wire: top cap to fixed track -->
        {@const topShift = isSevered ? SEPARATE_SHIFT : 0}
        {@const topCap = {
          x: node.x - (W_HALF + topShift) * cosA,
          y: node.y - (W_HALF + topShift) * sinA,
        }}
        {@const topFixed = node.topFixed ?? {
          x: node.x - (W_HALF + wireSpan) * cosA,
          y: node.y - (W_HALF + wireSpan) * sinA,
        }}

        <!-- Flexible wire: bottom cap to fixed track -->
        {@const bottomShift = isSevered ? SEPARATE_SHIFT : 0}
        {@const bottomCap = {
          x: node.x + (W_HALF + bottomShift) * cosA,
          y: node.y + (W_HALF + bottomShift) * sinA,
        }}
        {@const bottomFixed = node.bottomFixed ?? {
          x: node.x + (W_HALF + wireSpan) * cosA,
          y: node.y + (W_HALF + wireSpan) * sinA,
        }}

        <!-- Top flexible wire -->
        <path
          d={getWirePath(topFixed, topCap, isSevered, 8)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="magi-wire"
        />

        <!-- Bottom flexible wire -->
        <path
          d={getWirePath(bottomCap, bottomFixed, isSevered, 8)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="magi-wire"
        />

        <!-- Interactive Node Capsule Group (rotated 45 deg) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="node-group cursor-pointer group"
          transform="translate({node.x}, {node.y}) rotate(45)"
          onclick={() => toggle(node)}
          onmouseenter={() => (hoveredNode = node)}
          onmouseleave={() => (hoveredNode = null)}
        >
          <!-- Highlight / Selection halo -->
          {#if isHighlighted || isSelected}
            <rect
              x={-W_HALF - 4}
              y={-NODE_H / 2 - 4}
              width={NODE_W + 8}
              height={NODE_H + 8}
              rx="6"
              fill="none"
              stroke={isSelected ? "#ff0055" : "#00ffff"}
              stroke-width="2.5"
              class="animate-pulse"
            />
          {/if}

          <!-- Left Piece (Female Socket) -->
          <path
            d={femalePath}
            class="node-piece"
            style="transform: translate({isSevered ? -SEPARATE_SHIFT : 0}px, 0);"
            fill={isSevered ? "#220505" : "#050505"}
            stroke={isSevered ? "#520e0e" : "#000000"}
            stroke-width="1.2"
          />

          <!-- Right Piece (Male Plug) -->
          <path
            d={malePath}
            class="node-piece"
            style="transform: translate({isSevered ? SEPARATE_SHIFT : 0}px, 0);"
            fill={isSevered ? "#220505" : "#050505"}
            stroke={isSevered ? "#520e0e" : "#000000"}
            stroke-width="1.2"
          />

          <!-- Text Display -->
          {#if !isSevered}
            <text
              x="0"
              y="4.5"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="12"
              font-weight="700"
              letter-spacing="1.5"
              fill="#44ff99"
              filter="url(#boardGreenGlow)"
              class="pointer-events-none"
            >
              {node.label}
            </text>
          {:else}
            <text
              x={SEPARATE_SHIFT + 8}
              y="4.5"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="11"
              font-weight="700"
              letter-spacing="1"
              fill="#ff9933"
              filter="url(#boardAmberGlow)"
              class="pointer-events-none"
            >
              {node.label}
            </text>
          {/if}
        </g>
      {/each}

      <!-- ============================================================== -->
      <!-- BANK 2: HORIZONTAL BUS NODES (STAGGERED CASCADE)               -->
      <!-- ============================================================== -->
      {#each nodes.filter((n) => n.bank === "horizontal") as node (node.id)}
        {@const isSevered = !node.connected}
        {@const isSelected = activeNodeId === node.id || activeNodeId === node.stationCode}
        {@const isHighlighted =
          highlightQuery.trim().length > 0 &&
          (node.label.toLowerCase().includes(highlightQuery.toLowerCase()) ||
            node.channelName?.toLowerCase().includes(highlightQuery.toLowerCase()))}

        {@const tr = traces[node.traceIndex]}
        {@const leftCapX = isSevered ? node.x - W_HALF - SEPARATE_SHIFT : node.x - W_HALF}
        {@const rightCapX = isSevered ? node.x + W_HALF + SEPARATE_SHIFT : node.x + W_HALF}

        <!-- Flexible wire: from in-bend to node left cap -->
        <path
          d={getWirePath({ x: tr.xBendIn, y: node.y }, { x: leftCapX, y: node.y }, isSevered, 10)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="magi-wire"
        />

        <!-- Flexible wire: from node right cap to out-bend -->
        <path
          d={getWirePath({ x: rightCapX, y: node.y }, { x: tr.xBendOut, y: node.y }, isSevered, 10)}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="magi-wire"
        />

        <!-- Interactive Node Capsule Group (horizontal) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="node-group cursor-pointer group"
          transform="translate({node.x}, {node.y})"
          onclick={() => toggle(node)}
          onmouseenter={() => (hoveredNode = node)}
          onmouseleave={() => (hoveredNode = null)}
        >
          <!-- Highlight / Selection halo -->
          {#if isHighlighted || isSelected}
            <rect
              x={-W_HALF - 4}
              y={-NODE_H / 2 - 4}
              width={NODE_W + 8}
              height={NODE_H + 8}
              rx="6"
              fill="none"
              stroke={isSelected ? "#ff0055" : "#00ffff"}
              stroke-width="2.5"
              class="animate-pulse"
            />
          {/if}

          <!-- Left Piece (Female Socket) -->
          <path
            d={femalePath}
            class="node-piece"
            style="transform: translate({isSevered ? -SEPARATE_SHIFT : 0}px, 0);"
            fill={isSevered ? "#220505" : "#050505"}
            stroke={isSevered ? "#520e0e" : "#000000"}
            stroke-width="1.2"
          />

          <!-- Right Piece (Male Plug) -->
          <path
            d={malePath}
            class="node-piece"
            style="transform: translate({isSevered ? SEPARATE_SHIFT : 0}px, 0);"
            fill={isSevered ? "#220505" : "#050505"}
            stroke={isSevered ? "#520e0e" : "#000000"}
            stroke-width="1.2"
          />

          <!-- Text Display -->
          {#if !isSevered}
            <text
              x="0"
              y="4.5"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="12"
              font-weight="700"
              letter-spacing="1.5"
              fill="#44ff99"
              filter="url(#boardGreenGlow)"
              class="pointer-events-none"
            >
              {node.label}
            </text>
          {:else}
            <text
              x={SEPARATE_SHIFT + 8}
              y="4.5"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="11"
              font-weight="700"
              letter-spacing="1"
              fill="#ff9933"
              filter="url(#boardAmberGlow)"
              class="pointer-events-none"
            >
              {node.label}
            </text>
          {/if}
        </g>
      {/each}
    </svg>

    <!-- Detailed Node Tooltip HUD (on hover) -->
    {#if hoveredNode}
      <div
        class="absolute bottom-3 left-4 px-3.5 py-2 bg-black/95 border border-orange-500 text-white font-mono text-xs rounded shadow-2xl pointer-events-none z-30 flex flex-col gap-1 backdrop-blur max-w-sm"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-1.5">
            <span class="text-orange-400 font-bold">NODE: {hoveredNode.label}</span>
            <span class="text-neutral-500 text-[10px]">({hoveredNode.id})</span>
          </div>
          <span
            class="px-1.5 py-0.5 text-[10px] rounded font-bold {hoveredNode.connected
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
              : 'bg-rose-950 text-rose-300 border border-rose-600'}"
          >
            {hoveredNode.connected ? "ACTIVE // SYNC" : "OFFLINE // SEVERED"}
          </span>
        </div>

        {#if hoveredNode.channelName}
          <div class="text-neutral-400 text-[11px]">
            CHANNEL: <span class="text-neutral-200">{hoveredNode.channelName}</span>
          </div>
        {/if}

        {#if hoveredNode.site}
          <div class="text-neutral-400 text-[11px] truncate">
            SITE: <span class="text-neutral-200">{hoveredNode.site}</span>
          </div>
        {/if}

        <div class="text-neutral-400 text-[11px]">
          BANK: <span class="text-neutral-200 uppercase">{hoveredNode.bank} // TRACE {hoveredNode.traceIndex + 1}</span>
        </div>

        <div class="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1 mt-0.5 italic">
          Klik node untuk {hoveredNode.connected ? "memutuskan (sever)" : "menghubungkan (connect)"}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
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
