<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { xmlToJson, type JsonNode } from "$lib/xmlUtils";

  // Dummy data for the status list
  let statuses = $state<
    {
      id: string;
      title: string;
      status: string;
      type: string;
      stationCode: string;
      networkCode: string;
    }[]
  >([]);

  // Jumlah branch responsive berdasarkan screen size
  let branchCount = $state(5);
  let windowWidth = $state(0);

  // Function untuk menentukan branch count berdasarkan screen width
  function getBranchCount(width: number): number {
    if (width < 768) return 1;
    if (width < 1024) return 2; // Mobile
    if (width < 1300) return 4; // Medium
    return 5; // Large
  }

  // Function untuk update branch count saat resize
  function handleResize() {
    windowWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    branchCount = getBranchCount(windowWidth);
  }

  // Membagi data ke dalam beberapa branch
  let chunkedStatuses = $derived.by(() => {
    if (statuses.length === 0) return [];
    // Batasi minimal 1 branch
    const count = Math.max(1, branchCount);

    const result = [];
    const itemsPerBranch = Math.ceil(statuses.length / count);

    for (let i = 0; i < statuses.length; i += itemsPerBranch) {
      result.push(statuses.slice(i, i + itemsPerBranch));
    }
    return result;
  });

  onMount(() => {
    // Inisialisasi branch count berdasarkan screen width saat mount
    handleResize();

    // https://geof.bmkg.go.id/fdsnws/station/1/
    // URL GEOFON (tanpa format=text agar mengembalikan XML)
    const url =
      "https://geofon.gfz-potsdam.de/fdsnws/station/1/query?minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&level=station";

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Gagal mengambil data jaringan");
        return response.text();
      })
      .then((xmlString) => {
        const el = document.getElementById("loading-screen");
        if (el) el.style.display = "none";
        const data = xmlToJson(xmlString);
        const fdsn = data.FDSNStationXML as JsonNode;
        const networksList = fdsn.Network as JsonNode[];

        // Handle both single network and multiple networks
        const networks = Array.isArray(networksList)
          ? networksList
          : [networksList];

        console.log("Ada hasil " + networks.length);
        setTimeout(() => {
          networks.forEach((networkNode) => {
            const netCode =
              (networkNode["@attributes"] as any)?.code || "UNKNOWN";
            const stationsList = networkNode.Station as JsonNode[];

            // Handle both single station and multiple stations
            const stations = Array.isArray(stationsList)
              ? stationsList
              : [stationsList];

            stations.forEach((stationNode) => {
              const staCode =
                (stationNode["@attributes"] as any)?.code || "UNKNOWN";
              const startDate = (stationNode["@attributes"] as any)?.startDate;
              const endDate = (stationNode["@attributes"] as any)?.endDate;

              statuses.push({
                id: `${netCode}-${staCode}`,
                title: `${netCode}-${staCode}`,
                status: endDate ? "OFFLINE" : "ACTIVE",
                type: endDate ? "danger" : "normal",
                stationCode: `${staCode}`,
                networkCode: `${netCode}`,
              });
            });
          });
        }, 1000);
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
        setTimeout(() => {
          const el = document.getElementById("loading-screen");
          if (el) el.style.display = "none";
        }, 1000);
      });

    // Tambahkan event listener untuk resize
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    // Hapus event listener saat component destroyed
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", handleResize);
    }
    console.log("Component destroyed");
  });
</script>

<svelte:head>
  <title>Status UI | Rib Cage Layout</title>
</svelte:head>

<div
  class="min-h-screen py-1 md:py-8 flex flex-col items-center overflow-x-hidden overflow-y-auto font-mono"
