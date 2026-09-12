<script lang="ts">
  let {
    connected = $bindable(true),
    label = "00130",
    sublabel = "NERV-OPT-130",
    size = "md",
    disabled = false,
    readonly = false,
    className = "",
    onToggle,
  }: {
    connected?: boolean;
    label?: string;
    sublabel?: string;
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    readonly?: boolean;
    className?: string;
    onToggle?: (isConnected: boolean) => void;
  } = $props();

  function toggle() {
    if (disabled || readonly) return;
    connected = !connected;
    if (onToggle) {
      onToggle(connected);
    }
  }

  // Female connector socket shape path (Left half)
  function getFemalePiecePath(wHalf: number, h: number): string {
    const r = 2;
    const hHalf = h / 2;
    return `
      M ${-wHalf + r} ${-hHalf}
      L 0 ${-hHalf}
      L 0 -3.5
      L -4 -3.5
      L -4 3.5
      L 0 3.5
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
    const r = 2;
    const hHalf = h / 2;
    return `
      M 0 ${-hHalf}
      L 0 -3.5
      L -4 -3.5
      L -4 3.5
      L 0 3.5
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
    amplitude: number = 8,
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

  const shift = 13;
  const femalePath = getFemalePiecePath(36, 18);
  const malePath = getMalePiecePath(36, 18);
</script>

<button
  type="button"
  class="magi-single-toggle group relative flex items-center justify-between gap-3 px-3 py-2 bg-[#ff4e00] rounded border border-orange-700/80 cursor-pointer overflow-hidden transition-all shadow-md select-none {disabled
    ? 'opacity-50 cursor-not-allowed'
    : 'hover:border-orange-500'} {className}"
  onclick={toggle}
  {disabled}
  aria-pressed={connected}
>
  <div class="flex flex-col text-left z-10">
    <div class="flex items-center gap-2">
      <span
        class="w-2 h-2 rounded-full {connected
          ? 'bg-emerald-400 animate-pulse'
          : 'bg-rose-600'}"
      ></span>
      <span class=" text-xs font-bold text-black tracking-wider">
        {connected ? "CONNECTED" : "SEVERED"}
      </span>
    </div>
    {#if sublabel}
      <span class=" text-[10px] text-black/70 mt-0.5 tracking-tight"
        >{sublabel}</span
      >
    {/if}
  </div>

  <!-- Inline Evangelion SVG visualization -->
  <div class="w-44 h-10 relative">
    <svg class="w-full h-full" viewBox="0 0 170 40">
      <defs>
        <filter
          id="singleGreenGlow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.2"
            flood-color="#34d399"
            flood-opacity="0.8"
          />
        </filter>
        <filter
          id="singleAmberGlow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.5"
            flood-color="#fb923c"
            flood-opacity="0.9"
          />
        </filter>
      </defs>

      <!-- Left Wire -->
      <path
        d={getWirePath(
          { x: 5, y: 20 },
          { x: connected ? 45 : 45 - shift, y: 20 },
          !connected,
          7,
        )}
        fill="none"
        stroke="#0c0c0c"
        stroke-width="1.8"
        stroke-linecap="round"
        class="magi-wire"
      />

      <!-- Right Wire -->
      <path
        d={getWirePath(
          { x: connected ? 125 : 125 + shift, y: 20 },
          { x: 165, y: 20 },
          !connected,
          7,
        )}
        fill="none"
        stroke="#0c0c0c"
        stroke-width="1.8"
        stroke-linecap="round"
        class="magi-wire"
      />

      <!-- Node Capsule (Female Notch + Male Plug) -->
      <g transform="translate(85, 20)">
        <!-- Left Piece -->
        <path
          d={femalePath}
          class="node-piece transition-all duration-400"
          style="transform: translate({!connected ? -shift : 0}px, 0);"
          fill={!connected ? "#220505" : "#050505"}
          stroke={!connected ? "#520e0e" : "#000000"}
          stroke-width="1"
        />

        <!-- Right Piece -->
        <path
          d={malePath}
          class="node-piece transition-all duration-400"
          style="transform: translate({!connected ? shift : 0}px, 0);"
          fill={!connected ? "#220505" : "#050505"}
          stroke={!connected ? "#520e0e" : "#000000"}
          stroke-width="1"
        />

        <!-- Node Label Monospace -->
        {#if connected}
          <text
            x="0"
            y="4"
            text-anchor="middle"
            font-family="'Roboto Condensed', monospace"
            font-size="11"
            font-weight="700"
            letter-spacing="1"
            fill="#44ff99"
            filter="url(#singleGreenGlow)"
          >
            {label}
          </text>
        {:else}
          <text
            x={shift + 6}
            y="4"
            text-anchor="middle"
            font-family="'Roboto Condensed', monospace"
            font-size="10"
            font-weight="700"
            letter-spacing="0.5"
            fill="#ff9933"
            filter="url(#singleAmberGlow)"
          >
            {label}
          </text>
        {/if}
      </g>
    </svg>
  </div>
</button>

<style>
  :global(.magi-wire) {
    transition:
      d 0.4s cubic-bezier(0.2, 0.9, 0.3, 1),
      stroke 0.3s;
  }
  .node-piece {
    transition:
      transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1),
      fill 0.3s,
      stroke 0.3s;
  }
  .magi-single-toggle:hover .node-piece {
    stroke: #ffffff;
  }
</style>
