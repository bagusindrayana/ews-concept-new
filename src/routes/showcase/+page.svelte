<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import GempaBumiAlert from "$lib/components/GempaBumiAlert.svelte";
  import AffectedAreaItem from "$lib/components/AffectedAreaItem.svelte";
  import Jam from "$lib/components/Jam.svelte";
  import TsunamiAlert from "$lib/components/TsunamiAlert.svelte";
  import type { TitikTsunami } from "$lib/components/TitikTsunami";
  import HexGrid from "$lib/components/HexGrid.svelte";

  // import Highlight from "svelte-highlight";
  // import css from "svelte-highlight/languages/css";
  // import vbscriptHtml from "svelte-highlight/languages/vbscript-html";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import InfiniteScroll from "$lib/components/InfiniteScroll.svelte";
  import HexShape from "$lib/components/HexShape.svelte";
  import MentalToxicityLevel from "$lib/components/MentalToxicityLevel.svelte";
  import ThreadedComments, {
    type ThreadTone,
  } from "$lib/components/ThreadedComments.svelte";
  import MagiBusSwitch, {
    type MagiNodeItem,
  } from "$lib/components/MagiBusSwitch.svelte";
  import MagiBusSingle from "$lib/components/MagiBusSingle.svelte";
  // import MagiBusBoard from "$lib/components/MagiBusBoard.svelte";
  import MagiBusRack from "$lib/components/MagiBusRack.svelte";
  // import MagiBusControls from "$lib/components/MagiBusControls.svelte";

  let lastMagiNodeId = $state<string | null>(null);
  let lastMagiNodeConnected = $state<boolean | null>(null);

  let showGempaBumiAlert = $state(false);
  let showTsunamiAlert = $state(false);

  // HexGrid reveal demo state
  let demoHexVariant = $state<string>("diagonal-top-left");
  let demoHexReverse = $state(false);
  let demoHexKey = $state(0);

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

  // Dynamic Honeycomb Data
  const hexItems = [
    { label: "ZONA A", val: "7.2", danger: true },
    { label: "ZONA B", val: "4.1", warn: true },
    { label: "ZONA C", val: "2.5" },
    { label: "ZONA D", val: "6.8", danger: true },
    { label: "ZONA E", val: "3.3" },
    { label: "ZONA F", val: "5.9", warn: true },
    { label: "ZONA G", val: "8.1", danger: true },
  ];

  const threadedSpineItems: {
    id: string;
    label: string;
    level: number;
    tone: ThreadTone;
  }[] = [
    { id: "spine-1", label: "MAIN THREAD TOPIC", level: 1, tone: "danger" },
    { id: "spine-2", label: "FOLLOW-UP COMMENT", level: 2, tone: "normal" },
    { id: "spine-3", label: "NESTED DETAIL NOTE", level: 3, tone: "normal" },
  ];

  const threadedNestedItems: {
    id: string;
    label: string;
    level: number;
    tone: ThreadTone;
    children?: typeof threadedNestedItems;
  }[] = [
    {
      id: "threaded-1",
      label: "MAIN THREAD TOPIC",
      level: 1,
      tone: "danger",
      children: [
        {
          id: "threaded-1-1",
          label: "REPLY CHILD A",
          level: 2,
          tone: "normal",
          children: [
            {
              id: "threaded-1-1-1",
              label: "DEEP NESTED REPLY",
              level: 3,
              tone: "normal",
              children: [
                {
                  id: "threaded-1-1-1-1",
                  label: "DEEP DEEP NESTED REPLY",
                  level: 4,
                  tone: "muted",
                },
                {
                  id: "threaded-1-1-1-2",
                  label: "DEEP DEEP NESTED REPLY",
                  level: 4,
                  tone: "muted",
                },
              ],
            },
          ],
        },
        {
          id: "threaded-1-2",
          label: "REPLY CHILD B",
          level: 2,
          tone: "muted",
        },
      ],
    },
    {
      id: "threaded-2",
      label: "SECOND COMMENT",
      level: 1,
      tone: "normal",
      children: [
        {
          id: "threaded-2-1",
          label: "REPLY TO SECOND",
          level: 2,
          tone: "normal",
        },
      ],
    },
    {
      id: "threaded-3",
      label: "THIRD COMMENT",
      level: 1,
      tone: "muted",
    },
  ];

  let lastToggledId = $state<string | null>(null);
  let lastToggledState = $state<boolean | null>(null);

  function handleToggle(id: string, collapsed: boolean) {
    lastToggledId = id;
    lastToggledState = collapsed;
  }
