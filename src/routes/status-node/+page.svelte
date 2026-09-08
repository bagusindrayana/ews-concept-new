<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { xmlToJson, type JsonNode } from "$lib/xmlUtils";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import { mapStore } from "$lib/stores/mapStore.svelte";
  import { fdsnFetch } from "$lib/utils/fdsnFetch";
  import MagiBusBoard from "$lib/components/MagiBusBoard.svelte";
  import MagiBusControls from "$lib/components/MagiBusControls.svelte";

  interface StationStatusItem {
    id: string;
    title: string;
    status: string; // 'ACTIVE' | 'OFFLINE'
    type: string;
    stationCode: string;
    networkCode: string;
    site: string;
  }

  // Authentic initial fallback stations (Indonesian BMKG & GEOFON network)
  // Ensures immediate rich rendering even while FDSN query is pending
  const INITIAL_STATIONS: StationStatusItem[] = [
    // Bank 1: Diagonal Core Synapses
    { id: "GE-JAGI", title: "GE-JAGI", status: "ACTIVE", type: "normal", stationCode: "JAGI", networkCode: "GE", site: "Jatiwangi, Java" },
    { id: "GE-TNTI", title: "GE-TNTI", status: "ACTIVE", type: "normal", stationCode: "TNTI", networkCode: "GE", site: "Ternate, Maluku" },
    { id: "IA-BKB", title: "IA-BKB", status: "ACTIVE", type: "normal", stationCode: "BKB", networkCode: "IA", site: "Bukit Tinggi, Sumatra" },
    { id: "IA-BBJI", title: "IA-BBJI", status: "OFFLINE", type: "danger", stationCode: "BBJI", networkCode: "IA", site: "Banjarnegara, Java" },
    { id: "GE-UGM", title: "GE-UGM", status: "ACTIVE", type: "normal", stationCode: "UGM", networkCode: "GE", site: "Yogyakarta, Java" },
    { id: "IA-KAPI", title: "IA-KAPI", status: "OFFLINE", type: "danger", stationCode: "KAPI", networkCode: "IA", site: "Kappang, Sulawesi" },
    { id: "IA-SMRI", title: "IA-SMRI", status: "ACTIVE", type: "normal", stationCode: "SMRI", networkCode: "IA", site: "Semarang, Java" },
    { id: "GE-FAKI", title: "GE-FAKI", status: "OFFLINE", type: "danger", stationCode: "FAKI", networkCode: "GE", site: "Fakfak, Papua" },
    { id: "GE-PLAI", title: "GE-PLAI", status: "ACTIVE", type: "normal", stationCode: "PLAI", networkCode: "GE", site: "Pelabuhan Ratu, Java" },
    { id: "IA-CISI", title: "IA-CISI", status: "ACTIVE", type: "normal", stationCode: "CISI", networkCode: "IA", site: "Cisompet, Garut" },
    { id: "IA-SWI", title: "IA-SWI", status: "ACTIVE", type: "normal", stationCode: "SWI", networkCode: "IA", site: "Sawahan, Java" },
    { id: "GE-SOEI", title: "GE-SOEI", status: "OFFLINE", type: "danger", stationCode: "SOEI", networkCode: "GE", site: "Soe, Timor" },
    { id: "IA-GSI", title: "IA-GSI", status: "ACTIVE", type: "normal", stationCode: "GSI", networkCode: "IA", site: "Gunungsitoli, Nias" },

    // Bank 2: Horizontal Seismic Transceivers
    { id: "GE-LHMI", title: "GE-LHMI", status: "ACTIVE", type: "normal", stationCode: "LHMI", networkCode: "GE", site: "Lhokseumawe, Aceh" },
    { id: "IA-BNDI", title: "IA-BNDI", status: "ACTIVE", type: "normal", stationCode: "BNDI", networkCode: "IA", site: "Banda Neira, Maluku" },
    { id: "IA-AAI", title: "IA-AAI", status: "OFFLINE", type: "danger", stationCode: "AAI", networkCode: "IA", site: "Arso, Papua" },
    { id: "GE-BND", title: "GE-BND", status: "ACTIVE", type: "normal", stationCode: "BND", networkCode: "GE", site: "Banda Sea Array" },
    { id: "IA-PMBI", title: "IA-PMBI", status: "ACTIVE", type: "normal", stationCode: "PMBI", networkCode: "IA", site: "Palembang, Sumatra" },
    { id: "IA-JMB", title: "IA-JMB", status: "OFFLINE", type: "danger", stationCode: "JMB", networkCode: "IA", site: "Jambi Observation" },
    { id: "GE-MMRI", title: "GE-MMRI", status: "OFFLINE", type: "danger", stationCode: "MMRI", networkCode: "GE", site: "Maumere, Flores" },
    { id: "IA-TRTI", title: "IA-TRTI", status: "ACTIVE", type: "normal", stationCode: "TRTI", networkCode: "IA", site: "Tolitoli, Sulawesi" },
    { id: "IA-LUWI", title: "IA-LUWI", status: "OFFLINE", type: "danger", stationCode: "LUWI", networkCode: "IA", site: "Luwuk, Banggai" },
    { id: "GE-TOLI2", title: "GE-TOLI2", status: "ACTIVE", type: "normal", stationCode: "TOLI2", networkCode: "GE", site: "Toli-Toli Coastal" },
    { id: "IA-GENI", title: "IA-GENI", status: "ACTIVE", type: "normal", stationCode: "GENI", networkCode: "IA", site: "Genteng, Banyuwangi" },
    { id: "IA-KLI", title: "IA-KLI", status: "OFFLINE", type: "danger", stationCode: "KLI", networkCode: "IA", site: "Kotabumi, Lampung" },
    { id: "GE-MEDA", title: "GE-MEDA", status: "OFFLINE", type: "danger", stationCode: "MEDA", networkCode: "GE", site: "Medan Geophysics" },
    { id: "IA-PDSI", title: "IA-PDSI", status: "ACTIVE", type: "normal", stationCode: "PDSI", networkCode: "IA", site: "Padang Sidempuan" },
    { id: "IA-SANI", title: "IA-SANI", status: "OFFLINE", type: "danger", stationCode: "SANI", networkCode: "IA", site: "Sanana, Maluku" },
    { id: "GE-BKNI", title: "GE-BKNI", status: "OFFLINE", type: "danger", stationCode: "BKNI", networkCode: "GE", site: "Bangka Belitung" },
    { id: "IA-GLMI", title: "IA-GLMI", status: "ACTIVE", type: "normal", stationCode: "GLMI", networkCode: "IA", site: "Galela, Halmahera" },
    { id: "GE-WSI", title: "GE-WSI", status: "ACTIVE", type: "normal", stationCode: "WSI", networkCode: "GE", site: "Waingapu, Sumba" },
  ];

  let statuses = $state<StationStatusItem[]>([...INITIAL_STATIONS]);
  let selectedStation = $state<StationStatusItem | null>(INITIAL_STATIONS[0]);
  let searchQuery = $state("");
  let isSimulating = $state(false);
  let simulationInterval: any = null;
  let activeBankIndex = $state(0);

  // Pagination for large station lists (> 31)
  const STATIONS_PER_BANK = 31;
  let totalBanks = $derived(Math.max(1, Math.ceil(statuses.length / STATIONS_PER_BANK)));
  let currentBankStations = $derived(
    statuses.slice(activeBankIndex * STATIONS_PER_BANK, (activeBankIndex + 1) * STATIONS_PER_BANK)
  );

  // Live Telemetry Stats
  let totalCount = $derived(statuses.length);
  let connectedCount = $derived(statuses.filter((s) => s.status === "ACTIVE").length);
  let severedCount = $derived(totalCount - connectedCount);
  let syncPercentage = $derived(
    totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0
  );

  // Fetch live FDSN station status
  async function fetchStatuses() {
    try {
      const stationResults = await Promise.allSettled(
        mapStore.dataSources.map(async (source) => {
          const url = `${source.baseUrl}/fdsnws/station/1/query?${mapStore.urlParams}&level=station&nodata=404&channel=BH?,SH?`;
          const response = await fdsnFetch(url, "/api/fdsn/station");
          if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
          return xmlToJson(await response.text());
        }),
      );

      const el = document.getElementById("loading-screen");
      if (el) el.style.display = "none";

      const fetchedList: StationStatusItem[] = [];

      stationResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Gagal mengambil data station:", result.reason);
          return;
        }

        const fdsn = result.value.FDSNStationXML as JsonNode;
        const networksList = fdsn?.Network as JsonNode[];
        const networks = Array.isArray(networksList)
          ? networksList
          : networksList
            ? [networksList]
            : [];

        networks.forEach((networkNode) => {
          const netCode = (networkNode["@attributes"] as any)?.code || "UNKNOWN";
          const stationsList = networkNode.Station as JsonNode[];
          const stations = Array.isArray(stationsList) ? stationsList : [stationsList];

          stations.forEach((stationNode) => {
            const staCode = (stationNode["@attributes"] as any)?.code || "UNKNOWN";
            const endDate = (stationNode["@attributes"] as any)?.endDate;
            const isOffline = Boolean(endDate);

            fetchedList.push({
              id: `${netCode}-${staCode}`,
              title: `${netCode}-${staCode}`,
              status: isOffline ? "OFFLINE" : "ACTIVE",
              type: isOffline ? "danger" : "normal",
              stationCode: `${staCode}`,
              networkCode: `${netCode}`,
              site: `${(stationNode["Site"] as any)?.Name || "UNKNOWN"}`,
            });
          });
        });
      });

      if (fetchedList.length > 0) {
        statuses = fetchedList;
        if (!selectedStation) {
          selectedStation = statuses[0];
        }
      }
    } catch (err) {
      console.warn("FDSN fetch error, using authentic station fallback:", err);
      const el = document.getElementById("loading-screen");
      if (el) el.style.display = "none";
    }
  }

  onMount(() => {
    fetchStatuses();
    const timer = setTimeout(() => {
      const el = document.getElementById("loading-screen");
      if (el) el.style.display = "none";
    }, 600);
    return () => clearTimeout(timer);
  });

  onDestroy(() => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }
  });

  // Toggling station status reactively
  function handleNodeToggle(item: any, isConnected: boolean) {
    const targetId = item.id || item.title || item.stationCode;
    const found = statuses.find(
      (s) => s.id === targetId || s.stationCode === item.stationCode || s.stationCode === item.label
    );
    if (found) {
      found.status = isConnected ? "ACTIVE" : "OFFLINE";
      found.type = isConnected ? "normal" : "danger";
      statuses = [...statuses];
      selectedStation = found;
    } else if (item) {
      item.status = isConnected ? "ACTIVE" : "OFFLINE";
      item.type = isConnected ? "normal" : "danger";
      selectedStation = item;
    }
  }

  function handleSelectNode(item: any) {
    const targetId = item.id || item.title || item.stationCode;
    const found = statuses.find(
      (s) => s.id === targetId || s.stationCode === item.stationCode || s.stationCode === item.label
    );
    selectedStation = found || item;
  }

  // Presets
  function connectAll() {
    statuses.forEach((s) => {
      s.status = "ACTIVE";
      s.type = "normal";
    });
    statuses = [...statuses];
  }

  function severAll() {
    statuses.forEach((s) => {
      s.status = "OFFLINE";
      s.type = "danger";
    });
    statuses = [...statuses];
  }

  function applyPresetImage2Severed() {
    // Preset matching reference Image 2
    const severedCodes = new Set([
      "BBJI", "KAPI", "FAKI", "SOEI", "AAI", "JMB", "MMRI", "LUWI", "KLI", "MEDA", "SANI", "BKNI"
    ]);
    statuses.forEach((s, idx) => {
      const isSevered = severedCodes.has(s.stationCode) || idx % 3 === 0;
      s.status = isSevered ? "OFFLINE" : "ACTIVE";
      s.type = isSevered ? "danger" : "normal";
    });
    statuses = [...statuses];
  }

  function toggleSimulation() {
    isSimulating = !isSimulating;
    if (isSimulating) {
      simulationInterval = setInterval(() => {
        if (statuses.length === 0) return;
        const randomIndex = Math.floor(Math.random() * statuses.length);
        const target = statuses[randomIndex];
        if (target) {
          const isCurrActive = target.status === "ACTIVE";
          target.status = isCurrActive ? "OFFLINE" : "ACTIVE";
          target.type = isCurrActive ? "danger" : "normal";
          statuses = [...statuses];
        }
      }, 700);
    } else {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
    }
  }
