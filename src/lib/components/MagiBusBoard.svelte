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
    // Multi-block tracking
    blockIndex?: number;
    rowIndex?: number;
    blockInRow?: number;
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
    maxColumns = 4,
    readonly = false,
    activeNodeId = null,
    highlightQuery = "",
    className = "",
    onToggle,
    onSelectNode,
  }: {
    items?: any[];
    maxColumns?: number;
    readonly?: boolean;
    activeNodeId?: string | null;
    highlightQuery?: string;
    className?: string;
    onToggle?: (item: any, isConnected: boolean) => void;
    onSelectNode?: (item: any) => void;
  } = $props();

  // -------------------------------------------------------------
  // Default authentic 31-node configuration (Single Module Unit)
  // 18 Horizontal Traces (i=0..17) with 18 horizontal nodes
  // + 13 Diagonal Nodes placed along traces 4..16
  // -------------------------------------------------------------
  const DEFAULT_CONFIG = [
    // --- Bank 1: Diagonal Nodes (Lane 1 & Lane 2 along traces 4 to 16) ---
    // Lane 1 (Even traces: 4, 6, 8, 10, 12, 14, 16):
    {
      id: "00126",
      label: "00126",
      bank: "diagonal" as const,
      traceIndex: 4,
      channelName: "NERV-OPT-126",
      category: "Core Synapse",
    },
    {
      id: "00128",
      label: "00128",
      bank: "diagonal" as const,
      traceIndex: 6,
      channelName: "NERV-OPT-128",
      category: "Core Synapse",
    },
    {
      id: "00130",
      label: "00130",
      bank: "diagonal" as const,
      traceIndex: 8,
      channelName: "NERV-OPT-130",
      category: "Data Bus A",
    },
    {
      id: "00132",
      label: "00132",
      bank: "diagonal" as const,
      traceIndex: 10,
      channelName: "NERV-OPT-132",
      category: "Telemetry Link",
    },
    {
      id: "00134",
      label: "00134",
      bank: "diagonal" as const,
      traceIndex: 12,
      channelName: "NERV-OPT-134",
      category: "Telemetry Link",
    },
    {
      id: "00136",
      label: "00136",
      bank: "diagonal" as const,
      traceIndex: 14,
      channelName: "NERV-OPT-136",
      category: "Aux Relay",
    },
    {
      id: "00138",
      label: "00138",
      bank: "diagonal" as const,
      traceIndex: 16,
      channelName: "NERV-OPT-138",
      category: "Aux Relay",
    },

    // Lane 2 (Odd traces: 5, 7, 9, 11, 13, 15):
    {
      id: "00127",
      label: "00127",
      bank: "diagonal" as const,
      traceIndex: 5,
      channelName: "NERV-OPT-127",
      category: "Core Synapse",
    },
    {
      id: "00129",
      label: "00129",
      bank: "diagonal" as const,
      traceIndex: 7,
      channelName: "NERV-OPT-129",
      category: "Data Bus A",
    },
    {
      id: "00131",
      label: "00131",
      bank: "diagonal" as const,
      traceIndex: 9,
      channelName: "NERV-OPT-131",
      category: "Data Bus A",
    },
    {
      id: "00133",
      label: "00133",
      bank: "diagonal" as const,
      traceIndex: 11,
      channelName: "NERV-OPT-133",
      category: "Telemetry Link",
    },
    {
      id: "00135",
      label: "00135",
      bank: "diagonal" as const,
      traceIndex: 13,
      channelName: "NERV-OPT-135",
      category: "Aux Relay",
    },
    {
      id: "00137",
      label: "00137",
      bank: "diagonal" as const,
      traceIndex: 15,
      channelName: "NERV-OPT-137",
      category: "Aux Relay",
    },

    // --- Bank 2: Horizontal Nodes (00223 - 00240 on traces 0 to 17) ---
    {
      id: "00223",
      label: "00223",
      bank: "horizontal" as const,
      traceIndex: 0,
      channelName: "SEIS-BMKG-223",
      category: "Primary Seismic",
    },
    {
      id: "00224",
      label: "00224",
      bank: "horizontal" as const,
      traceIndex: 1,
      channelName: "SEIS-BMKG-224",
      category: "Primary Seismic",
    },
    {
      id: "00225",
      label: "00225",
      bank: "horizontal" as const,
      traceIndex: 2,
      channelName: "SEIS-BMKG-225",
      category: "Primary Seismic",
    },
    {
      id: "00226",
      label: "00226",
      bank: "horizontal" as const,
      traceIndex: 3,
      channelName: "SEIS-BMKG-226",
      category: "Primary Seismic",
    },
    {
      id: "00227",
      label: "00227",
      bank: "horizontal" as const,
      traceIndex: 4,
      channelName: "SEIS-BMKG-227",
      category: "Subduction Array",
    },
    {
      id: "00228",
      label: "00228",
      bank: "horizontal" as const,
      traceIndex: 5,
      channelName: "SEIS-BMKG-228",
      category: "Subduction Array",
    },
    {
      id: "00229",
      label: "00229",
      bank: "horizontal" as const,
      traceIndex: 6,
      channelName: "SEIS-BMKG-229",
      category: "Subduction Array",
    },
    {
      id: "00230",
      label: "00230",
      bank: "horizontal" as const,
      traceIndex: 7,
      channelName: "SEIS-BMKG-230",
      category: "Subduction Array",
    },
    {
      id: "00231",
      label: "00231",
      bank: "horizontal" as const,
      traceIndex: 8,
      channelName: "SEIS-BMKG-231",
      category: "Infrasound Grid",
    },
    {
      id: "00232",
      label: "00232",
      bank: "horizontal" as const,
      traceIndex: 9,
      channelName: "SEIS-BMKG-232",
      category: "Infrasound Grid",
    },
    {
      id: "00233",
      label: "00233",
      bank: "horizontal" as const,
      traceIndex: 10,
      channelName: "SEIS-BMKG-233",
      category: "Tsunami Gauge",
    },
    {
      id: "00234",
      label: "00234",
      bank: "horizontal" as const,
      traceIndex: 11,
      channelName: "SEIS-BMKG-234",
      category: "Tsunami Gauge",
    },
    {
      id: "00235",
      label: "00235",
      bank: "horizontal" as const,
      traceIndex: 12,
      channelName: "SEIS-BMKG-235",
      category: "Tsunami Gauge",
    },
    {
      id: "00236",
      label: "00236",
      bank: "horizontal" as const,
      traceIndex: 13,
      channelName: "SEIS-BMKG-236",
      category: "Tsunami Gauge",
    },
    {
      id: "00237",
      label: "00237",
      bank: "horizontal" as const,
      traceIndex: 14,
      channelName: "SEIS-BMKG-237",
      category: "Ocean Buoy Link",
    },
    {
      id: "00238",
      label: "00238",
      bank: "horizontal" as const,
      traceIndex: 15,
      channelName: "SEIS-BMKG-238",
      category: "Ocean Buoy Link",
    },
    {
      id: "00239",
      label: "00239",
      bank: "horizontal" as const,
      traceIndex: 16,
      channelName: "SEIS-BMKG-239",
      category: "Ocean Buoy Link",
    },
    {
      id: "00240",
      label: "00240",
      bank: "horizontal" as const,
      traceIndex: 17,
      channelName: "SEIS-BMKG-240",
      category: "Ocean Buoy Link",
    },
  ];

  // Board Architecture Constants (Dimensions per 2-column block module)
  const W_BLOCK = 1180;
  const H_ROW = 680;
  const W_HALF = 43;
  const NODE_W = 86;
  const NODE_H = 20;
  const SEPARATE_SHIFT = 13;

  // View mode: 'fit' scales SVG to container width, 'scroll' allows native 100% crisp resolution
  let viewMode = $state<"fit" | "scroll">("fit");

  // Multi-column and Multi-row calculations
  // 1 block = 2 columns (1 diagonal column + 1 horizontal column = 31 nodes)
  let blocksPerRow = $derived(Math.max(1, Math.floor(maxColumns / 2)));
  const itemsPerBlock = 31;
  let effectiveItems = $derived(
    items && items.length > 0 ? items : DEFAULT_CONFIG,
  );
  let totalBlocks = $derived(
    Math.max(1, Math.ceil(effectiveItems.length / itemsPerBlock)),
  );
  let totalRows = $derived(Math.max(1, Math.ceil(totalBlocks / blocksPerRow)));
  let activeBlocksPerRow = $derived(Math.min(blocksPerRow, totalBlocks));
  let totalWidth = $derived(activeBlocksPerRow * W_BLOCK);
  let totalHeight = $derived(totalRows * H_ROW);

  // Base trace coordinates within 1 module
  function getBaseTraceCoords(i: number) {
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

    return {
      i,
      yNode,
      xNode,
      leadL,
      xBendIn,
      leadR,
      xBendOut,
      yEntry,
      diagL,
      xTurnIn,
      diagR,
      yExit,
      xTurnOut,
    };
  }

  // Derive active nodes positioned across all blocks and rows
  let nodes = $derived.by(() => {
    const res: MagiNodeItem[] = [];

    for (let g = 0; g < totalBlocks; g++) {
      const r = Math.floor(g / blocksPerRow);
      const b = g % blocksPerRow;
      const xOffset = b * W_BLOCK;
      const yOffset = r * H_ROW;

      const blockItems = effectiveItems.slice(
        g * itemsPerBlock,
        (g + 1) * itemsPerBlock,
      );

      // Iterate through 31 slots of block g:
      // Slots 0..12: Diagonal nodes
      // Slots 13..30: Horizontal nodes
      for (let slot = 0; slot < 31; slot++) {
        if (slot >= blockItems.length && items && items.length > 0) {
          // If past total items, slot is unpopulated
          continue;
        }

        const matchedItem = blockItems[slot] || DEFAULT_CONFIG[slot];
        const defaultCfg = DEFAULT_CONFIG[slot];

        const isConnected = matchedItem
          ? matchedItem.status
            ? matchedItem.status === "ACTIVE"
            : (matchedItem.connected ?? true)
          : true;

        const label = matchedItem
          ? matchedItem.stationCode ||
            matchedItem.label ||
            matchedItem.title ||
            defaultCfg.label
          : defaultCfg.label;

        const channelName = matchedItem
          ? matchedItem.title ||
            `${matchedItem.networkCode || "NERV"}-${matchedItem.stationCode || label}`
          : defaultCfg.channelName;

        const site = matchedItem?.site ?? "";
        const networkCode = matchedItem?.networkCode ?? "GE";
        const stationCode = matchedItem?.stationCode ?? label;

        if (defaultCfg.bank === "horizontal") {
          const traceIdx = defaultCfg.traceIndex;
          const coords = getBaseTraceCoords(traceIdx);

          res.push({
            ...defaultCfg,
            id: matchedItem?.id || `${defaultCfg.id}-g${g}`,
            label,
            connected: isConnected,
            x: xOffset + coords.xNode,
            y: yOffset + coords.yNode,
            leadLeft: coords.leadL,
            leadRight: coords.leadR,
            blockIndex: g,
            rowIndex: r,
            blockInRow: b,
            channelName,
            site,
            networkCode,
            stationCode,
            rawItem: matchedItem,
          });
        } else {
          // Diagonal node
          const traceIdx = defaultCfg.traceIndex;
          const coords = getBaseTraceCoords(traceIdx);

          const isLane1 = traceIdx % 2 === 0;
          const t = isLane1 ? 0.52 : 0.42;
          const localDiagX = coords.xTurnIn + coords.diagL * t;
          const localDiagY = coords.yEntry + coords.diagL * t;

          const sinA = 0.7071;
          const wireSpan = 16;
          const diagWireDelta = (W_HALF + wireSpan) * sinA;

          const topFixed = {
            x: xOffset + localDiagX - diagWireDelta,
            y: yOffset + localDiagY - diagWireDelta,
          };
          const bottomFixed = {
            x: xOffset + localDiagX + diagWireDelta,
            y: yOffset + localDiagY + diagWireDelta,
          };

          const topMargin = topFixed.y - (yOffset + coords.yEntry);
          const botMargin = yOffset + coords.yNode - bottomFixed.y;

          res.push({
            ...defaultCfg,
            id: matchedItem?.id || `${defaultCfg.id}-g${g}`,
            label,
            connected: isConnected,
            x: xOffset + localDiagX,
            y: yOffset + localDiagY,
            topFixed,
            bottomFixed,
            topMargin,
            botMargin,
            blockIndex: g,
            rowIndex: r,
            blockInRow: b,
            channelName,
            site,
            networkCode,
            stationCode,
            rawItem: matchedItem,
          });
        }
      }
    }

    return res;
  });

  // Calculate planar non-overlapping traces across all rows and blocks
  let traces = $derived.by(() => {
    const res = [];

    for (let r = 0; r < totalRows; r++) {
      const yOffset = r * H_ROW;

      for (let b = 0; b < activeBlocksPerRow; b++) {
        const g = r * blocksPerRow + b;
        const xOffset = b * W_BLOCK;
        const xStart = xOffset;
        const xEnd = xOffset + W_BLOCK;

        for (let i = 0; i < 18; i++) {
          const coords = getBaseTraceCoords(i);

          const yNode = yOffset + coords.yNode;
          const yEntry = yOffset + coords.yEntry;
          const yExit = yOffset + coords.yExit;

          const xTurnIn = xOffset + coords.xTurnIn;
          const xBendIn = xOffset + coords.xBendIn;
          const xNode = xOffset + coords.xNode;
          const xBendOut = xOffset + coords.xBendOut;
          const xTurnOut = xOffset + coords.xTurnOut;

          // Find nodes on this trace in block g
          const diagNode = nodes.find(
            (n) =>
              n.blockIndex === g && n.bank === "diagonal" && n.traceIndex === i,
          );
          const horizNode = nodes.find(
            (n) =>
              n.blockIndex === g &&
              n.bank === "horizontal" &&
              n.traceIndex === i,
          );

          const isFirstBlockInRow = b === 0;
          const isLastBlockInRow = b === activeBlocksPerRow - 1;

          // Staggered 45-degree straight-line planar interconnect (NO CURVES)
          // Lower traces (larger i) turn earlier/lower down, utilizing open substrate space
          const dy = yNode - yEntry; // vertical climb: 40 + 17 * i
          const xInterStart = xOffset + 1115 + i * -16;
          const xInterEnd = xInterStart + dy; // 45° straight climb, reaches yEntry

          // Midpoint of the 45° straight climb for ferrite bead
          const xMid = (xInterStart + xInterEnd) * 0.5;
          const yMid = (yNode + yEntry) * 0.5;

          // Arrival point for Segment 1 in block b from preceding block b-1
          const prevInterEnd = (b - 1) * W_BLOCK + 1115 + i * -16 + dy;

          res.push({
            key: `r${r}-b${b}-t${i}`,
            r,
            b,
            g,
            i,
            xStart,
            xEnd,
            yEntry,
            xTurnIn,
            xBendIn,
            yNode,
            xNode,
            xBendOut,
            xTurnOut,
            yExit,
            diagNode,
            horizNode,
            isFirstBlockInRow,
            isLastBlockInRow,
            xInterStart,
            xInterEnd,
            prevInterEnd,
            xMid,
            yMid,
          });
        }
      }
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
    amplitude: number = 10,
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

  const femalePath = getFemalePiecePath(W_HALF, NODE_H);
  const malePath = getMalePiecePath(W_HALF, NODE_H);
</script>

<div class="magi-board-view relative w-full bg-[#ff4e00] {className}">
  <!-- Main SVG MAGI Circuit Canvas with Dynamic Multi-Column & Multi-Row Grid -->
  <div class="relative w-full overflow-auto bg-[#ff4e00] transition-all">
    <svg
      class="block cursor-default {viewMode === 'fit' ? 'w-full h-auto' : ''}"
      style={viewMode === "scroll"
        ? `width: ${totalWidth}px; height: ${totalHeight}px; min-width: ${totalWidth}px;`
        : "width: 100%;"}
      viewBox="0 0 {totalWidth} {totalHeight}"
      preserveAspectRatio="xMidYMin meet"
    >
      <defs>
        <!-- Fine engineering background grid -->
        <pattern
          id="boardGrid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(0, 0, 0, 0.05)"
            stroke-width="0.75"
          />
        </pattern>

        <!-- Phosphor green glow for connected nodes -->
        <filter
          id="boardGreenGlow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.5"
            flood-color="#34d399"
            flood-opacity="0.8"
          />
        </filter>

        <!-- Amber glow for severed nodes -->
        <filter
          id="boardAmberGlow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="2"
            flood-color="#fb923c"
            flood-opacity="0.9"
          />
        </filter>
      </defs>

      <!-- Substrate grid covering entire multi-row canvas -->
      <rect width="100%" height="100%" fill="url(#boardGrid)" />

      <!-- ============================================================== -->
      <!-- ROW HEADERS & BLOCK BUS DIVIDERS (ETCHED ON CIRCUIT SUBSTRATE) -->
      <!-- ============================================================== -->
      {#each { length: totalRows } as _, r}
        {@const yRow = r * H_ROW}
        {@const startCh = r * blocksPerRow * itemsPerBlock + 1}
        {@const endCh = Math.min(
          effectiveItems.length,
          (r + 1) * blocksPerRow * itemsPerBlock,
        )}

        <!-- Row Header Telemetry Legend -->
        <g
          transform="translate(24, {yRow + 24})"
          class="pointer-events-none select-none opacity-85"
        >
          <text
            x="0"
            y="0"
            font-family="'Roboto Condensed', monospace"
            font-size="11"
            font-weight="700"
            letter-spacing="2"
            fill="rgba(0, 0, 0, 0.45)"
          >
            MAGI PROCESSOR BACKPLANE // BUS ROW 0{r + 1} // [CH {String(
              startCh,
            ).padStart(3, "0")} - {String(endCh).padStart(3, "0")}]
          </text>
        </g>

        <!-- Horizontal boundary separator between rows -->
        {#if r > 0}
          <line
            x1="0"
            y1={yRow}
            x2={totalWidth}
            y2={yRow}
            stroke="rgba(0,0,0,0.25)"
            stroke-width="1.5"
            stroke-dasharray="12,6"
          />
        {/if}

        <!-- Continuous inter-column bus indicators (silkscreen text only, no vertical cuts) -->
        {#each { length: activeBlocksPerRow - 1 } as _, b}
          {@const xSep = (b + 1) * W_BLOCK}
          <g
            transform="translate({xSep}, {yRow + 24})"
            class="pointer-events-none select-none opacity-40"
          >
            <text
              x="0"
              y="0"
              text-anchor="middle"
              font-family="'Roboto Condensed', monospace"
              font-size="8"
              font-weight="700"
              letter-spacing="1.5"
              fill="rgba(0,0,0,0.5)"
            >
              INTER-COLUMN BUS TRACE LINK // CH 18-PLANAR
            </text>
          </g>
        {/each}
      {/each}

      <!-- ============================================================== -->
      <!-- CONTINUOUS PLANAR CIRCUIT TRACES (ACROSS ALL ROWS & BLOCKS)    -->
      <!-- ============================================================== -->
      {#each traces as tr (tr.key)}
        <!-- Segment 1: Lead-in to diagonal turn-in -->
        {#if tr.isFirstBlockInRow}
          <line
            x1="0"
            y1={tr.yEntry}
            x2={tr.xTurnIn}
            y2={tr.yEntry}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />
        {:else if tr.xTurnIn > tr.prevInterEnd}
          <line
            x1={tr.prevInterEnd}
            y1={tr.yEntry}
            x2={tr.xTurnIn}
            y2={tr.yEntry}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />
        {/if}

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
            <g
              transform="translate({tr.xTurnIn +
                (tr.diagNode.topFixed.x - tr.xTurnIn) * 0.5}, {tr.yEntry +
                (tr.diagNode.topFixed.y - tr.yEntry) * 0.5}) rotate(45)"
            >
              <rect
                x="-5"
                y="-2.5"
                width="10"
                height="5"
                rx="2"
                fill="#0c0c0c"
              />
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
            <g
              transform="translate({tr.diagNode.bottomFixed.x +
                (tr.xBendIn - tr.diagNode.bottomFixed.x) * 0.5}, {tr.diagNode
                .bottomFixed.y +
                (tr.yNode - tr.diagNode.bottomFixed.y) * 0.5}) rotate(45)"
            >
              <rect
                x="-5"
                y="-2.5"
                width="10"
                height="5"
                rx="2"
                fill="#0c0c0c"
              />
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
          <g
            transform="translate({tr.xBendIn - 24}, {tr.yNode - 24}) rotate(45)"
          >
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>
        {/if}

        <!-- Segment 3: Horizontal Trace & Interconnect / Exit -->
        {#if !tr.isLastBlockInRow}
          <!-- In intermediate blocks, trace extends to staggered xInterStart -->
          {#if !tr.horizNode}
            <line
              x1={tr.xBendIn}
              y1={tr.yNode}
              x2={tr.xInterStart}
              y2={tr.yNode}
              stroke="#0c0c0c"
              stroke-width="1.8"
            />
          {:else if tr.xInterStart > tr.xBendOut}
            <line
              x1={tr.xBendOut}
              y1={tr.yNode}
              x2={tr.xInterStart}
              y2={tr.yNode}
              stroke="#0c0c0c"
              stroke-width="1.8"
            />
            <!-- Ferrite bead on long horizontal run past node if wide enough -->
            {#if tr.xInterStart - tr.xBendOut > 60}
              <g
                transform="translate({tr.xBendOut +
                  (tr.xInterStart - tr.xBendOut) * 0.5}, {tr.yNode})"
              >
                <rect
                  x="-5"
                  y="-2.5"
                  width="10"
                  height="5"
                  rx="2"
                  fill="#0c0c0c"
                />
              </g>
            {/if}
          {/if}

          <!-- Inter-column 45° straight diagonal climb (NO CURVES) -->
          <line
            x1={tr.xInterStart}
            y1={tr.yNode}
            x2={tr.xInterEnd}
            y2={tr.yEntry}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite bead along the 45° straight diagonal climb -->
          <g transform="translate({tr.xMid}, {tr.yMid}) rotate(-45)">
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>
        {:else}
          <!-- In LAST block of row, trace exits toward the right screen boundary -->
          {#if !tr.horizNode}
            <line
              x1={tr.xBendIn}
              y1={tr.yNode}
              x2={tr.xBendOut}
              y2={tr.yNode}
              stroke="#0c0c0c"
              stroke-width="1.8"
            />
          {/if}

          <!-- Segment 4: 45° Diagonal Lead-out on LAST block of row -->
          <line
            x1={tr.xBendOut}
            y1={tr.yNode}
            x2={tr.xTurnOut}
            y2={tr.yExit}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />

          <!-- Ferrite Beads along diagonal out-track -->
          <g
            transform="translate({tr.xBendOut + 22}, {tr.yNode +
              22}) rotate(45)"
          >
            <rect x="-5" y="-2.5" width="10" height="5" rx="2" fill="#0c0c0c" />
          </g>

          <!-- Segment 5: Exit to the right screen boundary (totalWidth) on LAST block of row -->
          <line
            x1={tr.xTurnOut}
            y1={tr.yExit}
            x2={totalWidth}
            y2={tr.yExit}
            stroke="#0c0c0c"
            stroke-width="1.8"
          />
        {/if}
      {/each}

      <!-- ============================================================== -->
      <!-- BANK 1: DIAGONAL BUS NODES (LANE 1 & LANE 2 AT 45 DEG TILT)    -->
      <!-- ============================================================== -->
      {#each nodes.filter((n) => n.bank === "diagonal") as node (node.id + "-b" + node.blockIndex + "-t" + node.traceIndex)}
        {@const isSevered = !node.connected}
        {@const isSelected =
          activeNodeId === node.id || activeNodeId === node.stationCode}
        {@const isHighlighted =
          highlightQuery.trim().length > 0 &&
          (node.label.toLowerCase().includes(highlightQuery.toLowerCase()) ||
            node.channelName
              ?.toLowerCase()
              .includes(highlightQuery.toLowerCase()))}

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
            style="transform: translate({isSevered
              ? -SEPARATE_SHIFT
              : 0}px, 0);"
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
      {#each nodes.filter((n) => n.bank === "horizontal") as node (node.id + "-b" + node.blockIndex + "-t" + node.traceIndex)}
        {@const isSevered = !node.connected}
        {@const isSelected =
          activeNodeId === node.id || activeNodeId === node.stationCode}
        {@const isHighlighted =
          highlightQuery.trim().length > 0 &&
          (node.label.toLowerCase().includes(highlightQuery.toLowerCase()) ||
            node.channelName
              ?.toLowerCase()
              .includes(highlightQuery.toLowerCase()))}

        {@const coords = getBaseTraceCoords(node.traceIndex)}
        {@const xOffset = (node.blockInRow ?? 0) * W_BLOCK}
        {@const leftCapX = isSevered
          ? node.x - W_HALF - SEPARATE_SHIFT
          : node.x - W_HALF}
        {@const rightCapX = isSevered
          ? node.x + W_HALF + SEPARATE_SHIFT
          : node.x + W_HALF}
        {@const inBendX = xOffset + coords.xBendIn}
        {@const outBendX = xOffset + coords.xBendOut}

        <!-- Flexible wire: from in-bend to node left cap -->
        <path
          d={getWirePath(
            { x: inBendX, y: node.y },
            { x: leftCapX, y: node.y },
            isSevered,
            10,
          )}
          fill="none"
          stroke="#0c0c0c"
          stroke-width="1.8"
          stroke-linecap="round"
          class="magi-wire"
        />

        <!-- Flexible wire: from node right cap to out-bend -->
        <path
          d={getWirePath(
            { x: rightCapX, y: node.y },
            { x: outBendX, y: node.y },
            isSevered,
            10,
          )}
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
            style="transform: translate({isSevered
              ? -SEPARATE_SHIFT
              : 0}px, 0);"
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
        class="fixed bottom-4 left-6 px-3.5 py-2.5 bg-black/95 border border-orange-500 text-white font-mono text-xs rounded shadow-2xl pointer-events-none z-50 flex flex-col gap-1 backdrop-blur max-w-sm"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-1.5">
            <span class="text-orange-400 font-bold"
              >NODE: {hoveredNode.label}</span
            >
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
            CHANNEL: <span class="text-neutral-200"
              >{hoveredNode.channelName}</span
            >
          </div>
        {/if}

        {#if hoveredNode.site}
          <div class="text-neutral-400 text-[11px] truncate">
            SITE: <span class="text-neutral-200">{hoveredNode.site}</span>
          </div>
        {/if}

        <div class="text-neutral-400 text-[11px]">
          LOCATION: <span class="text-neutral-200"
            >ROW 0{(hoveredNode.rowIndex ?? 0) + 1} // BANK 0{(hoveredNode.blockIndex ??
              0) + 1} // {hoveredNode.bank.toUpperCase()}</span
          >
        </div>

        <div
          class="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1 mt-0.5 italic"
        >
          Klik node untuk {hoveredNode.connected
            ? "memutuskan (sever)"
            : "menghubungkan (connect)"}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.magi-wire) {
    transition:
      d 0.45s cubic-bezier(0.2, 0.9, 0.3, 1),
      stroke 0.3s;
  }

  .node-piece {
    transition:
      transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1),
      fill 0.3s,
      stroke 0.3s;
  }

  .node-group:hover .node-piece {
    stroke: #ffffff;
    stroke-width: 1.5;
  }
</style>
