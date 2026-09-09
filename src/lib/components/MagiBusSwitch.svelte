<script lang="ts">
  import MagiBusBoard from "./MagiBusBoard.svelte";
  import MagiBusSingle from "./MagiBusSingle.svelte";
  import MagiBusRack, { type MagiRackItem } from "./MagiBusRack.svelte";
  import MagiBusControls from "./MagiBusControls.svelte";
  import { onDestroy } from "svelte";

  export interface MagiNodeItem {
    id: string;
    label: string;
    connected: boolean;
    bank: "diagonal" | "horizontal";
    traceIndex?: number;
    channelName?: string;
    category?: string;
    site?: string;
    networkCode?: string;
    stationCode?: string;
    [key: string]: any;
  }

  let {
    nodes: propNodes,
    variant = "board",
    maxColumns = 4,
    readonly = false,
    showControls = true,
    showTelemetry = true,
    className = "",
    onToggle,
  }: {
    nodes?: any[];
    variant?: "board" | "single" | "rack";
    maxColumns?: number;
    readonly?: boolean;
    showControls?: boolean;
    showTelemetry?: boolean;
    className?: string;
    onToggle?: (node: any, isConnected: boolean) => void;
  } = $props();

  // Internal state for board variant if propNodes not bound
  let items = $state<any[]>(propNodes ? [...propNodes] : []);
  let searchQuery = $state("");
  let isSimulating = $state(false);
  let simulationInterval: any = null;

  // Single switch mode state
  let singleConnected = $state(true);

  // Synchronize when propNodes changes
  $effect(() => {
    if (propNodes) {
      items = [...propNodes];
    }
  });

  const IMAGE_2_DISCONNECTED_IDS = new Set([
    "00130", "00132", "00135", "00136",
    "00225", "00228", "00229", "00231", "00234", "00235", "00237", "00238"
  ]);

  let totalCount = $derived(items.length > 0 ? items.length : 31);
  let connectedCount = $derived(
    items.length > 0
      ? items.filter((n) => (n.status ? n.status === "ACTIVE" : n.connected !== false)).length
      : 31
  );
  let severedCount = $derived(totalCount - connectedCount);
  let syncPercentage = $derived(
    totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 100
  );

  function applyPresetAllConnected() {
    items.forEach((n) => {
      if (n.status) n.status = "ACTIVE";
      n.connected = true;
    });
    items = [...items];
  }

  function applyPresetImage2Severed() {
    items.forEach((n) => {
      const isSevered = IMAGE_2_DISCONNECTED_IDS.has(n.id) || IMAGE_2_DISCONNECTED_IDS.has(n.label);
      if (n.status) n.status = isSevered ? "OFFLINE" : "ACTIVE";
      n.connected = !isSevered;
    });
    items = [...items];
  }

  function connectAll() {
    items.forEach((n) => {
      if (n.status) n.status = "ACTIVE";
      n.connected = true;
    });
    items = [...items];
  }

  function severAll() {
    items.forEach((n) => {
      if (n.status) n.status = "OFFLINE";
      n.connected = false;
    });
    items = [...items];
  }

  function toggleSimulation() {
    isSimulating = !isSimulating;
    if (isSimulating) {
      simulationInterval = setInterval(() => {
        if (items.length === 0) return;
        const randomIndex = Math.floor(Math.random() * items.length);
        const target = items[randomIndex];
        if (target) {
          const curr = target.status ? target.status === "ACTIVE" : target.connected !== false;
          if (target.status) target.status = curr ? "OFFLINE" : "ACTIVE";
          target.connected = !curr;
          items = [...items];
          if (onToggle) onToggle(target, !curr);
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
</script>

{#if variant === "board"}
  <div class="flex flex-col w-full {className}">
    {#if showControls}
      <MagiBusControls
        {totalCount}
        {connectedCount}
        {severedCount}
        {syncPercentage}
        {isSimulating}
        bind:columns={maxColumns}
        bind:searchQuery
        onPresetAllConnected={applyPresetAllConnected}
        onPresetImage2={applyPresetImage2Severed}
        onConnectAll={connectAll}
        onSeverAll={severAll}
        onToggleSimulation={toggleSimulation}
      />
    {/if}

    <MagiBusBoard
      {items}
      {maxColumns}
      {readonly}
      highlightQuery={searchQuery}
      {onToggle}
    />
  </div>

{:else if variant === "single"}
  <MagiBusSingle
    bind:connected={singleConnected}
    {readonly}
    onToggle={(isConn) => {
      if (onToggle) onToggle({ id: "SINGLE", label: "00130", connected: isConn }, isConn);
    }}
  />

{:else if variant === "rack"}
  <MagiBusRack
    items={items as MagiRackItem[]}
    {readonly}
    {className}
    {onToggle}
  />
{/if}
