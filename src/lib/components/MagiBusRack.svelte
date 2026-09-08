<script lang="ts">
  export interface MagiRackItem {
    id: string;
    label: string;
    category?: string;
    channelName?: string;
    connected: boolean;
  }

  let {
    items = $bindable<MagiRackItem[]>([
      { id: "RACK-01", label: "00130", channelName: "NERV-OPT-130", category: "Core Synapse", connected: true },
      { id: "RACK-02", label: "00132", channelName: "NERV-OPT-132", category: "Data Bus A", connected: true },
      { id: "RACK-03", label: "00225", channelName: "SEIS-BMKG-225", category: "Primary Seismic", connected: true },
      { id: "RACK-04", label: "00231", channelName: "SEIS-BMKG-231", category: "Infrasound Grid", connected: false },
    ]),
    readonly = false,
    className = "",
    onToggle,
  }: {
    items?: MagiRackItem[];
    readonly?: boolean;
    className?: string;
    onToggle?: (item: MagiRackItem, isConnected: boolean) => void;
  } = $props();

  function toggle(item: MagiRackItem) {
    if (readonly) return;
    item.connected = !item.connected;
    if (onToggle) {
      onToggle(item, item.connected);
    }
  }

  // Female connector socket shape path (Left half)
  function getFemalePiecePath(wHalf: number, h: number): string {
    const r = 2;
    const hHalf = h / 2;
    return `
      M ${-wHalf + r} ${-hHalf}
      L 0 ${-hHalf}
      L 0 -3
      L -3.5 -3
      L -3.5 3
      L 0 3
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
      L 0 -3
      L -3.5 -3
      L -3.5 3
      L 0 3
      L 0 ${hHalf}
      L ${wHalf - r} ${hHalf}
      A ${r} ${r} 0 0 0 ${wHalf} ${hHalf - r}
      L ${wHalf} ${-hHalf + r}
      A ${r} ${r} 0 0 0 ${wHalf - r} ${-hHalf}
      L 0 ${-hHalf}
      Z
    `.replace(/\s+/g, " ");
  }

  // 2-segment cubic Bézier wire path
  function getWirePath(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    isWavy: boolean,
    amplitude: number = 6
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

  const shift = 11;
  const femalePath = getFemalePiecePath(32, 16);
  const malePath = getMalePiecePath(32, 16);
</script>

<div class="magi-rack-container flex flex-col gap-2 p-4 bg-[#ff4e00] rounded-md border border-orange-700 shadow-xl select-none font-mono {className}">
  <div class="flex items-center justify-between pb-2 border-b border-black/25 text-xs font-bold text-black">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-black animate-pulse"></span>
      <span>MAGI DATA RACK // TELEMETRY CHANNELS</span>
    </div>
    <span class="text-[10px] bg-black text-emerald-400 px-2 py-0.5 rounded">ONLINE</span>
  </div>

  <div class="flex flex-col gap-2">
    {#each items as rackItem (rackItem.id)}
      <div
        class="flex items-center justify-between p-2 bg-black/10 rounded hover:bg-black/20 transition-colors cursor-pointer border border-black/15"
        onclick={() => toggle(rackItem)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && toggle(rackItem)}
      >
        <div class="flex flex-col">
          <span class="font-bold text-xs text-black">{rackItem.channelName ?? rackItem.id}</span>
          <span class="text-[10px] text-black/70">{rackItem.category ?? "FEED"}</span>
        </div>

        <div class="w-36 h-8">
          <svg class="w-full h-full" viewBox="0 0 140 32">
            <!-- Left Wire -->
            <path
              d={getWirePath({ x: 5, y: 16 }, { x: rackItem.connected ? 35 : 35 - shift, y: 16 }, !rackItem.connected, 5)}
              fill="none"
              stroke="#0c0c0c"
              stroke-width="1.6"
              class="magi-wire"
            />
            <!-- Right Wire -->
            <path
              d={getWirePath({ x: rackItem.connected ? 105 : 105 + shift, y: 16 }, { x: 135, y: 16 }, !rackItem.connected, 5)}
              fill="none"
              stroke="#0c0c0c"
              stroke-width="1.6"
              class="magi-wire"
            />

            <!-- Node Group -->
            <g transform="translate(70, 16)">
              <path
                d={femalePath}
                class="node-piece transition-all duration-300"
                style="transform: translate({!rackItem.connected ? -shift : 0}px, 0);"
                fill={!rackItem.connected ? "#220505" : "#050505"}
                stroke={!rackItem.connected ? "#520e0e" : "#000000"}
                stroke-width="1"
              />
              <path
                d={malePath}
                class="node-piece transition-all duration-300"
                style="transform: translate({!rackItem.connected ? shift : 0}px, 0);"
                fill={!rackItem.connected ? "#220505" : "#050505"}
                stroke={!rackItem.connected ? "#520e0e" : "#000000"}
                stroke-width="1"
              />

              {#if rackItem.connected}
                <text
                  x="0"
                  y="3.5"
                  text-anchor="middle"
                  font-family="'Roboto Condensed', monospace"
                  font-size="9"
                  font-weight="bold"
                  letter-spacing="0.5"
                  fill="#44ff99"
                >
                  {rackItem.label}
                </text>
              {:else}
                <text
                  x={shift + 5}
                  y="3.5"
                  text-anchor="middle"
                  font-family="'Roboto Condensed', monospace"
                  font-size="8"
                  font-weight="bold"
                  fill="#ff9933"
                >
                  {rackItem.label}
                </text>
              {/if}
            </g>
          </svg>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  :global(.magi-wire) {
    transition: d 0.4s cubic-bezier(0.2, 0.9, 0.3, 1), stroke 0.3s;
  }
  .node-piece {
    transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1), fill 0.3s, stroke 0.3s;
  }
</style>