</script>

<svelte:head>
  <title>Showcase UI Components</title>
</svelte:head>

<div class="p-8 min-h-screen max-w-4xl mx-auto text-xs">
  <div class="mb-8">
    <h1 class="text-3xl font-bold mb-2">Showcase UI Components</h1>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <section>
      <h1 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Strip
      </h1>
      <div class="flex flex-col md:flex-row gap-2">
        <div class="max-w-24">
          <p>Default</p>

          <div class="h-[30px]">
            <StripeBar className="my-2 "></StripeBar>
          </div>

          <p>Animated</p>
          <div class="h=[30px]">
            <StripeBar loop={true}></StripeBar>
          </div>

          <p>Red</p>
          <div class="h-[30px]">
            <StripeBar color="red" loop={true} duration={20}></StripeBar>
          </div>

          <p>Reverse</p>
          <div class="h-[30px]">
            <StripeBar color="red" loop={true} reverse={true} duration={20}
            ></StripeBar>
          </div>

          <p>Flip</p>
          <div class="h-[30px]">
            <StripeBar className="my-2 -scale-x-100"></StripeBar>
          </div>
        </div>

        <div class="w-full">
          <p>Vertical</p>
          <div class="h-[100px] flex gap-2">
            <StripeBar orientation="vertical" className="w-[30px] h-full"
            ></StripeBar>

            <StripeBar orientation="vertical" color="red"></StripeBar>
          </div>

          <p>Vertical Animated</p>
          <div class="h-[100px] flex gap-2">
            <StripeBar orientation="vertical" loop={true}></StripeBar>
            <StripeBar orientation="vertical" color="red" loop={true}
            ></StripeBar>
            <StripeBar
              orientation="vertical"
              color="red"
              loop={true}
              reverse={true}
            ></StripeBar>
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
          <p class="p-1 text-xs">CARD TITLE</p>
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
          <StripeBar loop={true} duration={20}></StripeBar>
        {/snippet}
        {#snippet children()}
          <p class="text-sm">CARD CONTENT</p>
        {/snippet}
        {#snippet footer()}
          <StripeBar loop={true} duration={20} reverse={true}></StripeBar>
        {/snippet}
      </Card>

      <Card className="w-full mb-4">
        {#snippet title()}
          <StripeBar color="red" loop={true} duration={20}>
            <div class="ews-card-text">
              <p class="p-1 bg-black font-bold text-xs">CARD TITLE</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <p class="text-sm">CARD CONTENT</p>
        {/snippet}
        {#snippet footer()}
          <StripeBar color="red" loop={true} reverse={true} duration={20}>
            <div class="ews-card-text">
              <p class="p-1 bg-black font-bold text-xs">CARD FOOTER</p>
            </div>
          </StripeBar>
        {/snippet}
      </Card>
    </section>

    <!-- HEX -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        HEX
      </h2>
      <div class="flex flex-col gap-2 w-full justify-center items-center">
        <div class="flex gap-2 w-full justify-center items-center">
          <div class="">
            <HexShape clipContent={true} className="h-[100px]">
              <StripeBar
                className="bg-black"
                loop={true}
                reverse={true}
                duration={20}
              ></StripeBar>
            </HexShape>
          </div>
          <div class="">
            <HexShape clipContent={true} flatTop={false} className="h-[100px]">
              <StripeBar
                className="bg-black"
                loop={true}
                reverse={true}
                duration={20}
              ></StripeBar>
            </HexShape>
          </div>
        </div>
        <div class="flex gap-2 w-full justify-center items-center">
          <div class="">
            <HexShape clipContent={true} color="orange" className="h-[100px]">
              <StripeBar
                className="bg-black"
                loop={true}
                reverse={true}
                duration={20}
                color="red"
              ></StripeBar>
            </HexShape>
          </div>
          <div class="">
            <HexShape
              clipContent={true}
              flatTop={false}
              color="orange"
              className="h-[100px]"
            >
              <StripeBar
                className="bg-black"
                loop={true}
                color="red"
                duration={20}
              ></StripeBar>
            </HexShape>
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

    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Infinite Scroll
      </h2>

      <!-- Demo 1: Ticker bar with emergency notices -->
      <div class="flex w-full relative mb-4">
        <StripeBar className="my-2 " size="200px"></StripeBar>
        <StripeBar className="my-2 -scale-x-100 " size="200px"></StripeBar>
        <div
          class="absolute top-0 left-0 bottom-0 right-0 flex items-center justify-center text-center"
        >
          <div class="p-1 bg-black rounded-lg w-full">
            <div class="bordered-red bg-black p-2 w-full text-primary">
              <InfiniteScroll speed={60} gap={48}>
                {#snippet children()}
                  <div class="flex flex-col text-center px-4">
                    <span class="text-xs">CONDITION: RED</span>
                    <b class="text-4xl" style="line-height: 0.8;">EMERGENCY</b>
                    <span class="text-xs">CODE: 102</span>
                  </div>
                {/snippet}
              </InfiniteScroll>
            </div>
          </div>
        </div>
      </div>

      <!-- Demo 2: Variasi speed & direction -->
      <div class="flex flex-col gap-3">
        <div>
          <p class="text-gray-500 text-xs mb-1">speed=40 (slow), gap=32px</p>
          <div class="bordered p-2">
            <InfiniteScroll speed={40} gap={32}>
              {#snippet children()}
                <span class="ews-text text-sm px-4">⬡ SEISMIC ALERT</span>
                <span class="ews-text danger text-sm px-4">⚠ AWAS GEMPA</span>
                <span class="ews-text text-sm px-4">⬡ ZONE: SUMATERA</span>
                <span class="ews-text danger text-sm px-4">⚠ MAG 7.2</span>
              {/snippet}
            </InfiniteScroll>
          </div>
        </div>

        <div>
          <p class="text-gray-500 text-xs mb-1">
            speed=120 (fast), direction=right
          </p>
          <div class="bordered p-2">
            <InfiniteScroll speed={120} gap={32} direction="right">
              {#snippet children()}
                <span class="ews-text-digital text-sm px-4"
                  >STATION: BDG-01</span
                >
                <span class="ews-text-digital text-sm px-4">DEPTH: 10km</span>
                <span class="ews-text-digital text-sm px-4">LAT: -6.208</span>
                <span class="ews-text-digital text-sm px-4">LNG: 106.845</span>
              {/snippet}
            </InfiniteScroll>
          </div>
        </div>

        <div>
          <p class="text-gray-500 text-xs mb-1">
            pauseOnHover, speed=80, gap=64px — single large item
          </p>
          <div class="bordered-red p-2">
            <InfiniteScroll speed={80} gap={64} pauseOnHover={true}>
              {#snippet children()}
                <div class="flex flex-col text-center px-2">
                  <span class="text-xs text-gray-400">HOVER TO PAUSE</span>
                  <b class="text-2xl ews-text danger">⚠ TSUNAMI WARNING</b>
                  <span class="text-xs">EVAKUASI SEGERA</span>
                </div>
              {/snippet}
            </InfiniteScroll>
          </div>
        </div>
      </div>
    </section>

    <!-- HEXAGONAL GRID -->
    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Hexagonal Grid
      </h2>

      <div class="w-full flex flex-col md:flex-row gap-2">
        <!-- Honeycomb Offset Grid -->
        <div class="basis-0 flex-1">
          <p class="text-gray-500 text-xs mb-3">Honeycomb Offset Grid</p>
          <HexGrid gap={0}>
            {#each { length: 30 } as _, i}
              <div class="ews-hex-hive">
                <HexShape clipContent={true} flatTop={false}>
                  {i}
                </HexShape>
              </div>
            {/each}
          </HexGrid>
        </div>

        <div class="basis-0 flex-1">
          <p class="text-gray-500 text-xs mb-3">
            Honeycomb Variant 2 Offset Grid
          </p>
          <HexGrid variant="flat">
            {#each { length: 30 } as _, i}
              <div class="hex-hive flat">
                <HexShape clipContent={true}>
                  {i}
                </HexShape>
              </div>
            {/each}
          </HexGrid>
        </div>
      </div>

      <!-- Interactive HexGrid Reveal Animation Showcase -->
      <div class="mt-6 p-4 border border-gray-800 rounded bg-black/40">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-sm font-bold text-primary uppercase tracking-wider">
              HexGrid Reveal Animation System
            </h3>
            <p class="text-xs text-gray-400">
              Active Variant: <span class="text-white font-mono">{demoHexVariant}</span> | Reverse: <span class="text-white font-mono">{demoHexReverse ? "true" : "false"}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="px-2.5 py-1 text-xs font-semibold rounded border border-gray-600 transition-colors hover:bg-gray-800"
              class:border-primary={demoHexReverse}
              class:text-primary={demoHexReverse}
              onclick={() => (demoHexReverse = !demoHexReverse)}
            >
              {demoHexReverse ? "Reverse: ON (Exit Wave)" : "Reverse: OFF"}
            </button>
            <button
              class="px-3 py-1 text-xs font-bold rounded bg-primary text-black hover:brightness-110"
              onclick={() => {
                demoHexReverse = false;
                demoHexKey++;
              }}
            >
              Replay Reveal
            </button>
          </div>
        </div>

        <!-- Variant Selection Buttons -->
        <div class="flex flex-wrap gap-1.5 mb-5 text-xs">
          {#each [
            { id: "diagonal-top-left", label: "Diagonal Top-Left (Kiri Atas)" },
            { id: "diagonal-top-right", label: "Diagonal Top-Right (Kanan Atas)" },
            { id: "diagonal-bottom-left", label: "Diagonal Bottom-Left (Kiri Bawah)" },
            { id: "diagonal-bottom-right", label: "Diagonal Bottom-Right (Kanan Bawah)" },
            { id: "center", label: "Center (Tengah)" },
            { id: "random", label: "Random (Acak)" }
          ] as v}
            <button
              class="px-2 py-1 rounded border transition-all {demoHexVariant === v.id ? 'border-primary bg-primary/20 text-white font-bold' : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'}"
              onclick={() => {
                demoHexVariant = v.id;
                demoHexReverse = false;
                demoHexKey++;
              }}
            >
              {v.label}
            </button>
          {/each}
        </div>

        <!-- Render Grid with active variant -->
        {#key demoHexKey}
          <div class="p-2 border border-gray-900 rounded bg-black/60 overflow-hidden min-h-[220px]">
            <HexGrid
              variant="flat"
              align="center"
              revealVariant={demoHexVariant}
              reverse={demoHexReverse}
              revealMaxDelay={900}
              revealDuration={320}
            >
              {#each { length: 36 } as _, i}
                <div class="ews-hex-hive flat cursor-pointer select-none">
                  <HexShape
                    clipContent={true}
                    className="w-full h-full transition-transform hover:scale-110"
                    color={i % 3 === 0 ? "fdsn-selected" : ""}
                  >
                    <span class="text-[10px] font-black">{i + 1}</span>
                  </HexShape>
                </div>
              {/each}
            </HexGrid>
          </div>
        {/key}
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Badge
      </h2>
      <div class="flex flex-col gap-2 w-full">
        <div class="flex gap-2">
          <div
            class="badge ews-title text-3xl bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <StripeBar
                className="w-full h-full"
                size={"100%"}
                orientation="vertical"
              ></StripeBar>
            </div>
          </div>

          <div
            class="badge ews-title text-3xl bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <StripeBar
                className="w-full h-full"
                size={"100%"}
                orientation="vertical"
                color="red"
              ></StripeBar>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <div
            class="badge ews-title text-3xl bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <StripeBar
                className="w-full h-full"
                size={"100%"}
                orientation="vertical"
                loop={true}
              ></StripeBar>
            </div>
          </div>

          <div
            class="badge ews-title text-3xl bordered flex justify-between mb-2 w-full lg:w-32"
          >
            <div class="flex flex-col items-center p-1">
              <div class="text -characters">7</div>
              <div class="text">MAG</div>
            </div>
            <div class="decal">
              <StripeBar
                className="w-full h-full"
                size={"100%"}
                orientation="vertical"
                color="red"
                loop={true}
              ></StripeBar>
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

        <AffectedAreaItem kota={dummyKota} />

        <AffectedAreaItem kota={dummyKota} />

        <button
          class=" pointer"
          onclick={() => {
            dummyKota.timeArrival = new Date(new Date().getTime() + 10000); // Reset to 10s
          }}
        >
          Reset Timer to 10s
        </button>
      </div>
    </section>

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

    <!-- TEXT VARIANTS -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Text
      </h2>
      <div class="flex flex-col gap-3">
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text</p>
          <p class="ews-text text-lg">Early Warning System</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text danger</p>
          <p class="ews-text danger text-lg">EARLY WARNING</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text</p>
          <p class="ews-text text-lg">GLOW TEXT ORANGE</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text danger</p>
          <p class="ews-text danger text-lg">GLOW TEXT RED</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-digital</p>
          <p class="ews-text-digital text-2xl">12:45:30</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-digital danger</p>
          <p class="ews-text-digital danger text-2xl">07.8 SR</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-blink</p>
          <p class="ews-text danger text-lg ews-text-blink">
            ⚠ AWAS TSUNAMI ⚠
          </p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-blink fast</p>
          <p class="ews-text danger text-lg ews-text-blink fast">
            ⚠ EVAKUASI SEGERA ⚠
          </p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-underline</p>
          <span class="ews-text-underline">Status: Active</span>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-underline danger</p>
          <span class="ews-text-underline danger">Status: Critical</span>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">neon-glow</p>
          <p class="neon-glow text-lg">NEON GLOW</p>
        </div>
      </div>
    </section>

    <!-- INPUT VARIANTS -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Input
      </h2>
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-input (default)</p>
          <input class="ews-input" type="text" placeholder="Masukkan data..." />
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-input danger</p>
          <input
            class="ews-input danger"
            type="text"
            placeholder="Error state..."
          />
        </div>

        <div>
          <p class="text-gray-500 text-xs mb-1">ews-input underline</p>
          <input
            class="ews-input underline"
            type="text"
            placeholder="Underline input..."
          />
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-input underline danger</p>
          <input
            class="ews-input underline danger"
            type="text"
            placeholder="Danger underline..."
          />
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-input disabled</p>
          <input class="ews-input" type="text" value="DISABLED" disabled />
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-select</p>
          <select class="ews-select">
            <option>PILIH ZONA WAKTU</option>
            <option>WIB - JAKARTA</option>
            <option>WITA - MAKASSAR</option>
            <option>WIT - JAYAPURA</option>
          </select>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-select danger</p>
          <select class="ews-select danger">
            <option>LEVEL WARNING</option>
            <option>SIAGA</option>
            <option>WASPADA</option>
            <option>AWAS</option>
          </select>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-textarea</p>
          <textarea class="ews-textarea" placeholder="Keterangan tambahan..."
          ></textarea>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-textarea danger</p>
          <textarea class="ews-textarea danger" placeholder="Pesan darurat..."
          ></textarea>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">Input + Strip</p>
          <div class="flex flex-col gap-0">
            <div class="overflow-hidden">
              <div class="stripe-wrapper" style="height: 2px;">
                <div
                  class="stripe-bar loop-stripe anim-duration-20"
                  style="height:6px;"
                ></div>
                <div
                  class="stripe-bar loop-stripe anim-duration-20"
                  style="height:6px;"
                ></div>
              </div>
            </div>
            <input
              class="ews-input"
              type="text"
              placeholder="With stripe decoration..."
              style="border-radius: 0;"
            />
            <div class="overflow-hidden">
              <div class="stripe-wrapper" style="height: 2px;">
                <div
                  class="stripe-bar loop-stripe-reverse anim-duration-20"
                  style="height:6px;"
                ></div>
                <div
                  class="stripe-bar loop-stripe-reverse anim-duration-20"
                  style="height:6px;"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p class="text-gray-500 text-xs mb-1">Toggle</p>
          <div class="settings-item">
            <span class=" text-sm">Event Log</span>
            <label class="toggle-switch"
              ><input type="checkbox" />
              <span class="toggle-slider"></span></label
            >
          </div>
        </div>
      </div>
    </section>

    <!-- BUTTON VARIANTS -->
    <section>
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Button
      </h2>
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <div>
            <p class="text-gray-500 text-xs mb-1">ews-btn-primary</p>
            <button class="bordered p-1 flex items-stretch">
              <div
                class="w-full h-full bg-primary p-1 min-w-24 text-black uppercase rounded"
              >
                Primary
              </div>
            </button>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-1">ews-btn-danger</p>
            <button class="bordered-red p-1 flex items-stretch">
              <div
                class="w-full h-full bg-danger p-1 min-w-24 text-white uppercase rounded"
              >
                Danger
              </div>
            </button>
          </div>
          <!-- <div>
            <p class="text-gray-500 text-xs mb-1">ews-btn-danger</p>
            <button class="ews-btn ews-btn-danger">Danger</button>
          </div> -->
        </div>
        <div class="flex gap-2">
          <div>
            <p class="text-gray-500 text-xs mb-1">ews-btn-outline</p>
            <button class="ews-btn ews-btn-outline">Outline</button>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-1">ews-btn-outline-danger</p>
            <button class="ews-btn ews-btn-outline-danger"
              >Outline Danger</button
            >
          </div>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-btn-ghost</p>
          <button class="ews-btn ews-btn-ghost">Ghost</button>
          <button class="ews-btn ews-btn-ghost danger">Ghost Danger</button>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-btn-skew</p>
          <div class="flex gap-2">
            <button class="ews-btn ews-btn-skew"><span>Skew</span></button>
            <button class="ews-btn ews-btn-skew danger"
              ><span>Skew Danger</span></button
            >
          </div>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-btn-alert (pulsing)</p>
          <button class="ews-btn ews-btn-alert">⚠ ALERT</button>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">Sizes: sm / default / lg</p>
          <div class="flex gap-2 items-center flex-wrap">
            <button class="ews-btn ews-btn-primary ews-btn-sm">Small</button>
            <button class="ews-btn ews-btn-primary">Default</button>
            <button class="ews-btn ews-btn-primary ews-btn-lg">Large</button>
          </div>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">Disabled</p>
          <div class="flex gap-2 flex-wrap">
            <button class="ews-btn ews-btn-primary" disabled>Disabled</button>
            <button class="ews-btn ews-btn-danger" disabled>Disabled</button>
            <button class="ews-btn ews-btn-outline" disabled>Disabled</button>
          </div>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">Button + Strip</p>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col">
              <button
                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
              >
                <StripeBar loop={true} reverse={true} duration={20}></StripeBar>
                <span class="absolute bg-black ews-label px-2 py-1"
                  >⚠ EMERGENCY BUTTON</span
                >
              </button>
            </div>

            <div class="flex flex-col">
              <button
                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered-red p-1"
              >
                <StripeBar color="red" loop={true} reverse={true} duration={20}
                ></StripeBar>

                <span class="absolute bg-black ews-label danger px-2 py-1"
                  >⚠ EMERGENCY BUTTON</span
                >
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- THREADED COMMENTS / NESTED LIST -->
    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Threaded Comments / Nested List
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">Variation 1 — Spine</p>
          <ThreadedComments
            variant="spine"
            items={threadedSpineItems}
            animated={false}
          />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">Variation 2 — Threaded</p>
          <ThreadedComments
            variant="threaded"
            items={threadedSpineItems}
            animated={false}
          />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 3 — Spine (Expandable)
          </p>
          <ThreadedComments
            variant="spine"
            items={threadedNestedItems}
            tone="danger"
            expandable={true}
            animated={false}
          />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 4 — Spine (Animated)
          </p>
          <ThreadedComments
            variant="spine"
            items={threadedNestedItems}
            expandable={true}
            animated={true}
          />
        </div>

        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 5 — Threaded (Expandable)
          </p>
          <ThreadedComments
            variant="threaded"
            items={threadedNestedItems}
            tone="danger"
            expandable={true}
            animated={false}
          />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 6 — Threaded (Animated)
          </p>
          <ThreadedComments
            variant="threaded"
            items={threadedNestedItems}
            expandable={true}
            animated={true}
          />
        </div>
        <div class="p-3 col-span-1 lg:col-span-2">
          <p class="text-gray-500 text-xs mb-3">
            Variation 7 — Threaded (With Toggle Callback)
          </p>
          <div class="mb-2 text-xs text-gray-400">
            Last toggled: {lastToggledId ?? "none"} — {lastToggledState === null
              ? ""
              : lastToggledState
                ? "collapsed"
                : "expanded"}
          </div>
          <ThreadedComments
            variant="threaded"
            items={threadedNestedItems}
            onToggle={handleToggle}
          />
        </div>
      </div>
    </section>

    <!-- MENTAL TOXICITY LEVEL -->
    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Mental Toxicity Level
      </h2>
      <MentalToxicityLevel />
    </section>

    <!-- MAGI BUS SYNC SWITCH (NERVE LINK DATA TOGGLE) -->
    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <div
        class="flex items-center justify-between mb-4 border-b border-gray-700 pb-2"
      >
        <div>
          <h2 class="text-xl font-semibold">MAGI Bus Sync Switch</h2>
        </div>
      </div>

      <!-- 1. Full Board Variant -->
      <div class="mb-6">
        <MagiBusSwitch
          maxColumns={2}
          nodes={[
            // Bank 1: Diagonal Core Synapses
            {
              id: "GE-JAGI",
              title: "GE-JAGI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "JAGI",
              networkCode: "GE",
              site: "Jatiwangi, Java",
            },
            {
              id: "GE-TNTI",
              title: "GE-TNTI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "TNTI",
              networkCode: "GE",
              site: "Ternate, Maluku",
            },
            {
              id: "IA-BKB",
              title: "IA-BKB",
              status: "ACTIVE",
              type: "normal",
              stationCode: "BKB",
              networkCode: "IA",
              site: "Bukit Tinggi, Sumatra",
            },
            {
              id: "IA-BBJI",
              title: "IA-BBJI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "BBJI",
              networkCode: "IA",
              site: "Banjarnegara, Java",
            },
            {
              id: "GE-UGM",
              title: "GE-UGM",
              status: "ACTIVE",
              type: "normal",
              stationCode: "UGM",
              networkCode: "GE",
              site: "Yogyakarta, Java",
            },
            {
              id: "IA-KAPI",
              title: "IA-KAPI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "KAPI",
              networkCode: "IA",
              site: "Kappang, Sulawesi",
            },
            {
              id: "IA-SMRI",
              title: "IA-SMRI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "SMRI",
              networkCode: "IA",
              site: "Semarang, Java",
            },
            {
              id: "GE-FAKI",
              title: "GE-FAKI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "FAKI",
              networkCode: "GE",
              site: "Fakfak, Papua",
            },
            {
              id: "GE-PLAI",
              title: "GE-PLAI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "PLAI",
              networkCode: "GE",
              site: "Pelabuhan Ratu, Java",
            },
            {
              id: "IA-CISI",
              title: "IA-CISI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "CISI",
              networkCode: "IA",
              site: "Cisompet, Garut",
            },
            {
              id: "IA-SWI",
              title: "IA-SWI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "SWI",
              networkCode: "IA",
              site: "Sawahan, Java",
            },
            {
              id: "GE-SOEI",
              title: "GE-SOEI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "SOEI",
              networkCode: "GE",
              site: "Soe, Timor",
            },
            {
              id: "IA-GSI",
              title: "IA-GSI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "GSI",
              networkCode: "IA",
              site: "Gunungsitoli, Nias",
            },

            // Bank 2: Horizontal Seismic Transceivers
            {
              id: "GE-LHMI",
              title: "GE-LHMI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "LHMI",
              networkCode: "GE",
              site: "Lhokseumawe, Aceh",
            },
            {
              id: "IA-BNDI",
              title: "IA-BNDI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "BNDI",
              networkCode: "IA",
              site: "Banda Neira, Maluku",
            },
            {
              id: "IA-AAI",
              title: "IA-AAI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "AAI",
              networkCode: "IA",
              site: "Arso, Papua",
            },
            {
              id: "GE-BND",
              title: "GE-BND",
              status: "ACTIVE",
              type: "normal",
              stationCode: "BND",
              networkCode: "GE",
              site: "Banda Sea Array",
            },
            {
              id: "IA-PMBI",
              title: "IA-PMBI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "PMBI",
              networkCode: "IA",
              site: "Palembang, Sumatra",
            },
            {
              id: "IA-JMB",
              title: "IA-JMB",
              status: "OFFLINE",
              type: "danger",
              stationCode: "JMB",
              networkCode: "IA",
              site: "Jambi Observation",
            },
            {
              id: "GE-MMRI",
              title: "GE-MMRI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "MMRI",
              networkCode: "GE",
              site: "Maumere, Flores",
            },
            {
              id: "IA-TRTI",
              title: "IA-TRTI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "TRTI",
              networkCode: "IA",
              site: "Tolitoli, Sulawesi",
            },
            {
              id: "IA-LUWI",
              title: "IA-LUWI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "LUWI",
              networkCode: "IA",
              site: "Luwuk, Banggai",
            },
            {
              id: "GE-TOLI2",
              title: "GE-TOLI2",
              status: "ACTIVE",
              type: "normal",
              stationCode: "TOLI2",
              networkCode: "GE",
              site: "Toli-Toli Coastal",
            },
            {
              id: "IA-GENI",
              title: "IA-GENI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "GENI",
              networkCode: "IA",
              site: "Genteng, Banyuwangi",
            },
            {
              id: "IA-KLI",
              title: "IA-KLI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "KLI",
              networkCode: "IA",
              site: "Kotabumi, Lampung",
            },
            {
              id: "GE-MEDA",
              title: "GE-MEDA",
              status: "OFFLINE",
              type: "danger",
              stationCode: "MEDA",
              networkCode: "GE",
              site: "Medan Geophysics",
            },
            {
              id: "IA-PDSI",
              title: "IA-PDSI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "PDSI",
              networkCode: "IA",
              site: "Padang Sidempuan",
            },
            {
              id: "IA-SANI",
              title: "IA-SANI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "SANI",
              networkCode: "IA",
              site: "Sanana, Maluku",
            },
            {
              id: "GE-BKNI",
              title: "GE-BKNI",
              status: "OFFLINE",
              type: "danger",
              stationCode: "BKNI",
              networkCode: "GE",
              site: "Bangka Belitung",
            },
            {
              id: "IA-GLMI",
              title: "IA-GLMI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "GLMI",
              networkCode: "IA",
              site: "Galela, Halmahera",
            },
            {
              id: "GE-WSI",
              title: "GE-WSI",
              status: "ACTIVE",
              type: "normal",
              stationCode: "WSI",
              networkCode: "GE",
              site: "Waingapu, Sumba",
            },
          ]}
          variant="board"
          onToggle={(node, isConn) => {
            lastMagiNodeId = node.id;
            lastMagiNodeConnected = isConn;
          }}
        />
      </div>

      <!-- 2. Compact Variants: Single Switch & Data Rack -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <!-- Single Toggle Switch -->
        <div
          class="p-4 bg-neutral-900 border border-neutral-800 rounded flex flex-col gap-3"
        >
          <div>
            <h3 class="font-bold text-sm text-neutral-200">
              Standalone Switch Variant
            </h3>
          </div>
          <MagiBusSingle
            label="00130"
            sublabel="NERV-OPT-130 // SYNC"
            onToggle={(isConn) => {
              lastMagiNodeId = "STANDALONE-00130";
              lastMagiNodeConnected = isConn;
            }}
          />
        </div>

        <!-- Data Rack Variant -->
        <div
          class="p-4 bg-neutral-900 border border-neutral-800 rounded flex flex-col gap-3"
        >
          <div>
            <h3 class="font-bold text-sm text-neutral-200">
              Rack Channels Variant (MagiBusRack)
            </h3>
          </div>
          <MagiBusRack
            onToggle={(item, isConn) => {
              lastMagiNodeId = item.id;
              lastMagiNodeConnected = isConn;
            }}
          />
        </div>
      </div>

      <!-- Emergency Alerts Demo Section -->
      <div class="mt-8 p-6 border border-red-900/60 rounded bg-red-950/20">
        <h3 class="text-base font-bold text-red-500 uppercase tracking-wider mb-2">
          Emergency Alerts Demo (Tsunami Alert with Reverse Exit Animation)
        </h3>
        <p class="text-xs text-gray-400 mb-4">
          Test the Tsunami Alert popup with its full diagonal HexGrid reveal background, center Eva-style warning banners, and smooth reverse/exit collapse animation.
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            id="btn-launch-tsunami"
            class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase rounded tracking-wider shadow-lg shadow-red-900/40 transition-all active:scale-95 cursor-pointer"
            onclick={() => (showTsunamiAlert = true)}
          >
            Launch Tsunami Alert
          </button>
          <button
            class="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm uppercase rounded transition-all active:scale-95 cursor-pointer"
            onclick={() => (showGempaBumiAlert = true)}
          >
            Launch Gempa Alert
          </button>
        </div>
      </div>
    </section>
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
    <TsunamiAlert
      infoTsunami={dummyTsunami.infoTsunami}
      closeInSecond={10}
      onClose={() => (showTsunamiAlert = false)}
    />
    <button
      class="absolute top-4 right-4 z-[60] bg-black text-white px-4 py-2 border border-red-500 font-bold"
      onclick={() => (showTsunamiAlert = false)}
    >
      Close Tsunami Alert
    </button>
  </div>
{/if}
