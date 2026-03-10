<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import GempaBumiAlert from "$lib/components/GempaBumiAlert.svelte";
  import ItemKotaTerdampak from "$lib/components/ItemKotaTerdampak.svelte";
  import Jam from "$lib/components/Jam.svelte";
  import TsunamiAlert from "$lib/components/TsunamiAlert.svelte";
  import type { TitikTsunami } from "$lib/components/TitikTsunami";

  let showGempaBumiAlert = $state(false);
  let showTsunamiAlert = $state(false);

  // Dummy Data for Kota Terdampak
  let dummyKota = $state({
    lng: 106.8456,
    lat: -6.2088,
    distance: 120,
    name: "Jakarta",
    hit: false,
    timeArrival: new Date(new Date().getTime() + 5000), // 5 seconds from now
  });

  // Dummy Data for Tsunami
  let dummyTsunami = $state({
    infoTsunami: {
      id: "tsunami-1",
      lng: 106.8456,
      lat: -6.2088,
      level: "Awas",
      message: "Segera evakuasi ke tempat yang lebih tinggi.",
    },
  } as unknown as TitikTsunami);
</script>

<svelte:head>
  <title>Showcase UI Components</title>
</svelte:head>

<div class="p-8 min-h-screen w-4xl mx-auto text-xs">
  <div class="mb-8">
    <h1 class="text-3xl font-bold mb-2">Showcase UI Components</h1>
    <p class="text-gray-400">
      Demo page for various UI components used in this Early Warning System
      project.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <section>
      <h1 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Strip
      </h1>
      <div class="w-full">
        <p>Still</p>
        <div class="overflow-hidden">
          <div class="strip-wrapper">
            <div class="strip-bar"></div>
            <div class="strip-bar"></div>
          </div>
        </div>
        <p>Animated</p>
        <div class="overflow-hidden">
          <div class="strip-wrapper">
            <div class="strip-bar loop-strip anim-duration-20"></div>
            <div class="strip-bar loop-strip anim-duration-20"></div>
          </div>
        </div>
        <p>Red</p>
        <div class="overflow-hidden">
          <div class="strip-wrapper">
            <div
              class="strip-bar strip-bar-red loop-strip anim-duration-20"
            ></div>
            <div
              class="strip-bar strip-bar-red loop-strip anim-duration-20"
            ></div>
          </div>
        </div>
        <p>Reverse</p>
        <div class="overflow-hidden">
          <div class="strip-wrapper">
            <div
              class="strip-bar strip-bar-red loop-strip-reverse anim-duration-20"
            ></div>
            <div
              class="strip-bar strip-bar-red loop-strip-reverse anim-duration-20"
            ></div>
          </div>
        </div>

        <p>Vertical</p>
        <div class="overflow-hidden h-[200px] flex gap-2">
          <div class="w-[40px] h-full strip-bar-vertical"></div>
          <div
            class="w-[40px] h-full strip-bar-vertical strip-animation-vertical anim-duration-20"
          ></div>
          <div
            class="w-[40px] h-full strip-bar-red-vertical strip-animation-vertical-reverse anim-duration-20"
          ></div>
          <div class="w-[40px] blink blink-fast h-full">
            <div
              class="w-full h-full strip-bar-red-vertical strip-animation-vertical-reverse anim-duration-10"
            ></div>
          </div>
          <div class="w-[40px] blink blink-fast h-full">
            <div
              class="w-full h-full strip-bar-vertical strip-animation-vertical anim-duration-10"
            ></div>
          </div>
        </div>
      </div>
    </section>

    <!-- CARD DEMO -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Card
      </h2>
      <Card className="w-full mb-4">
        {#snippet title()}
          <p class="p-1 text-xs text-glow">CARD TITLE</p>
        {/snippet}
        {#snippet children()}
          <p class="text-sm">CARD CONTENT</p>
        {/snippet}
        {#snippet footer()}
          <div class="p-2">
            <p>CARD FOOTER</p>
          </div>
        {/snippet}
      </Card>

      <Card className="w-full mb-4">
        {#snippet title()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar loop-strip anim-duration-20"></div>
              <div class="strip-bar loop-strip anim-duration-20"></div>
            </div>
          </div>
        {/snippet}
        {#snippet children()}
          <p class="text-sm">CARD CONTENT</p>
        {/snippet}
        {#snippet footer()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
            </div>
          </div>
        {/snippet}
      </Card>

      <Card className="w-full mb-4">
        {#snippet title()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar-red loop-strip anim-duration-20"></div>
              <div class="strip-bar-red loop-strip anim-duration-20"></div>
            </div>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs text-glow">CARD TITLE</p>
            </div>
          </div>
        {/snippet}
        {#snippet children()}
          <p class="text-sm">CARD CONTENT</p>
        {/snippet}
        {#snippet footer()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div
                class="strip-bar-red loop-strip-reverse anim-duration-20"
              ></div>
              <div
                class="strip-bar-red loop-strip-reverse anim-duration-20"
              ></div>
            </div>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs text-glow">
                CARD FOOTER
              </p>
            </div>
          </div>
        {/snippet}
      </Card>
    </section>

    <!-- HEX -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        HEX
      </h2>
      <div class="flex flex-col gap-2 w-full">
        <div class="flex gap-2 w-full">
          <div class="basic-hex"></div>
          <div class="basic-hex flex flex-col justify-center items-center">
            <p>LOREM</p>
          </div>
        </div>
        <div class="flex gap-2 w-full">
          <div class="basic-hex rotate-hex"></div>
          <div
            class="basic-hex rotate-hex flex flex-col justify-center items-center"
          >
            <p>LOREM</p>
          </div>
        </div>
        <div class="long-hex h-[100px]"></div>
        <div
          class="long-hex h-[100px] flex flex-col justify-center items-center"
        >
          <p>LOREM</p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Badge
      </h2>
      <div class="flex flex-col gap-2 w-full">
        <div class="flex gap-2">
          <div
            class="badge label bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <div class="w-full h-full strip-bar-vertical"></div>
            </div>
          </div>

          <div
            class="badge label bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <div class="w-full h-full strip-bar-red-vertical"></div>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <div
            class="badge label bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <div
                class="w-full h-full strip-bar-vertical strip-animation-vertical-reverse anim-duration-10"
              ></div>
            </div>
          </div>

          <div
            class="badge label bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <div
                class="w-full h-full strip-bar-red-vertical strip-animation-vertical anim-duration-10"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Time
      </h2>
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 text-center">
          <div class="bordered p-1 text-time text-xl w-full">
            <Jam timeZone="Asia/Jakarta" />
          </div>
          <div class="bordered p-1 text-time text-xl w-full">
            <Jam timeZone="Asia/Makassar" />
          </div>
          <div class="bordered p-1 text-time text-xl w-full">
            <Jam timeZone="Asia/Jayapura" />
          </div>
        </div>

        <ItemKotaTerdampak kota={dummyKota} />

        <ItemKotaTerdampak kota={dummyKota} />

        <button
          class="text-glow pointer"
          onclick={() => {
            dummyKota.timeArrival = new Date(new Date().getTime() + 10000); // Reset to 10s
          }}
        >
          Reset Timer to 10s
        </button>
      </div>
    </section>

    <!-- ITEM KOTA TERDAMPAK DEMO -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Art <small>(Images)</small>
      </h2>
      <div class="flex gap-2">
        <div class="warning-tsunami-yellow h-[150px] w-[90px]"></div>
        <div class="warning-yellow h-[150px] w-[90px]"></div>
      </div>

      <div class="flex gap-2">
        <div class="warning-black-hex"></div>
        <div class="warning-red-hex"></div>
      </div>
    </section>

    <!-- GEMPA BUMI ALERT DEMO -->
    <!-- <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        4. Gempa Bumi Alert
      </h2>
      <div class="p-4 bg-gray-900/50 rounded flex flex-col gap-4">
        <p class="text-sm text-gray-400">
          Full screen alert overlay for earthquakes.
        </p>
        <button
          class="bg-red-900 border border-red-500 hover:bg-red-800 text-white text-xs py-2 px-4 w-max"
          onclick={() => (showGempaBumiAlert = true)}
        >
          Show Gempa Bumi Alert
        </button>
        <p class="text-xs text-gray-500 italic">
          Click the button to show alert. It will auto close after 5 seconds.
        </p>
      </div>
    </section> -->

    <!-- TSUNAMI ALERT DEMO -->
    <!-- <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        5. Tsunami Alert
      </h2>
      <div class="p-4 bg-gray-900/50 rounded flex flex-col gap-4">
        <p class="text-sm text-gray-400">
          Full screen alert overlay for tsunami warnings.
        </p>
        <button
          class="bg-orange-900 border border-orange-500 hover:bg-orange-800 text-white text-xs py-2 px-4 w-max"
          onclick={() => (showTsunamiAlert = true)}
        >
          Show Tsunami Alert
        </button>
        <p class="text-xs text-gray-500 italic">
          Click the overlay button later to close it once triggered.
        </p>
      </div>
    </section> -->
  </div>
</div>

{#if showGempaBumiAlert}
  <!-- The component has closeInSecond prop which auto closes it -->
  <div class="fixed inset-0 z-50 pointer-events-auto">
    <!-- Overlay to click-close is optional, but component handles its own show logic -->
    <GempaBumiAlert
      magnitudo={6.5}
      kedalaman="10 Km"
      show={showGempaBumiAlert}
      closeInSecond={5}
    />
    <!-- Fallback close button just in case -->
    <button
      class="absolute top-4 right-4 z-[60] bg-black text-white px-4 py-2"
      onclick={() => (showGempaBumiAlert = false)}
    >
      Close Alert Early
    </button>
  </div>
{/if}

{#if showTsunamiAlert}
  <!-- Tsunami Alert takes up the full screen and has animations -->
  <div class="fixed inset-0 z-50 pointer-events-auto">
    <TsunamiAlert alertTsunami={dummyTsunami} />
    <button
      class="absolute top-4 right-4 z-[60] bg-black text-white px-4 py-2"
      onclick={() => (showTsunamiAlert = false)}
    >
      Close Tsunami Alert
    </button>
  </div>
{/if}
