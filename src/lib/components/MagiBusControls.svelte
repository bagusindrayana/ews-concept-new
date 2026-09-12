<script lang="ts">
  let {
    totalCount = 0,
    connectedCount = 0,
    severedCount = 0,
    syncPercentage = 100,
    columns = $bindable(4),
    isSimulating = false,
    searchQuery = $bindable(""),
    onPresetAllConnected,
    onPresetImage2,
    onConnectAll,
    onSeverAll,
    onToggleSimulation,
    className = "",
  }: {
    totalCount?: number;
    connectedCount?: number;
    severedCount?: number;
    syncPercentage?: number;
    columns?: number;
    isSimulating?: boolean;
    searchQuery?: string;
    onPresetAllConnected?: () => void;
    onPresetImage2?: () => void;
    onConnectAll?: () => void;
    onSeverAll?: () => void;
    onToggleSimulation?: () => void;
    className?: string;
  } = $props();
</script>

<div class="flex flex-col w-full text-xs select-none {className}">
  <!-- Top Action Strip -->
  <div
    class="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 bg-black/95 text-white border-b border-orange-500/40 backdrop-blur rounded-t-md shadow-md"
  >
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span
          class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
        ></span>
        <span class="font-bold tracking-widest text-xs text-orange-400">
          MAGI // CIRCUIT BUS DECK
        </span>
      </div>
    </div>

    <!-- Actions & Presets -->
    <div class="flex items-center flex-wrap gap-1.5 text-xs">
      <!-- Layout Columns Selector -->
      <div
        class="flex items-center gap-1 bg-neutral-950 px-1 py-0.5 rounded border border-neutral-700"
      >
        <span class="text-[10px] text-neutral-400 px-1 font-bold">COLS:</span>
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[10px] font-bold transition-all {columns ===
          2
            ? 'bg-orange-500 text-black shadow'
            : 'text-neutral-400 hover:text-white'}"
          onclick={() => (columns = 2)}
          title="2 Kolom (1 Bank per baris)"
        >
          2
        </button>
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[10px] font-bold transition-all {columns ===
          4
            ? 'bg-orange-500 text-black shadow'
            : 'text-neutral-400 hover:text-white'}"
          onclick={() => (columns = 4)}
          title="4 Kolom (2 Bank per baris - Default)"
        >
          4
        </button>
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[10px] font-bold transition-all {columns ===
          6
            ? 'bg-orange-500 text-black shadow'
            : 'text-neutral-400 hover:text-white'}"
          onclick={() => (columns = 6)}
          title="6 Kolom (3 Bank per baris)"
        >
          6
        </button>
      </div>

      {#if onPresetAllConnected}
        <button
          type="button"
          class="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-emerald-400 hover:text-emerald-400 text-neutral-200 transition-colors"
          onclick={onPresetAllConnected}
          title="Tampilkan semua terhubung sesuai Gambar 1"
        >
          PRESET 1 (CONNECTED)
        </button>
      {/if}

      {#if onPresetImage2}
        <button
          type="button"
          class="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-orange-400 hover:text-orange-400 text-neutral-200 transition-colors"
          onclick={onPresetImage2}
          title="Tampilkan sever/terbelah sesuai Gambar 2"
        >
          PRESET 2 (SEVERED)
        </button>
      {/if}

      {#if onConnectAll}
        <button
          type="button"
          class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-emerald-400 hover:text-emerald-400 text-neutral-300 transition-colors"
          onclick={onConnectAll}
        >
          CONNECT ALL
        </button>
      {/if}

      {#if onSeverAll}
        <button
          type="button"
          class="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 hover:border-red-500 hover:text-red-400 text-neutral-300 transition-colors"
          onclick={onSeverAll}
        >
          SEVER ALL
        </button>
      {/if}

      {#if onToggleSimulation}
        <button
          type="button"
          class="px-2.5 py-1 rounded border transition-colors {isSimulating
            ? 'bg-amber-600/30 border-amber-400 text-amber-300 animate-pulse'
            : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-amber-400 hover:text-amber-400'}"
          onclick={onToggleSimulation}
        >
          {isSimulating ? "SIMULATING..." : "SIMULATE GLITCH"}
        </button>
      {/if}

      <!-- Search Filter -->
      <div class="relative flex items-center">
        <input
          type="text"
          placeholder="FIND NODE..."
          bind:value={searchQuery}
          class="w-28 px-2 py-1 text-[11px] bg-neutral-950 border border-neutral-700 text-white rounded focus:outline-none focus:border-orange-400 placeholder:text-neutral-500"
        />
        {#if searchQuery}
          <button
            type="button"
            class="absolute right-1.5 text-neutral-400 hover:text-white text-[10px]"
            onclick={() => (searchQuery = "")}
          >
            ✕
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Telemetry Bar -->
  <div
    class="flex items-center justify-between px-4 py-1.5 bg-black/85 border-b border-orange-600/30 text-[11px] text-neutral-200"
  >
    <div class="flex items-center gap-4 flex-wrap">
      <div>
        <span class="text-neutral-400">TOTAL NODES:</span>
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
  </div>
</div>
