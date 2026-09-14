<script lang="ts">
  import { onMount } from "svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import MagiBusBoard from "$lib/components/MagiBusBoard.svelte";
  import ContourMapCanvas from "$lib/components/ContourMapCanvas.svelte";
  import {
    loadEarthquakeDetail,
    type EarthquakeDetailInfo,
    type StationItem,
  } from "$lib/utils/mmiParser";
  import MentalToxicityLevel from "$lib/components/MentalToxicityLevel.svelte";
  import { type NetworkData } from "$lib/components/MentalToxicityLevel.svelte";
  import Card from "$lib/components/Card.svelte";

  let { data }: { data: { slug: string } } = $props();

  let isLoading = $state(true);
  let isDataLoaded = $state(false);
  let errorMsg = $state("");
  let eqInfo = $state<EarthquakeDetailInfo>({
    id: "",
    mag: 5.9,
    lat: -5.81,
    lng: 106.56,
    depth: "376 Km",
    place: "Memuat data gempa...",
    time: "...",
    sourceType: "mmi_stationlist",
    stations: [],
  });

  let selectedStation = $state<StationItem | null>(null);
  let searchQuery = $state("");
  let activeTab = $state<"board" | "table">("board");

  let stationList = $state<NetworkData[]>([]);

  let activeSlug = "";
  $effect(() => {
    const slug = data.slug;
    if (slug && slug !== activeSlug) {
      activeSlug = slug;
      loadData(slug);
    }
  });

  // Metrics derived from stations
  let totalCount = $derived(eqInfo.stations.length);
  let activeCount = $derived(
    eqInfo.stations.filter((s) => s.status === "ACTIVE").length,
  );
  let severedCount = $derived(totalCount - activeCount);
  let syncPercentage = $derived(
    totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0,
  );

  let filteredStations = $derived(
    searchQuery.trim()
      ? eqInfo.stations.filter(
          (s) =>
            s.stationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.mmi.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : eqInfo.stations,
  );

  function romanToNumber(roman: string) {
    const values: Record<string, number> = {
      I: 1,
      V: 5,
      X: 10,
      L: 50,
      C: 100,
      D: 500,
      M: 1000,
    };

    let result = 0;

    for (let i = 0; i < roman.length; i++) {
      const current = values[roman[i]];
      const next = values[roman[i + 1]];

      if (current < next) {
        result -= current;
      } else {
        result += current;
      }
    }

    return result;
  }

  async function loadData(slug: string) {
    if (!slug) return;
    isLoading = true;
    isDataLoaded = false;
    errorMsg = "";
    try {
      const detail = await loadEarthquakeDetail(slug);
      eqInfo = detail;
      isDataLoaded = true;
      if (detail.stations.length > 0) {
        selectedStation = detail.stations[0];
      }

      for (const station of eqInfo.stations) {
        stationList.push({
          id: station.id,
          name: station.stationCode,
          subject_name: `MMI : ${station.mmi}`,
          subject_label: station.networkCode,
          active_channel: 10 - romanToNumber(station.mmi),
          inactive_channel: romanToNumber(station.mmi),
          total_channel: 10,
        });
      }
    } catch (err: any) {
      console.error("Failed to load earthquake detail:", err);
      errorMsg = err.message || "Gagal memuat detail gempa bumi";
    } finally {
      isLoading = false;
    }
  }

  function handleSelectNode(item: any) {
    const staCode = item.stationCode || item.label || item.id;
    const found = eqInfo.stations.find(
      (s) => s.stationCode === staCode || s.id === item.id,
    );
    selectedStation = found || item;
  }

  function handleToggleNode(item: any, isConnected: boolean) {
    const staCode = item.stationCode || item.label || item.id;
    const found = eqInfo.stations.find(
      (s) => s.stationCode === staCode || s.id === item.id,
    );
    if (found) {
      found.status = isConnected ? "ACTIVE" : "OFFLINE";
      found.connected = isConnected;
      eqInfo.stations = [...eqInfo.stations];
      selectedStation = found;
    }
  }
</script>

<svelte:head>
  <title>
    EVENT #{data.slug} // MAG {eqInfo.mag} - {eqInfo.place} // NERV EWS
  </title>
</svelte:head>

<div
  class="min-h-screen bg-neutral-950 text-white font-mono flex flex-col py-1 md:py-4"
>
  <!-- Top Navigation & Alert Header -->
  <!-- <header class="w-full bg-black border-b border-neutral-800 z-30 sticky top-0">
    <div
      class="bg-neutral-900/90 border-t border-neutral-800 px-3 sm:px-6 py-2"
    >
      <div
        class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs"
      >
        <div class="flex flex-wrap items-center gap-4 sm:gap-6">
          <div class="flex items-center gap-1.5">
            <span class="text-neutral-400">MAGNITUDE:</span>
            <span class="text-red-400 font-black text-sm sm:text-base">
              M {Number(eqInfo.mag).toFixed(1)}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-neutral-400">KEDALAMAN:</span>
            <span class="text-orange-400 font-bold">{eqInfo.depth}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-neutral-400">KOORDINAT:</span>
            <span class="text-neutral-200">
              {Math.abs(eqInfo.lat).toFixed(2)}°{eqInfo.lat < 0 ? "S" : "N"}, {Math.abs(
                eqInfo.lng,
              ).toFixed(2)}°{eqInfo.lng < 0 ? "W" : "E"}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-neutral-400">LOKASI:</span>
            <span class="text-neutral-100 font-semibold">{eqInfo.place}</span>
          </div>
        </div>

        <div class="text-[11px] text-neutral-400">
          WAKTU: <span class="text-neutral-200">{eqInfo.time}</span>
        </div>
      </div>
    </div>
  </header> -->

  <div
    class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-100 gap-2 pointer-events-none"
    style="width:fit-content"
  >
    <a
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      href="/">HOME</a
    >
  </div>
  <div
    class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative show-pop-up mt-6"
  >
    <div class="overflow-hidden">
      <StripeBar loop={true} duration={20} color="red"></StripeBar>
      <div
        class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
      >
        <h1
          class="text-xl p-1 font-bold ews-title text-3xl danger uppercase bg-black"
        >
          EPICENTER MAP
        </h1>
      </div>
    </div>
  </div>

  <!-- Main 2-Column Layout (30% / 70% Proportion) -->
  <main class="flex-1 w-full mx-auto flex flex-col lg:flex-row gap-4">
    <!-- ============================================================== -->
    <!-- KOLOM KIRI (30%): PETA CANVAS KONTUR DARATAN & KEDALAMAN LAUT  -->
    <!-- ============================================================== -->
    <section
      class="w-full lg:w-[50%] flex flex-col gap-3 min-w-[320px] max-w-full lg:max-w-[50%]"
    >
      <Card className="w-full">
        {#snippet title()}
          <h1>EPICENTER MAP</h1>
        {/snippet}
        <!-- Canvas Contour Map Component -->
        <div
          class="h-[480px] lg:h-[540px] w-full flex-shrink-0 relative overflow-hidden"
        >
          {#if isDataLoaded}
            <ContourMapCanvas
              lat={eqInfo.lat}
              lng={eqInfo.lng}
              mag={eqInfo.mag}
              depth={eqInfo.depth}
              place={eqInfo.place}
              stations={eqInfo.stations}
              {selectedStation}
              onSelectStation={(sta) => {
                selectedStation = sta;
              }}
            />
          {:else}
            <div
              class="w-full h-full flex flex-col items-center justify-center bg-black/70 border border-neutral-800 rounded font-mono text-xs gap-3"
            >
              <div
                class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
              ></div>
              <span class="text-neutral-400 animate-pulse tracking-wider">
                MEMUAT TELEMETRI KONTUR...
              </span>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Epicenter Tactical Info Card -->
      <div
        class="p-3 bg-neutral-900/80 border border-neutral-800 rounded text-xs"
      >
        <div
          class="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2"
        >
          <span class="text-[11px] font-bold text-red-400 tracking-wider">
            EPISENTER SUMMARY
          </span>
          <span class="text-[10px] text-neutral-400">{eqInfo.depth} DEPTH</span>
        </div>

        <table class="w-full text-[11px]">
          <tbody>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Wilayah</td>
              <td
                class="py-1 text-right text-neutral-200 font-semibold truncate max-w-[180px]"
              >
                {eqInfo.place}
              </td>
            </tr>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Latitude</td>
              <td class="py-1 text-right text-neutral-200">
                {eqInfo.lat.toFixed(4)}° ({Math.abs(eqInfo.lat).toFixed(
                  2,
                )}°{eqInfo.lat < 0 ? "LS" : "LU"})
              </td>
            </tr>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Longitude</td>
              <td class="py-1 text-right text-neutral-200">
                {eqInfo.lng.toFixed(4)}° ({Math.abs(eqInfo.lng).toFixed(
                  2,
                )}°{eqInfo.lng < 0 ? "BB" : "BT"})
              </td>
            </tr>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Magnitudo</td>
              <td class="py-1 text-right text-red-400 font-bold">
                {Number(eqInfo.mag).toFixed(1)} SR
              </td>
            </tr>
            <tr>
              <td class="py-1 text-neutral-400">Stasiun Terpantau</td>
              <td class="py-1 text-right text-emerald-400 font-bold">
                {eqInfo.stations.length} Stasiun (Maks. 31)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ============================================================== -->
    <!-- KOLOM KANAN (70%): LIST STASIUN GEMPA (MAGI BUS BOARD / TABLE) -->
    <!-- ============================================================== -->
    <section class="w-full lg:w-[50%] flex flex-col gap-3 flex-1">
      <!-- Section Controls & Telemetry Header -->
      <!-- <div
        class="bg-black border border-neutral-800 rounded p-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div class="flex flex-wrap items-center gap-4 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-neutral-400">TOTAL:</span>
            <span class="text-neutral-100 font-bold">{totalCount}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-neutral-400">ACTIVE:</span>
            <span class="text-emerald-400 font-bold">{activeCount}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-neutral-400">OFFLINE:</span>
            <span class="text-rose-400 font-bold">{severedCount}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-neutral-400">SYNC:</span>
            <span class="text-sky-400 font-bold">{syncPercentage}%</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Cari kode/nama stasiun..."
            class="px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-neutral-200 placeholder-neutral-500 rounded text-xs focus:outline-none focus:border-orange-500 w-48 sm:w-56"
          />

          <div class="flex border border-neutral-700 rounded overflow-hidden">
            <button
              onclick={() => (activeTab = "board")}
              class="px-2.5 py-1 transition {activeTab === 'board'
                ? 'bg-orange-600 text-black font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
            >
              MAGI BOARD
            </button>
            <button
              onclick={() => (activeTab = "table")}
              class="px-2.5 py-1 transition {activeTab === 'table'
                ? 'bg-orange-600 text-black font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
            >
              MATRIX TABLE
            </button>
          </div>
        </div>
      </div> -->

      <!-- Main Station Content Display Area -->
      <Card className="w-full">
        {#snippet title()}
          <div class="flex justify-between">
            <h1>INTENSITY STATION</h1>
            <div class="flex border border-neutral-700 rounded overflow-hidden">
              <button
                onclick={() => (activeTab = "board")}
                class="px-2.5 py-1 transition {activeTab === 'board'
                  ? 'bg-orange-600 text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
              >
                INTENSITY CHART
              </button>
              <button
                onclick={() => (activeTab = "table")}
                class="px-2.5 py-1 transition {activeTab === 'table'
                  ? 'bg-orange-600 text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
              >
                MATRIX TABLE
              </button>
            </div>
          </div>
        {/snippet}
        <div class="flex-1 w-full relative min-h-[480px]">
          {#if isLoading}
            <div
              class="w-full h-96 flex flex-col items-center justify-center gap-3 bg-neutral-900/60 border border-neutral-800 rounded"
            >
              <div
                class="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
              ></div>
              <span
                class="text-xs tracking-wider text-orange-400 font-bold animate-pulse"
              >
                LOADING SEISMIC STATIONS TELEMETRY...
              </span>
            </div>
          {:else if activeTab === "board"}
            <!-- TAB 1: AUTHENTIC MAGI BUS CIRCUIT BOARD (Matching status-node/+page.svelte) -->

            <div class="overflow-y-auto h-[80vh] custom-scrollbar w-full">
              <!-- <MagiBusBoard
              items={eqInfo.stations}
              maxColumns={2}
              revealDelayMs={10}
              resolveDelayMs={600}
              animateReveal={true}
              randomResolve={false}
              highlightQuery={searchQuery}
              activeNodeId={selectedStation?.stationCode || selectedStation?.id}
              onSelectNode={handleSelectNode}
              onToggle={handleToggleNode}
              minRows={1}
            /> -->
              <MentalToxicityLevel
                subjectLabel="INTENSITY"
                networks={stationList}
                percent_labels={[
                  { label: "I", value: 10 },
                  { label: "II", value: 20 },
                  { label: "III", value: 30 },
                  { label: "IV", value: 40 },
                  { label: "V", value: 50 },
                  { label: "VI", value: 60 },
                  { label: "VII", value: 70 },
                  { label: "VIII", value: 80 },
                  { label: "IX", value: 90 },
                  { label: "X", value: 100 },
                ]}
              />
            </div>
          {:else}
            <!-- TAB 2: TELEMETRY MATRIX TABLE -->
            <div
              class="w-full overflow-x-auto bg-neutral-900 border border-neutral-800 rounded"
            >
              <table class="w-full text-left text-xs border-collapse">
                <thead
                  class="bg-black text-[11px] text-neutral-400 border-b border-neutral-800 uppercase tracking-wider"
                >
                  <tr>
                    <th class="p-2.5 text-center">No</th>
                    <th class="p-2.5">IdSta</th>
                    <th class="p-2.5">Stasiun / Lokasi</th>
                    <th class="p-2.5">Jarak</th>
                    <th class="p-2.5 text-center">MMI</th>
                    <th class="p-2.5 text-right">PGA-EW</th>
                    <th class="p-2.5 text-right">PGA-NS</th>
                    <th class="p-2.5 text-right">PGA-UD</th>
                    <th class="p-2.5 text-center">Site</th>
                    <th class="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-800/60 font-mono">
                  {#each filteredStations as sta}
                    <tr
                      onclick={() => (selectedStation = sta)}
                      class="cursor-pointer transition hover:bg-neutral-800/80 {selectedStation?.stationCode ===
                      sta.stationCode
                        ? 'bg-orange-950/40 text-orange-200 border-l-2 border-l-orange-500'
                        : 'text-neutral-300'}"
                    >
                      <td class="p-2 text-center text-neutral-500">{sta.no}</td>
                      <td class="p-2 font-bold text-orange-400"
                        >{sta.stationCode}</td
                      >
                      <td
                        class="p-2 font-sans truncate max-w-[220px]"
                        title={sta.site}
                      >
                        {sta.site}
                      </td>
                      <td class="p-2 text-neutral-300">{sta.distance} km</td>
                      <td class="p-2 text-center">
                        {#if sta.mmi && sta.mmi !== "-"}
                          <span
                            class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]"
                          >
                            {sta.mmi}
                          </span>
                        {:else}
                          <span class="text-neutral-600">-</span>
                        {/if}
                      </td>
                      <td class="p-2 text-right">
                        {sta.pgaEw !== null ? sta.pgaEw.toFixed(3) : "-"}
                      </td>
                      <td class="p-2 text-right">
                        {sta.pgaNs !== null ? sta.pgaNs.toFixed(3) : "-"}
                      </td>
                      <td class="p-2 text-right">
                        {sta.pgaUd !== null ? sta.pgaUd.toFixed(3) : "-"}
                      </td>
                      <td class="p-2 text-center text-neutral-400">
                        {sta.siteClass || "-"}
                      </td>
                      <td class="p-2 text-center">
                        <span
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold {sta.status ===
                          'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-rose-950 text-rose-400'}"
                        >
                          {sta.status}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </Card>
    </section>
  </main>
</div>
