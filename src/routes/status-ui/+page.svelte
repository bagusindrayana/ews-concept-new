<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  // Dummy data for the status list
  let statuses = $state<
    { id: string; title: string; status: string; type: string }[]
  >([]);

  // Jumlah branch yang diinginkan (bisa diubah oleh user)
  let branchCount = $state(5);

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
    // URL GEOFON (tanpa format=text agar mengembalikan XML)
    const url =
      "https://geofon.gfz-potsdam.de/fdsnws/station/1/query?minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&level=station";

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Gagal mengambil data jaringan");
        // 1. Ubah response dari server menjadi String Teks
        return response.text();
      })
      .then((xmlString) => {
        // 2. Parse string teks tadi menjadi XML Object
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // 3. Cari semua elemen <Network>
        const networks = xmlDoc.getElementsByTagName("Network");

        // Looping setiap Network
        for (let i = 0; i < networks.length; i++) {
          const netNode = networks[i];
          const netCode = netNode.getAttribute("code");

          // Cari semua elemen <Station> di dalam Network ini
          const stations = netNode.getElementsByTagName("Station");

          // Looping setiap Station
          for (let j = 0; j < stations.length; j++) {
            const staNode = stations[j];
            const staCode = staNode.getAttribute("code");

            // Ambil atribut penting
            const startDate = staNode.getAttribute("startDate");
            const endDate = staNode.getAttribute("endDate"); // Hasilnya null jika atribut ini tidak ada di XML

            // (Opsional) Ambil nama lokasi dari tag <Name> di dalam <Site>
            const nameNode = staNode.getElementsByTagName("Name")[0];
            const siteName = nameNode
              ? nameNode.textContent
              : "Unknown Location";

            statuses.push({
              id: `${netCode}-${staCode}`,
              title: `${netCode}-${staCode}`,
              status: endDate ? "ACTIVE" : "OFFLINE",
              type: endDate ? "normal" : "danger",
            });
          }
        }

        console.log("Ada hasil " + networks.length);
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
      });
  });

  onDestroy(() => {
    console.log("Component destroyed");
  });
</script>

<svelte:head>
  <title>Status UI | Rib Cage Layout</title>
</svelte:head>

<div
  class="min-h-screen py-8 flex flex-col items-center overflow-x-hidden font-mono"
>
  <div class="backgroundline absolute inset-0 pointer-events-none z-10"></div>
  <div class="scanline absolute inset-0 pointer-events-none z-10"></div>
  <div
    class="mb-2 text-center p-2 z-10 w-full bordered flex justify-center items-center relative"
  >
    <div class="overflow-hidden">
      <div class="strip-wrapper h-12">
        <div
          class="strip-bar-red loop-strip anim-duration-5"
          style="height: 100%;"
        ></div>
        <div
          class="strip-bar-red loop-strip anim-duration-5"
          style="height: 100%;"
        ></div>
      </div>
      <div
        class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
      >
        <h1
          class="text-xl p-1 font-bold ews-text-glow danger uppercase bg-black"
        >
          Station Status
        </h1>
      </div>
    </div>
  </div>
  <div class="mb-2 w-full bordered text-center p-1">
    <p class="text-black font-bold text-sm bg-primary p-4">
      GEOFON STATION - FDSN (International Federation of Digital Seismograph
      Networks)
    </p>
  </div>
  <div
    class="w-full h-[2px] bg-primary shadow-[0_5px_15px_rgba(255,0,0,0.8)]"
  ></div>
  <div
    class="inline-flex justify-center gap-4 w-full px-4 overflow-x-auto overflow-y-hidden"
  >
    {#each chunkedStatuses as branchStatuses, branchIndex}
      <div class="relative py-10 flex flex-col gap-4">
        <!-- Central Spine -->
        <div
          class="absolute left-1/2 top-0 bottom-0 w-1 bg-primary transform -translate-x-1/2 shadow-[0_0_15px_rgba(255,0,0,0.8)] z-0 line-central"
          style="animation-delay: {branchIndex * 200}ms;"
        ></div>

        <!-- Iterate in pairs essentially by grouping them two by two -->
        <div class="grid grid-cols-2 relative z-10">
          {#each branchStatuses as item, index}
            {#if index % 2 === 0}
              <!-- Left Item (Even index) -->
              <div
                class="flex flex-grow justify-end items-center relative pr-0 col-start-1"
              >
                <!-- Label -->
                <div
                  class="status-node slide-fade-in {item.type === 'danger'
                    ? 'danger'
                    : ''} w-24 h-6 flex flex-grow flex-col items-center justify-center relative mt-6 -mr-2 z-5 text-black text-xs font-bold"
                  style="animation-delay: {(branchIndex + 1) *
                    (index + 1) *
                    10}ms;"
                >
                  <!-- {item.type === "danger" ? item.status : ""} -->
                </div>

                <span
                  class="font-bold text-xs text-glow uppercase absolute z-10 right-6 text-right pt-4"
                >
                  {item.title}
                </span>
                <!-- Connecting Line to center -->
                <div class="w-24 flex justify-end">
                  <div
                    class="h-[2px] w-24 bg-primary shadow-[0_0_10px_rgba(255,0,0,0.8)] z-0 line-node"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  ></div>
                </div>
              </div>
            {:else}
              <!-- Right Item (Odd index) -->
              <div
                class="flex justify-start items-center relative pl-0 col-start-2 w-auto"
              >
                <!-- Connecting Line from center -->
                <div class="w-24 flex justify-start">
                  <div
                    class="h-[2px] w-24 bg-primary shadow-[0_0_10px_rgba(255,0,0,0.8)] z-0 line-node"
                    style="animation-delay: {(branchIndex + 1) *
                      (index + 1) *
                      10}ms;"
                  ></div>
                </div>
                <!-- Label -->
                <div
                  class="status-node-flip slide-fade-in {item.type === 'danger'
                    ? 'danger'
                    : ''} w-24 h-6 flex flex-col items-center justify-center relative mt-6 -ml-2 z-5 text-black text-xs font-bold"
                  style="animation-delay: {(branchIndex + 1) *
                    (index + 1) *
                    10}ms;"
                >
                  <!-- {item.type === "danger" ? item.status : ""} -->
                </div>

                <span
                  class="font-bold text-xs text-glow uppercase absolute z-10 left-6 text-left pt-4"
                >
                  {item.title}
                </span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Ensure the grid rows naturally align left and right items on the same horizontal plane */
</style>
