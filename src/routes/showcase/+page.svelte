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
            <div class="strip-bar-red loop-strip anim-duration-20"></div>
            <div class="strip-bar-red loop-strip anim-duration-20"></div>
          </div>
        </div>
        <p>Reverse</p>
        <div class="overflow-hidden">
          <div class="strip-wrapper">
            <div
              class="strip-bar-red loop-strip-reverse anim-duration-20"
            ></div>
            <div
              class="strip-bar-red loop-strip-reverse anim-duration-20"
            ></div>
          </div>
        </div>

        <p>Vertical</p>
        <div class="overflow-hidden h-[200px] flex gap-2">
          <div class="w-[40px] h-full strip-bar-vertical"></div>
          <div class="w-[40px] h-full overflow-hidden">
            <div
              class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-20"
            ></div>
            <div
              class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-20"
            ></div>
          </div>
          <div class="w-[40px] h-full overflow-hidden">
            <div
              class="w-full h-full strip-bar-red-vertical loop-strip-vertical-reverse anim-duration-20"
            ></div>
            <div
              class="w-full h-full strip-bar-red-vertical loop-strip-vertical-reverse anim-duration-20"
            ></div>
          </div>
          <div class="w-[40px] blink blink-fast h-full">
            <div
              class="w-full h-full strip-bar-red-vertical loop-strip-vertical-reverse anim-duration-10"
            ></div>
            <div
              class="w-full h-full strip-bar-red-vertical loop-strip-vertical-reverse anim-duration-10"
            ></div>
          </div>
          <div class="w-[40px] blink blink-fast h-full">
            <div
              class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-10"
            ></div>
            <div
              class="w-full h-full strip-bar-vertical loop-strip-vertical anim-duration-10"
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
      <div class="flex flex-col gap-2 w-full justify-center items-center">
        <div class="flex gap-2 w-full justify-center items-center">
          <div class="h-[100px]">
            <div class="basic-hex flex flex-col justify-center items-center">
              <p>LOREM</p>
            </div>
          </div>
          <div class="h-[100px]">
            <div class="basic-hex flex flex-col justify-center items-center">
              <div
                class="clip-hex-inner flex flex-col justify-center items-center text-center"
              >
                <div class="strip-wrapper bg-black">
                  <div class="strip-bar loop-strip anim-duration-20"></div>
                  <div class="strip-bar loop-strip anim-duration-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 w-full justify-center items-center">
          <div class="h-[115px]">
            <div
              class="basic-hex-yellow rotate-hex flex flex-col justify-center items-center"
            >
              <div
                class="clip-hex-inner flex flex-col justify-center items-center text-center"
              >
                <div class="strip-wrapper bg-black">
                  <div class="strip-bar-red"></div>
                  <div class="strip-bar-red"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="h-[115px]">
            <div
              class="basic-hex rotate-hex flex flex-col justify-center items-center"
            >
              <div
                class="clip-hex-inner flex flex-col justify-center items-center text-center"
              >
                <div class="strip-wrapper bg-black">
                  <div class="strip-bar anim-duration-20"></div>
                  <div class="strip-bar anim-duration-20"></div>
                </div>
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

        <!-- Basic Flat Grid -->
        <div>
          <p class="text-gray-500 text-xs mb-3">Basic Flat Hex Grid (CSS clip-path)</p>
          <div class="hex-grid hex-grid-flat">
            {#each ['SIAGA', 'AWAS', 'INFO', 'WASPADA', 'AMAN', 'DARURAT', 'MONITOR'] as label, i}
              <div class="hex-cell hex-cell-flat" class:hex-danger={label === 'AWAS' || label === 'DARURAT'} class:hex-warn={label === 'SIAGA' || label === 'WASPADA'} class:hex-safe={label === 'AMAN'}>
                <div class="hex-content">
                  <span class="text-[10px] font-bold tracking-wider">{label}</span>
                  <span class="text-[8px] opacity-60">#{i + 1}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Honeycomb Offset Grid -->
        <div>
          <p class="text-gray-500 text-xs mb-3">Honeycomb Offset Grid</p>
          <div class="hex-honeycomb">
            <div class="hex-row">
              {#each [
                { label: 'ZONA A', val: '7.2', danger: true },
                { label: 'ZONA B', val: '4.1', warn: true },
                { label: 'ZONA C', val: '2.5' },
                { label: 'ZONA D', val: '6.8', danger: true },
              ] as item}
                <div class="hex-hive" class:hex-danger={item.danger} class:hex-warn={item.warn}>
                  <div class="hex-hive-inner">
                    <p class="text-[9px] opacity-70 uppercase tracking-widest">{item.label}</p>
                    <p class="text-base font-bold leading-none" class:text-glow-red={item.danger} class:text-glow={!item.danger && !item.warn}>{item.val}</p>
                    <p class="text-[8px] opacity-50">SR</p>
                  </div>
                </div>
              {/each}
            </div>
            <div class="hex-row hex-row-offset">
              {#each [
                { label: 'ZONA E', val: '3.3' },
                { label: 'ZONA F', val: '5.9', warn: true },
                { label: 'ZONA G', val: '8.1', danger: true },
              ] as item}
                <div class="hex-hive" class:hex-danger={item.danger} class:hex-warn={item.warn}>
                  <div class="hex-hive-inner">
                    <p class="text-[9px] opacity-70 uppercase tracking-widest">{item.label}</p>
                    <p class="text-base font-bold leading-none" class:text-glow-red={item.danger} class:text-glow={!item.danger && !item.warn}>{item.val}</p>
                    <p class="text-[8px] opacity-50">SR</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Animated Status Grid -->
        <div>
          <p class="text-gray-500 text-xs mb-3">Animated Status Hex Grid (EWS Themed)</p>
          <div class="flex flex-wrap gap-3 justify-start">
            {#each [
              { zone: 'JAKARTA', status: 'AWAS', level: 3, pulse: true },
              { zone: 'BANDUNG', status: 'SIAGA', level: 2, pulse: false },
              { zone: 'SURABAYA', status: 'WASPADA', level: 1, pulse: false },
              { zone: 'MEDAN', status: 'AMAN', level: 0, pulse: false },
              { zone: 'BALI', status: 'SIAGA', level: 2, pulse: false },
              { zone: 'MANADO', status: 'AWAS', level: 3, pulse: true },
            ] as item}
              <div
                class="hex-status-cell"
                class:hex-danger={item.level === 3}
                class:hex-warn={item.level === 2}
                class:hex-caution={item.level === 1}
                class:hex-safe={item.level === 0}
                class:hex-pulse={item.pulse}
              >
                <div class="hex-status-inner">
                  <div class="text-[8px] opacity-60 uppercase tracking-widest leading-none mb-1">{item.zone}</div>
                  <div class="text-[11px] font-bold leading-none"
                    class:text-glow-red={item.level === 3}
                    class:text-glow={item.level <= 1}
                  >{item.status}</div>
                  <div class="flex gap-[2px] mt-1 justify-center">
                    {#each [0,1,2] as dot}
                      <div
                        class="w-[5px] h-[5px] rounded-full"
                        class:bg-red-500={item.level === 3}
                        class:opacity-100={dot < item.level}
                        class:opacity-20={dot >= item.level}
                        style:background-color={item.level === 3 ? '#f23' : item.level === 2 ? '#fa0' : item.level === 1 ? '#ff0' : '#0f0'}
                      ></div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Hex with Strip Decoration -->
        <div>
          <p class="text-gray-500 text-xs mb-3">Hex Grid with Strip Decoration</p>
          <div class="flex flex-wrap gap-4 justify-start items-center">
            {#each [
              { mag: '7.8', depth: '10km', region: 'SUMATRA', danger: true },
              { mag: '5.2', depth: '35km', region: 'JAWA', danger: false },
              { mag: '6.4', depth: '20km', region: 'SULAWESI', danger: true },
            ] as item}
              <div class="hex-strip-cell" class:hex-danger={item.danger}>
                <div class="hex-strip-bg">
                  <div class="overflow-hidden absolute inset-0 opacity-30">
                    <div class="strip-wrapper">
                      <div class={`${item.danger ? 'strip-bar-red' : 'strip-bar'} loop-strip anim-duration-20`}></div>
                      <div class={`${item.danger ? 'strip-bar-red' : 'strip-bar'} loop-strip anim-duration-20`}></div>
                    </div>
                  </div>
                  <div class="hex-strip-content">
                    <p class="text-[8px] opacity-50 uppercase tracking-widest">{item.region}</p>
                    <p class="text-xl font-bold leading-none" class:text-glow-red={item.danger} class:text-glow={!item.danger}>{item.mag}</p>
                    <p class="text-[9px] uppercase">SR</p>
                    <p class="text-[8px] opacity-50">{item.depth}</p>
                  </div>
                </div>
              </div>
            {/each}
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
                class="w-full h-full strip-bar-vertical loop-strip-vertical-reverse anim-duration-10"
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
                class="w-full h-full strip-bar-red-vertical loop-strip-vertical anim-duration-10"
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
          <p class="ews-text danger text-lg">PERINGATAN DINI</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-glow</p>
          <p class="ews-text-glow text-lg">GLOW TEXT ORANGE</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-glow danger</p>
          <p class="ews-text-glow danger text-lg">GLOW TEXT RED</p>
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
          <p class="ews-text-glow danger text-lg ews-text-blink">
            ⚠ AWAS TSUNAMI ⚠
          </p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">ews-text-blink fast</p>
          <p class="ews-text-glow danger text-lg ews-text-blink fast">
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
          <p class="text-gray-500 text-xs mb-1">text-glow (existing)</p>
          <p class="text-glow">EXISTING GLOW</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">text-glow-red (existing)</p>
          <p class="text-glow-red">EXISTING RED GLOW</p>
        </div>
        <div>
          <p class="text-gray-500 text-xs mb-1">neon-glow (existing)</p>
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
            <option>LEVEL PERINGATAN</option>
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
              <div class="strip-wrapper">
                <div
                  class="strip-bar loop-strip anim-duration-20"
                  style="height:6px;"
                ></div>
                <div
                  class="strip-bar loop-strip anim-duration-20"
                  style="height:6px;"
                ></div>
              </div>
            </div>
            <input
              class="ews-input"
              type="text"
              placeholder="With strip decoration..."
              style="border-radius: 0;"
            />
            <div class="overflow-hidden">
              <div class="strip-wrapper">
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                  style="height:6px;"
                ></div>
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                  style="height:6px;"
                ></div>
              </div>
            </div>
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
                <div class="strip-wrapper">
                  <div
                    class="strip-bar loop-strip-reverse anim-duration-20"
                  ></div>
                  <div
                    class="strip-bar loop-strip-reverse anim-duration-20"
                  ></div>
                </div>
                <span class="absolute bg-black ews-text-glow"
                  >⚠ EMERGENCY BUTTON</span
                >
              </button>
            </div>

            <div class="flex flex-col">
              <button
                class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered-red p-1"
              >
                <div class="strip-wrapper">
                  <div class="strip-bar-red loop-strip anim-duration-20"></div>
                  <div class="strip-bar-red loop-strip anim-duration-20"></div>
                </div>
                <span class="absolute bg-black ews-text-glow danger"
                  >⚠ EMERGENCY BUTTON</span
                >
              </button>
            </div>
          </div>
        </div>
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
