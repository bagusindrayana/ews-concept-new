<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { createWaterfallLut, type SpectrumFrame } from "$lib/esp-sdr/radioDriver";

  interface Props {
    frame: SpectrumFrame | null;
    floor?: number;       // dBFS min, default -100
    range?: number;       // dBFS range, default 80
    isConnected?: boolean;
    axesColor?: string;
  }

  let {
    frame = null,
    floor = -100,
    range = 80,
    isConnected = false,
    axesColor = "#fa0"
  }: Props = $props();

  let container: HTMLDivElement;
  let waterfallCanvas: HTMLCanvasElement;
  let rulerCanvas: HTMLCanvasElement;

  let width = $state(800);
  let height = $state(325);

  let resizeObserver: ResizeObserver | null = null;
  let lut32: Uint32Array | null = null;
  let lastSequence = -1;

  export function clear() {
    if (!waterfallCanvas) return;
    const ctx = waterfallCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#03070a";
    ctx.fillRect(0, 0, waterfallCanvas.width, waterfallCanvas.height);
  }

  function pushSpectrumRow(spectrum: Float32Array) {
    if (!waterfallCanvas || width <= 0 || height <= 0) return;
    const ctx = waterfallCanvas.getContext("2d");
    if (!ctx) return;

    if (!lut32) {
      lut32 = createWaterfallLut();
    }

    const w = waterfallCanvas.width;
    const h = waterfallCanvas.height;
    const nb = spectrum.length;

    // 1. Scroll canvas content down by 1 pixel row
    ctx.drawImage(waterfallCanvas, 0, 0, w, h - 1, 0, 1, w, h - 1);

    // 2. Generate top row pixel data
    const imgData = ctx.createImageData(w, 1);
    const px32 = new Uint32Array(imgData.data.buffer);
    const scale = 255 / (range || 80);

    for (let x = 0; x < w; x++) {
      const f0 = (x / w) * nb;
      const f1 = ((x + 1) / w) * nb;
      const idxStart = Math.max(0, Math.min(nb - 1, Math.floor(f0)));
      const idxEnd = Math.max(idxStart + 1, Math.min(nb, Math.ceil(f1)));

      let maxVal = -Infinity;
      for (let j = idxStart; j < idxEnd; j++) {
        if (spectrum[j] > maxVal) maxVal = spectrum[j];
      }

      let q = Math.floor((maxVal - floor) * scale);
      if (q < 0) q = 0;
      else if (q > 255) q = 255;

      px32[x] = lut32[q];
    }

    // 3. Put new row at y = 0
    ctx.putImageData(imgData, 0, 0);
  }

  function drawRuler() {
    if (!rulerCanvas) return;
    const ctx = rulerCanvas.getContext("2d");
    if (!ctx) return;

    const rw = rulerCanvas.width;
    const rh = rulerCanvas.height;
    const isMobile = width < 768;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, rw, rh);

    // Right-aligned vertical orange axis line
    ctx.strokeStyle = axesColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rw, 0);
    ctx.lineTo(rw, rh);

    ctx.fillStyle = axesColor;
    ctx.font = isMobile ? 'bold 9px "Inter", sans-serif' : 'bold 11px "Inter", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const labels = [
      { text: "TOP", y: 10 },
      { text: "HIST", y: rh * 0.33 },
      { text: "SPAN", y: rh * 0.66 },
      { text: "END", y: rh - 10 }
    ];

    for (const item of labels) {
      ctx.moveTo(rw - (isMobile ? 4 : 8), item.y);
      ctx.lineTo(rw, item.y);
      ctx.fillText(item.text, rw - (isMobile ? 6 : 10), item.y);
    }
    ctx.stroke();
  }

  function resize() {
    if (!container || !waterfallCanvas || !rulerCanvas) return;
    const rect = container.getBoundingClientRect();
    const newW = Math.floor(rect.width);
    const newH = 325;

    const isMobile = newW < 768;
    const leftPadding = isMobile ? 45 : 70;
    const rightPadding = isMobile ? 12 : 24;
    const drawWidth = Math.max(10, newW - leftPadding - rightPadding);

    width = newW;
    height = newH;

    // Sizing ruler canvas
    rulerCanvas.width = leftPadding;
    rulerCanvas.height = height;
    rulerCanvas.style.width = `${leftPadding}px`;
    rulerCanvas.style.height = `${height}px`;
    drawRuler();

    // Sizing waterfall canvas to match spectrum drawWidth!
    const oldCanvas = document.createElement("canvas");
    oldCanvas.width = waterfallCanvas.width;
    oldCanvas.height = waterfallCanvas.height;
    const oldCtx = oldCanvas.getContext("2d");
    if (oldCtx && waterfallCanvas.width > 0 && waterfallCanvas.height > 0) {
      oldCtx.drawImage(waterfallCanvas, 0, 0);
    }

    waterfallCanvas.width = drawWidth;
    waterfallCanvas.height = height;
    waterfallCanvas.style.width = `${drawWidth}px`;
    waterfallCanvas.style.height = `${height}px`;

    const ctx = waterfallCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#03070a";
      ctx.fillRect(0, 0, drawWidth, height);
      if (oldCanvas.width > 0 && oldCanvas.height > 0) {
        ctx.drawImage(oldCanvas, 0, 0, drawWidth, height);
      }
    }
  }

  // React to new incoming frame
  $effect(() => {
    if (frame && frame.sequence !== lastSequence && frame.spectrum) {
      lastSequence = frame.sequence;
      pushSpectrumRow(frame.spectrum);
    }
  });

  onMount(() => {
    resize();
    resizeObserver = new ResizeObserver(() => resize());
    if (container) resizeObserver.observe(container);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<div
  bind:this={container}
  class="w-full flex flex-col bg-black border-2 border-[#fa0] rounded overflow-hidden shadow-2xl select-none"
>
  <!-- Waterfall Header -->
  <div class="flex items-center justify-between px-3 py-1.5 bg-[#080808] border-b border-[#fa0]/40 text-xs font-mono">
    <div class="flex items-center gap-2">
    
      <span class="text-[#fa0] font-black tracking-wider uppercase">WATERFALL SPECTROGRAM MONITOR</span>
    </div>
    <div class="text-[#fa0] font-bold font-mono">
      {floor} → {floor + range} dBFS
    </div>
  </div>

  <!-- Waterfall Canvas Area with Matching Left Orange Ruler -->
  <div class="relative w-full h-[325px] bg-black flex items-stretch">
    <!-- Left Orange Ruler (Aligns with Spectrum left ruler) -->
    <canvas bind:this={rulerCanvas} class="block shrink-0"></canvas>

    <!-- Main Waterfall Canvas (Aligns with Spectrum drawWidth) -->
    <div class="relative grow overflow-hidden bg-[#03070a]">
      <canvas bind:this={waterfallCanvas} class="block w-full h-full"></canvas>

      {#if !isConnected && (!frame || frame.sequence === 0)}
        <!-- Empty State Overlay -->
        <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-center p-4">
          
          <h3 class="text-sm font-bold tracking-widest text-[#fa0] uppercase font-mono mb-1">
            CONNECT ESP-SDR TO START
          </h3>
          <p class="text-[11px] text-[#8a9ba3] max-w-xs font-mono">
            Connect via WebSerial or launch Demo Simulation.
          </p>
        </div>
      {/if}
    </div>

    <!-- Right Margin to match Spectrum right padding -->
    <div class="w-3 md:w-6 shrink-0 bg-black"></div>
  </div>

  <!-- Footer Diagnostic Stats Bar -->
  <div
    class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-1.5 bg-[#050505] border-t border-[#fa0]/40 text-[11px] font-mono text-[#8a9ba3] "
  >
    <div class="flex items-center gap-1.5">
      <span class="text-[#fa0]">SPEED:</span>
      <b class="text-red font-semibold">{frame?.fps || 0} spectra/s</b>
    </div>

    <div class="flex items-center gap-1.5">
      <span class="text-[#fa0]">THROUGHPUT:</span>
      <b class="text-red font-semibold">{frame?.deliveredKsps || 0} kB/s over USB · {(frame ? frame.rate / 1e6 : 80)} MS/s</b>
    </div>

    <div class="flex items-center gap-1.5">
      <span class="text-[#fa0]">LATENCY:</span>
      <b class="text-red font-semibold">{frame?.elapsedMs || 0} ms</b>
    </div>

    <div class="flex items-center gap-1.5">
      <span class="text-[#fa0]">PEAK:</span>
      <b class="text-red font-semibold">{(frame ? frame.peakHz / 1e6 : 2412).toFixed(4)} MHz</b>
    </div>

    <div class="flex items-center gap-1.5">
      <span class={frame?.crcOk ? "text-[#33cc55]" : "text-red-400"}>
        {frame?.crcOk ? `CRC OK · #${frame.sequence}` : "CRC ERR"}
      </span>
      {#if frame?.dropped}
        <span class="text-red-400">({frame.dropped} dropped)</span>
      {/if}
    </div>
  </div>
</div>