>
  <div
    class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative"
  >
    <div class="overflow-hidden">
      <div class="strip-wrapper h-12">
        <div
          class="strip-bar-red loop-strip anim-duration-10"
          style="height: 100%;"
        ></div>
        <div
          class="strip-bar-red loop-strip anim-duration-10"
          style="height: 100%;"
        ></div>
      </div>
      <div
        class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
      >
        <h1
          class="text-xl p-1 font-bold ews-title text-3xl danger uppercase bg-black"
        >
          Station Status
        </h1>
      </div>
    </div>
  </div>
  <div class="mb-2 w-full bordered text-center p-1 hidden md:block glow-all">
    <p class="text-black font-bold text-sm bg-primary p-4 uppercase">
      GEOFON STATION - FDSN (International Federation of Digital Seismograph
      Networks)
    </p>
  </div>
  <div class="w-full h-1 bg-primary glow-all"></div>
  <div
    class="inline-flex h-auto justify-center gap-4 w-full px-4 overflow-none relative"
  >
    {#each chunkedStatuses as branchStatuses, branchIndex}
      <div class="relative py-4 lg:py-10 flex flex-col gap-4">
        <!-- Central Spine -->
        <div
          class="absolute h-auto left-1/2 top-0 bottom-0 w-1 bg-primary transform -translate-x-1/2 z-0 line-central glow-all"
          style="animation-delay: {branchIndex * 200}ms;"
        ></div>

        <!-- Iterate in pairs essentially by grouping them two by two -->
        <div class="grid grid-cols-2 relative z-10">
          {#each branchStatuses as item, index}
            {#if index % 2 === 0}
              <!-- Left Item (Even index) -->
              <a
                href="/realtime?networkCode={item.networkCode}&stationCode={item.stationCode}"
                class="flex flex-grow justify-end items-center relative pr-0 col-start-1 node"
              >
                <div class="relative flex parent-node">
                  <!-- node -->
                  <div
                    class="status-node slide-fade-in {item.type === 'danger'
                      ? 'danger glow-red-small'
                      : 'glow-green-small'} w-24 h-6 flex flex-grow flex-col items-center justify-center relative mt-6 -mr-2 z-5 text-black text-xs font-bold"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  >
                    <!-- {item.type === "danger" ? item.status : ""} -->
                  </div>
                </div>
                <!-- Connecting Line to center -->
                <div class="w-24 flex justify-end relative line glow-all">
                  <div
                    class="h-[2px] w-24 bg-primary z-0 line-node"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  ></div>

                  <span
                    class="font-bold text-xs uppercase absolute left-2 z-10 text-left top-1 fade-in animation-delay-5 text-primary"
                  >
                    {item.title}
                  </span>
                </div>
              </a>
            {:else}
              <!-- Right Item (Odd index) -->
              <a
                href="/realtime?networkCode={item.networkCode}&stationCode={item.stationCode}"
                class="flex justify-start items-center relative pl-0 col-start-2 w-auto node-flip"
              >
                <!-- Connecting Line from center -->
                <div class="w-24 flex justify-start relative glow-all">
                  <div
                    class="h-[2px] w-24 bg-primary z-0 line-node"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  ></div>

                  <span
                    class="font-bold text-xs uppercase absolute z-10 right-2 text-right top-1 fade-in animation-delay-5 text-primary"
                  >
                    {item.title}
                  </span>
                </div>
                <div class="relative flex parent-node flip">
                  <!-- node -->
                  <div
                    class="status-node-flip slide-fade-in {item.type ===
                    'danger'
                      ? 'danger glow-red-small'
                      : 'glow-green-small'} w-24 h-6 flex flex-col items-center justify-center relative mt-6 -ml-2 z-5 text-black text-xs font-bold"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  >
                    <!-- {item.type === "danger" ? item.status : ""} -->
                  </div>
                </div>
              </a>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- LOADING SCREEN -->
<div
  class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-10 text-glow-red"
  id="loading-screen"
>
  <span class="loader"></span>
  <p class="my-2 red-color p-2">
    INI MERUPAKAN DESAIN KONSEP - DATA STATION DARI GEOFON
  </p>
</div>

<style>
  /* Ensure the grid rows naturally align left and right items on the same horizontal plane */
</style>