</script>

<svelte:head>
  <title>Station Status // MAGI BUS SWITCH</title>
</svelte:head>

<div class="min-h-screen py-1 md:py-4 flex flex-col items-center overflow-x-hidden overflow-y-auto font-mono bg-neutral-950 text-white">
  <!-- Fixed Navigation Bar -->
  <div
    class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-50 gap-2 pointer-events-none"
    style="width:fit-content;"
  >
    <a class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto shadow-lg" href="/">HOME</a>
    <a class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto shadow-lg" href="/status-map">STATION MAP</a>
    <a class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto shadow-lg" href="/magi">MAGI</a>
    <a class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto shadow-lg" href="/showcase">SHOWCASE</a>
  </div>

  <!-- Header Section with Evangelion Hazard Stripes -->
  <div class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative show-pop-up mt-8">
    <div class="overflow-hidden w-full max-w-5xl">
      <StripeBar loop={true} duration={20} color="red"></StripeBar>
      <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
        <h1 class="text-xl md:text-2xl p-1.5 font-bold ews-title danger uppercase bg-black tracking-widest border border-red-600/60 shadow-xl">
          MAGI BUS SWITCH // STATION STATUS
        </h1>
      </div>
    </div>
  </div>

  <div class="w-full h-1 bg-red-600/80 mb-3"></div>

  <!-- Main Content Layout Spanning Screen Width with Edge-to-Edge Circuit -->
  <div class="w-full max-w-[1440px] px-2 md:px-6 flex flex-col gap-4">
    <!-- Decoupled Cyber Deck HUD Control Strip -->
    <MagiBusControls
      {totalCount}
      {connectedCount}
      {severedCount}
      {syncPercentage}
      {isSimulating}
      bind:searchQuery
      onPresetAllConnected={connectAll}
      onPresetImage2={applyPresetImage2Severed}
      onConnectAll={connectAll}
      onSeverAll={severAll}
      onToggleSimulation={toggleSimulation}
      className="shadow-xl"
    />

    <!-- Bank Switcher Tabs if stations exceed single board limit -->
    {#if totalBanks > 1}
      <div class="flex items-center justify-between px-3 py-1.5 bg-black/80 border border-neutral-800 rounded text-xs font-mono">
        <span class="text-neutral-400">SELECT TELEMETRY BANK:</span>
        <div class="flex items-center gap-1.5">
          {#each Array(totalBanks) as _, bankIdx}
            <button
              type="button"
              class="px-2.5 py-1 rounded transition-colors {activeBankIndex === bankIdx
                ? 'bg-[#ff4e00] text-black font-bold border border-orange-400'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'}"
              onclick={() => (activeBankIndex = bankIdx)}
            >
              BANK {String.fromCharCode(65 + bankIdx)} (CH {bankIdx * STATIONS_PER_BANK + 1}-{Math.min((bankIdx + 1) * STATIONS_PER_BANK, totalCount)})
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Pure Authentic MAGI Bus Circuit Board -->
    <div class="relative w-full shadow-2xl rounded-md overflow-hidden border border-neutral-800">
      <MagiBusBoard
        items={currentBankStations}
        highlightQuery={searchQuery}
        activeNodeId={selectedStation?.stationCode || selectedStation?.id}
        onToggle={handleNodeToggle}
        onSelectNode={handleSelectNode}
      />
    </div>

    <!-- Station Inspector Bottom Panel -->
    {#if selectedStation}
      <div class="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-black/90 border border-neutral-800 rounded-md font-mono text-xs shadow-lg backdrop-blur">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex flex-col">
            <span class="text-[10px] text-neutral-500 uppercase tracking-wider">SELECTED STATION</span>
            <span class="text-lg font-bold text-orange-400 tracking-wider">
              {selectedStation.networkCode}-{selectedStation.stationCode}
            </span>
          </div>

          <div class="h-8 w-px bg-neutral-800 hidden sm:block"></div>

          <div class="flex flex-col">
            <span class="text-[10px] text-neutral-500 uppercase tracking-wider">SITE LOCATION</span>
            <span class="text-neutral-200 font-semibold">{selectedStation.site || "NERV SENSOR SITE"}</span>
          </div>

          <div class="h-8 w-px bg-neutral-800 hidden sm:block"></div>

          <div class="flex flex-col">
            <span class="text-[10px] text-neutral-500 uppercase tracking-wider">TELEMETRY LINK STATUS</span>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="w-2.5 h-2.5 rounded-full {selectedStation.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-600'}"></span>
              <span class="font-bold {selectedStation.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-500'}">
                {selectedStation.status === 'ACTIVE' ? 'ACTIVE // CONNECTED' : 'OFFLINE // SEVERED'}
              </span>
            </div>
          </div>
        </div>

        <!-- Manual Action for this station -->
        <button
          type="button"
          class="px-4 py-2 rounded font-bold transition-all {selectedStation.status === 'ACTIVE'
            ? 'bg-rose-950 border border-rose-600 text-rose-300 hover:bg-rose-900'
            : 'bg-emerald-950 border border-emerald-500 text-emerald-300 hover:bg-emerald-900'}"
          onclick={() => {
            if (selectedStation) handleNodeToggle(selectedStation, selectedStation.status !== 'ACTIVE');
          }}
        >
          {selectedStation.status === 'ACTIVE' ? 'SEVER THIS STATION (PUTUSKAN)' : 'CONNECT THIS STATION (HUBUNGKAN)'}
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- LOADING SCREEN -->
<div
  class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-40 bg-black/85 backdrop-blur"
  id="loading-screen"
>
  <span class="loader"></span>
  <p class="my-2 red-color p-2 font-mono text-xs tracking-wider">
    SYNCHRONIZING WITH GEOFON & BMKG SEISMIC NETWORK...
  </p>
</div>
