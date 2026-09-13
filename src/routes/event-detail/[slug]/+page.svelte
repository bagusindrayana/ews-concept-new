<script lang="ts">
  import { onMount } from 'svelte';
  import StripeBar from '$lib/components/StripeBar.svelte';
  import MagiBusBoard from '$lib/components/MagiBusBoard.svelte';
  import ContourMapCanvas from '$lib/components/ContourMapCanvas.svelte';
  import {
    loadEarthquakeDetail,
    type EarthquakeDetailInfo,
    type StationItem
  } from '$lib/utils/mmiParser';

  let { data }: { data: { slug: string } } = $props();

  let isLoading = $state(true);
  let errorMsg = $state('');
  let eqInfo = $state<EarthquakeDetailInfo>({
    id: '',
    mag: 5.9,
    lat: -5.81,
    lng: 106.56,
    depth: '376 Km',
    place: 'Kepulauan Seribu',
    time: '2026-09-12 04:23:56 WIB',
    sourceType: 'mmi_stationlist',
    stations: []
  });

  let selectedStation = $state<StationItem | null>(null);
  let searchQuery = $state('');
  let activeTab = $state<'board' | 'table'>('board');

  let activeSlug = '';
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
    eqInfo.stations.filter((s) => s.status === 'ACTIVE').length
  );
  let severedCount = $derived(totalCount - activeCount);
  let syncPercentage = $derived(
    totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0
  );

  let filteredStations = $derived(
    searchQuery.trim()
      ? eqInfo.stations.filter(
          (s) =>
            s.stationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.mmi.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : eqInfo.stations
  );

  async function loadData(slug: string) {
    if (!slug) return;
    isLoading = true;
    errorMsg = '';
    try {
      const detail = await loadEarthquakeDetail(slug);
      eqInfo = detail;
      if (detail.stations.length > 0) {
        selectedStation = detail.stations[0];
      }
    } catch (err: any) {
      console.error('Failed to load earthquake detail:', err);
      errorMsg = err.message || 'Gagal memuat detail gempa bumi';
    } finally {
      isLoading = false;
    }
  }

  function handleSelectNode(item: any) {
    const staCode = item.stationCode || item.label || item.id;
    const found = eqInfo.stations.find(
      (s) => s.stationCode === staCode || s.id === item.id
    );
    selectedStation = found || item;
  }

  function handleToggleNode(item: any, isConnected: boolean) {
    const staCode = item.stationCode || item.label || item.id;
    const found = eqInfo.stations.find(
      (s) => s.stationCode === staCode || s.id === item.id
    );
    if (found) {
      found.status = isConnected ? 'ACTIVE' : 'OFFLINE';
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

<div class="min-h-screen bg-neutral-950 text-white font-mono flex flex-col">
  <!-- Top Navigation & Alert Header -->
  <header class="w-full bg-black border-b border-neutral-800 z-30 sticky top-0">
    <!-- Hazard Stripe Top Line -->
    <div class="overflow-hidden w-full h-[4px]">
      <StripeBar loop={true} duration={25} color="red" size="4px"></StripeBar>
    </div>

    <!-- Main Navigation Bar -->
    <div
      class="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      <!-- Title & Event Badge -->
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="px-2.5 py-1 text-xs font-bold bg-red-950 hover:bg-red-900 text-red-300 border border-red-600 rounded transition flex items-center gap-1.5"
        >
          <span>◀</span>
          <span>HOME</span>
        </a>

        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 text-xs font-black tracking-widest bg-red-600 text-black uppercase"
          >
            EVENT DETAIL
          </span>
          <span class="text-xs text-neutral-400 font-bold tracking-wider">
            #{eqInfo.id}
          </span>
        </div>

        {#if eqInfo.sourceType === 'mmi_stationlist'}
          <span
            class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 rounded"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            BMKG MMI STATIONLIST
          </span>
        {:else}
          <span
            class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-amber-950/80 border border-amber-500/60 text-amber-300 rounded"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            SENSOR GLOBAL FALLBACK (31 CLOSEST)
          </span>
        {/if}
      </div>

      <!-- Quick Nav links -->
      <div class="flex items-center gap-2 text-xs">
        <a
          href="/status-node"
          class="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded transition"
        >
          STATUS NODE
        </a>
        <a
          href="/status-map"
          class="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded transition"
        >
          STATION MAP
        </a>
      </div>
    </div>

    <!-- Earthquake Telemetry Header Banner -->
    <div class="bg-neutral-900/90 border-t border-neutral-800 px-3 sm:px-6 py-2">
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
              {Math.abs(eqInfo.lat).toFixed(2)}°{eqInfo.lat < 0 ? 'S' : 'N'}, {Math.abs(
                eqInfo.lng
              ).toFixed(2)}°{eqInfo.lng < 0 ? 'W' : 'E'}
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
  </header>

  <!-- Main 2-Column Layout (30% / 70% Proportion) -->
  <main class="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
    <!-- ============================================================== -->
    <!-- KOLOM KIRI (30%): PETA CANVAS KONTUR DARATAN & KEDALAMAN LAUT  -->
    <!-- ============================================================== -->
    <section
      class="w-full lg:w-[30%] flex flex-col gap-3 min-w-[320px] max-w-full lg:max-w-[32%]"
    >
      <!-- Section Header -->
      <div
        class="flex items-center justify-between px-3 py-2 bg-black border border-neutral-800 rounded-t"
      >
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
          <h2 class="text-xs font-bold tracking-widest text-emerald-400 uppercase">
            PETA KONTUR TOPOGRAFI & BATIMETRI
          </h2>
        </div>
        <span class="text-[10px] text-neutral-400">CANVAS 2D</span>
      </div>

      <!-- Canvas Contour Map Component -->
      <div class="h-[480px] lg:h-[540px] w-full flex-shrink-0 relative overflow-hidden">
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
      </div>

      <!-- Epicenter Tactical Info Card -->
      <div class="p-3 bg-neutral-900/80 border border-neutral-800 rounded text-xs">
        <div class="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
          <span class="text-[11px] font-bold text-red-400 tracking-wider">
            EPISENTER SUMMARY
          </span>
          <span class="text-[10px] text-neutral-400">{eqInfo.depth} DEPTH</span>
        </div>

        <table class="w-full text-[11px]">
          <tbody>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Wilayah</td>
              <td class="py-1 text-right text-neutral-200 font-semibold truncate max-w-[180px]">
                {eqInfo.place}
              </td>
            </tr>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Latitude</td>
              <td class="py-1 text-right text-neutral-200">
                {eqInfo.lat.toFixed(4)}° ({Math.abs(eqInfo.lat).toFixed(2)}°{eqInfo.lat < 0
                  ? 'LS'
                  : 'LU'})
              </td>
            </tr>
            <tr class="border-b border-neutral-800/40">
              <td class="py-1 text-neutral-400">Longitude</td>
              <td class="py-1 text-right text-neutral-200">
                {eqInfo.lng.toFixed(4)}° ({Math.abs(eqInfo.lng).toFixed(2)}°{eqInfo.lng < 0
                  ? 'BB'
                  : 'BT'})
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
    <section class="w-full lg:w-[70%] flex flex-col gap-3 flex-1">
      <!-- Section Controls & Telemetry Header -->
      <div
        class="bg-black border border-neutral-800 rounded p-3 flex flex-wrap items-center justify-between gap-3"
      >
        <!-- Telemetry Sync Stats -->
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

        <!-- Search & View Toggle Buttons -->
        <div class="flex items-center gap-2 text-xs">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Cari kode/nama stasiun..."
            class="px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-neutral-200 placeholder-neutral-500 rounded text-xs focus:outline-none focus:border-orange-500 w-48 sm:w-56"
          />

          <div class="flex border border-neutral-700 rounded overflow-hidden">
            <button
              onclick={() => (activeTab = 'board')}
              class="px-2.5 py-1 transition {activeTab === 'board'
                ? 'bg-orange-600 text-black font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
            >
              MAGI BOARD
            </button>
            <button
              onclick={() => (activeTab = 'table')}
              class="px-2.5 py-1 transition {activeTab === 'table'
                ? 'bg-orange-600 text-black font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'}"
            >
              MATRIX TABLE
            </button>
          </div>
        </div>
      </div>

      <!-- Selected Station Telemetry Inspector HUD -->
      {#if selectedStation}
        <div
          class="p-3 bg-neutral-900/90 border border-neutral-800 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 flex items-center justify-center font-bold text-sm rounded border {selectedStation.status ===
              'ACTIVE'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-600'
                : 'bg-rose-950 text-rose-400 border-rose-600'}"
            >
              {selectedStation.stationCode}
            </div>

            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-neutral-100 text-sm">
                  {selectedStation.site}
                </span>
                <span class="text-[10px] px-1.5 py-0.2 bg-neutral-800 text-neutral-300 rounded">
                  {selectedStation.networkCode}
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.2 rounded font-bold {selectedStation.status ===
                  'ACTIVE'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : 'bg-rose-950 text-rose-300 border border-rose-600'}"
                >
                  {selectedStation.status}
                </span>
              </div>
              <div class="text-[11px] text-neutral-400 mt-0.5">
                JARAK KE EPISENTER:
                <span class="text-amber-400 font-bold">
                  {selectedStation.distance} km
                </span>
                | KOORDINAT:
                <span class="text-neutral-300">
                  {selectedStation.lat.toFixed(3)}°, {selectedStation.lng.toFixed(3)}°
                </span>
              </div>
            </div>
          </div>

          <!-- MMI & PGA Telemetry Pill Badges -->
          <div class="flex flex-wrap items-center gap-2 text-[11px]">
            {#if selectedStation.mmi && selectedStation.mmi !== '-'}
              <div class="px-2 py-1 bg-amber-950/80 border border-amber-500 rounded flex items-center gap-1.5">
                <span class="text-neutral-400">INTENSITAS MMI:</span>
                <span class="text-amber-300 font-black text-xs">
                  {selectedStation.mmi}
                </span>
              </div>
            {/if}

            {#if selectedStation.pgaEw !== null}
              <div class="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded">
                <span class="text-neutral-500">PGA-EW:</span>
                <span class="text-neutral-200 font-mono font-bold">
                  {selectedStation.pgaEw.toFixed(3)} gal
                </span>
              </div>
            {/if}

            {#if selectedStation.pgaNs !== null}
              <div class="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded">
                <span class="text-neutral-500">PGA-NS:</span>
                <span class="text-neutral-200 font-mono font-bold">
                  {selectedStation.pgaNs.toFixed(3)} gal
                </span>
              </div>
            {/if}

            {#if selectedStation.pgaUd !== null}
              <div class="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded">
                <span class="text-neutral-500">PGA-UD:</span>
                <span class="text-neutral-200 font-mono font-bold">
                  {selectedStation.pgaUd.toFixed(3)} gal
                </span>
              </div>
            {/if}

            {#if selectedStation.siteClass && selectedStation.siteClass !== '-'}
              <div class="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded">
                <span class="text-neutral-500">SITE:</span>
                <span class="text-neutral-200 font-bold font-mono">
                  {selectedStation.siteClass}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Main Station Content Display Area -->
      <div class="flex-1 w-full relative min-h-[480px]">
        {#if isLoading}
          <div
            class="w-full h-96 flex flex-col items-center justify-center gap-3 bg-neutral-900/60 border border-neutral-800 rounded"
          >
            <div
              class="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
            ></div>
            <span class="text-xs tracking-wider text-orange-400 font-bold animate-pulse">
              LOADING 31 SEISMIC STATIONS TELEMETRY...
            </span>
          </div>
        {:else if activeTab === 'board'}
          <!-- TAB 1: AUTHENTIC MAGI BUS CIRCUIT BOARD (Matching status-node/+page.svelte) -->
          <div
            class="relative w-full overflow-hidden border border-neutral-800 rounded bg-[#fc5706]"
          >
            <MagiBusBoard
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
            />
          </div>
        {:else}
          <!-- TAB 2: TELEMETRY MATRIX TABLE -->
          <div
            class="w-full overflow-x-auto bg-neutral-900 border border-neutral-800 rounded"
          >
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-black text-[11px] text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
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
                    <td class="p-2 font-bold text-orange-400">{sta.stationCode}</td>
                    <td class="p-2 font-sans truncate max-w-[220px]" title={sta.site}>
                      {sta.site}
                    </td>
                    <td class="p-2 text-neutral-300">{sta.distance} km</td>
                    <td class="p-2 text-center">
                      {#if sta.mmi && sta.mmi !== '-'}
                        <span class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]">
                          {sta.mmi}
                        </span>
                      {:else}
                        <span class="text-neutral-600">-</span>
                      {/if}
                    </td>
                    <td class="p-2 text-right">
                      {sta.pgaEw !== null ? sta.pgaEw.toFixed(3) : '-'}
                    </td>
                    <td class="p-2 text-right">
                      {sta.pgaNs !== null ? sta.pgaNs.toFixed(3) : '-'}
                    </td>
                    <td class="p-2 text-right">
                      {sta.pgaUd !== null ? sta.pgaUd.toFixed(3) : '-'}
                    </td>
                    <td class="p-2 text-center text-neutral-400">
                      {sta.siteClass || '-'}
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
    </section>
  </main>
</div>
