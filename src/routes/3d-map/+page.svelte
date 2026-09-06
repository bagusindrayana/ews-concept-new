<script lang="ts">
  import Map3D from "$lib/components/Map3D.svelte";
  import Card from "$lib/components/Card.svelte";
  import StripeBar from "$lib/components/StripeBar.svelte";

  // Inputs
  let lat = $state(-0.501005);
  let lon = $state(117.167936);
  let range = $state(1.5);

  // Bokeh settings
  let bokehFocus = $state(30.0);
  let bokehAperture = $state(0.002);
  let bokehMaxBlur = $state(0.025);

  // Per-layer transforms (height = Y, tilt = X rotation)
  let layer1Height = $state(0.0);
  let layer1Tilt = $state(0.0);
  let layer2Height = $state(1.8);
  let layer2Tilt = $state(0.22);
  let layer3Height = $state(3.8);
  let layer3Tilt = $state(0.52);

  // Bindable outputs from the map component
  let statusMsg = $state("");
  let statusClass = $state("");
  let isFetching = $state(false);
  let map: Map3D;

  let fetchBtnDisabled = $derived(
    isFetching || isNaN(lat) || isNaN(lon) || isNaN(range) || range <= 0,
  );

  const BOKEH_STORAGE_KEY = "ews-bokeh-settings";

  // Restore saved bokeh values at init so they survive a page reload.
  (function loadBokeh() {
    try {
      const raw = localStorage.getItem(BOKEH_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.focus === "number") bokehFocus = saved.focus;
      if (typeof saved.aperture === "number") bokehAperture = saved.aperture;
      if (typeof saved.maxblur === "number") bokehMaxBlur = saved.maxblur;
    } catch {
      /* ignore malformed storage */
    }
  })();

  function saveBokeh() {
    try {
      localStorage.setItem(
        BOKEH_STORAGE_KEY,
        JSON.stringify({ focus: bokehFocus, aperture: bokehAperture, maxblur: bokehMaxBlur }),
      );
      statusMsg = "bokeh tersimpan";
      statusClass = "ok";
    } catch (e: any) {
      statusMsg = `gagal simpan: ${e?.message ?? e}`;
      statusClass = "err";
    }
  }
</script>

