<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { xmlToJson, type JsonNode } from "$lib/xmlUtils";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import RibCageLayout from "$lib/components/RibCageLayout.svelte";
  import { mapStore } from "$lib/stores/mapStore.svelte";

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

  onMount(() => {
    // https://geofon.bmkg.go.id/fdsnws/station/1/
    // URL GEOFON (tanpa format=text agar mengembalikan XML)
    const url = `https://geofon.gfz-potsdam.de/fdsnws/station/1/query?${mapStore.urlParams}&level=station`;

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
        networks.forEach((networkNode) => {
          const netCode =
            (networkNode["@attributes"] as any)?.code || "UNKNOWN";
          const stationsList = networkNode.Station as JsonNode[];

          // Handle both single station and multiple stations
          const stations = Array.isArray(stationsList)
            ? stationsList
            : [stationsList];

          stations.forEach((stationNode) => {
            // console.log(stationNode);
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
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
        setTimeout(() => {
          const el = document.getElementById("loading-screen");
          if (el) el.style.display = "none";
        }, 1000);
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
  class="min-h-screen py-1 md:py-4 flex flex-col items-center overflow-x-hidden overflow-y-auto font-mono"
>
  <div
    class="flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-5 gap-2 pointer-events-none"
    style="width:fit-content"
  >
    <a
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      href="/">HOME</a
    >
    <a
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      href="/status-map">STATION MAP</a
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
          Station Status
        </h1>
      </div>
    </div>
  </div>

  <div class="w-full h-1 bg-primary"></div>

  <RibCageLayout
    items={statuses}
    getHref={(item: any) =>
      `/realtime?networkCode=${item.networkCode}&stationCode=${item.stationCode}`}
  >
    {#snippet nodeContent(
      item: any,
      { side, delay }: { side: string; delay: number },
    )}
      <div
        class="slide-fade-in ews-rib-node {side === 'right'
          ? 'flip'
          : ''} {item.type === 'danger' ? 'danger' : ''}"
        style="animation-delay: {delay}ms;"
      ></div>
    {/snippet}

    {#snippet connectorContent(item: any)}
      {item.title}
    {/snippet}
  </RibCageLayout>
</div>

<!-- LOADING SCREEN -->
<div
  class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-10 -red"
  id="loading-screen"
>
  <span class="loader"></span>
  <p class="my-2 red-color p-2">
    THIS IS A CONCEPT DESIGN - DATA STATION DARI GEOFON
  </p>
</div>

<style>
  /* Ensure the grid rows naturally align left and right items on the same horizontal plane */
</style>
