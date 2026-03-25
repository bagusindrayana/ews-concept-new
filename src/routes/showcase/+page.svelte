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
  import HexShape from "$lib/components/HexShape.svelte";
  import MentalToxicityLevel from "$lib/components/MentalToxicityLevel.svelte";
  import ThreadedComments, {
    type ThreadTone,
  } from "$lib/components/ThreadedComments.svelte";

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

<div class="p-8 min-h-screen w-4xl mx-auto text-xs">
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
            <div
              class="hex-shape orange flat-top clip-content h-[100px] flex flex-col justify-center items-center"
            >
              <div class="inner-content">
                <StripeBar
                  className="bg-black"
                  color="red"
                  loop={true}
                  reverse={true}
                  duration={20}
                ></StripeBar>
              </div>
            </div>
          </div>
          <div class="">
            <div
              class="hex-shape orange clip-content h-[100px] flex flex-col justify-center items-center"
            >
              <div class="inner-content">
                <StripeBar
                  className="bg-black"
                  color="red"
                  loop={true}
                  reverse={true}
                  duration={20}
                ></StripeBar>
              </div>
            </div>
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

    <!-- HEXAGONAL GRID -->
    <section class="col-span-1 md:col-span-2 lg:col-span-3">
      <h2 class="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">
        Hexagonal Grid
      </h2>

      <div class="flex flex-col gap-8">
        <div class="w-full flex gap-2">
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
              <div class="w-full h-full stripe-bar vertical"></div>
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
              <div class="w-full h-full stripe-bar red vertical"></div>
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
              <div
                class="w-full h-full stripe-bar vertical loop-stripe-vertical-reverse anim-duration-10"
              ></div>
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
              <div
                class="w-full h-full stripe-bar red vertical loop-stripe-vertical anim-duration-10"
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
          <ThreadedComments variant="spine" items={threadedSpineItems} />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 2 — Threaded
          </p>
          <ThreadedComments variant="threaded" items={threadedSpineItems} />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 3 — Spine (Expandable + Danger Tone)
          </p>
          <ThreadedComments
            variant="spine"
            items={threadedNestedItems}
            tone="danger"
          />
        </div>
        <div class="p-3">
          <p class="text-gray-500 text-xs mb-3">
            Variation 4 — Threaded (Expandable)
          </p>
          <ThreadedComments
            variant="threaded"
            items={threadedNestedItems}
            expandable={true}
          />
        </div>
        <div class="p-3 col-span-1 lg:col-span-2">
          <p class="text-gray-500 text-xs mb-3">
            Variation 5 — Threaded (With Toggle Callback)
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
    <TsunamiAlert infoTsunami={dummyTsunami.infoTsunami} />
    <button
      class="absolute top-4 right-4 z-[60] bg-black text-white px-4 py-2"
      onclick={() => (showTsunamiAlert = false)}
    >
      Close Tsunami Alert
    </button>
  </div>
{/if}