<div class="map-viewport font-sans">
  <Map3D
    bind:this={map}
    bind:statusMsg
    bind:statusClass
    bind:isFetching
    {lat}
    {lon}
    {range}
    bokeh={{ focus: bokehFocus, aperture: bokehAperture, maxblur: bokehMaxBlur }}
    layer1Cfg={{ height: layer1Height, tilt: layer1Tilt }}
    layer2Cfg={{ height: layer2Height, tilt: layer2Tilt }}
    layer3Cfg={{ height: layer3Height, tilt: layer3Tilt }}
  />

  <div class="absolute top-4 left-4 z-10 w-[240px] flex flex-col gap-3">
    <Card className="w-full">
      {#snippet title()}
        <StripeBar color="orange" loop={false} duration={20}>
          <div class="ews-card-text">
            <p class="p-1 bg-black font-bold text-[10px] tracking-widest text-[#ffe600]">
              BOKEH SETTINGS
            </p>
          </div>
        </StripeBar>
      {/snippet}
      {#snippet children()}
        <div class="flex flex-col gap-3 p-3 font-mono text-[10px]">
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-gray-400">FOCUS</span>
              <span class="text-[#ffe600] font-bold">{bokehFocus.toFixed(1)}</span>
            </div>
            <input type="range" min="10" max="100" step="1" bind:value={bokehFocus} class="w-full accent-[#ff6600]" />
          </div>

          <div>
            <div class="flex justify-between mb-1">
              <span class="text-gray-400">APERTURE</span>
              <span class="text-[#ffe600] font-bold">{bokehAperture.toFixed(4)}</span>
            </div>
            <input type="range" min="0.0001" max="0.0200" step="0.0001" bind:value={bokehAperture} class="w-full accent-[#ff6600]" />
          </div>

          <div>
            <div class="flex justify-between mb-1">
              <span class="text-gray-400">MAX BLUR</span>
              <span class="text-[#ffe600] font-bold">{bokehMaxBlur.toFixed(3)}</span>
            </div>
            <input type="range" min="0.0" max="0.05" step="0.001" bind:value={bokehMaxBlur} class="w-full accent-[#ff6600]" />
          </div>

          <button class="ews-btn ews-btn-primary w-full mt-1 rounded" onclick={saveBokeh}>
            SAVE BOKEH
          </button>
        </div>
      {/snippet}
    </Card>

    <Card className="w-full">
      {#snippet title()}
        <StripeBar color="cyan" loop={false} duration={20}>
          <div class="ews-card-text">
            <p class="p-1 bg-black font-bold text-[10px] tracking-widest text-[#ffe600]">
              LAYER SETTINGS
            </p>
          </div>
        </StripeBar>
      {/snippet}
      {#snippet children()}
        <div class="flex flex-col gap-3 p-3 font-mono text-[10px]">
          <div class="flex flex-col gap-2">
            <div class="text-[#00ff88] tracking-widest">LAYER 1 — TERRAIN</div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">HEIGHT</span>
                <span class="text-[#ffe600] font-bold">{layer1Height.toFixed(1)}</span>
              </div>
              <input type="range" min="-5" max="20" step="0.1" bind:value={layer1Height} class="w-full accent-[#ff6600]" />
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">TILT</span>
                <span class="text-[#ffe600] font-bold">{layer1Tilt.toFixed(2)}</span>
              </div>
              <input type="range" min="-1.5" max="1.5" step="0.01" bind:value={layer1Tilt} class="w-full accent-[#ff6600]" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-[#ff6600] tracking-widest">LAYER 2 — ROADS</div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">HEIGHT</span>
                <span class="text-[#ffe600] font-bold">{layer2Height.toFixed(1)}</span>
              </div>
              <input type="range" min="-5" max="20" step="0.1" bind:value={layer2Height} class="w-full accent-[#ff6600]" />
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">TILT</span>
                <span class="text-[#ffe600] font-bold">{layer2Tilt.toFixed(2)}</span>
              </div>
              <input type="range" min="-1.5" max="1.5" step="0.01" bind:value={layer2Tilt} class="w-full accent-[#ff6600]" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-[#ffe600] tracking-widest">LAYER 3 — GRID</div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">HEIGHT</span>
                <span class="text-[#ffe600] font-bold">{layer3Height.toFixed(1)}</span>
              </div>
              <input type="range" min="-5" max="20" step="0.1" bind:value={layer3Height} class="w-full accent-[#ff6600]" />
            </div>
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-gray-400">TILT</span>
                <span class="text-[#ffe600] font-bold">{layer3Tilt.toFixed(2)}</span>
              </div>
              <input type="range" min="-1.5" max="1.5" step="0.01" bind:value={layer3Tilt} class="w-full accent-[#ff6600]" />
            </div>
          </div>
        </div>
      {/snippet}
    </Card>
  </div>

  <div class="absolute top-4 right-4 z-20 w-[260px]">
    <Card className="w-full">
      {#snippet title()}
        <StripeBar color="red" loop={false} duration={20}>
          <div class="ews-card-text">
            <p class="p-1 bg-black font-bold text-[10px] tracking-widest text-[#ffe600]">
              KOORDINAT INPUT
            </p>
          </div>
        </StripeBar>
      {/snippet}
      {#snippet children()}
        <div class="flex flex-col gap-3 p-3">
          <div>
            <label class="ews-text text-[10px] text-gray-400 block mb-1" for="inLat">LATITUDE</label>
            <input id="inLat" class="ews-input underline text-xs" type="number" step="0.0001" bind:value={lat} />
          </div>

          <div>
            <label class="ews-text text-[10px] text-gray-400 block mb-1" for="inLon">LONGITUDE</label>
            <input id="inLon" class="ews-input underline text-xs" type="number" step="0.0001" bind:value={lon} />
          </div>

          <div>
            <label class="ews-text text-[10px] text-gray-400 block mb-1" for="inRange">RANGE (km)</label>
            <input id="inRange" class="ews-input underline text-xs" type="number" step="0.1" min="0.2" max="15" bind:value={range} />
          </div>

          <button
            class="ews-btn ews-btn-primary w-full mt-2 rounded"
            disabled={fetchBtnDisabled}
            onclick={() => map?.load()}
          >
            LOAD MAP DATA
          </button>

          {#if statusMsg}
            <div
              id="status"
              class="mt-2 text-center text-[10px] tracking-wider uppercase font-bold"
              class:ok={statusClass === "ok"}
              class:err={statusClass === "err"}
              class:loading={statusClass === "loading"}
            >
              {statusMsg}
            </div>
          {/if}
        </div>
      {/snippet}
    </Card>
  </div>
</div>

<style>
  .map-viewport {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #000c1a;
  }

  #status.ok {
    color: #00aa55;
  }
  #status.err {
    color: #ff4422;
  }
  #status.loading {
    color: #ffaa00;
  }
</style>
