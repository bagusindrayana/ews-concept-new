<script lang="ts">
  import type { SpectrumFrame } from "$lib/esp-sdr/radioDriver";
  import { analyzeSpectrum, type SpectrumAnalysis } from "$lib/esp-sdr/rfAnalyzer";

  interface Props {
    frame: SpectrumFrame | null;
    floor?: number;
    isConnected?: boolean;
    scanning?: boolean;
    scanLabel?: string;
    onToggleScan?: () => void;
  }

  let {
    frame = null,
    floor = -100,
    isConnected = false,
    scanning = false,
    scanLabel = "START WEB SCAN",
    onToggleScan = () => {},
  }: Props = $props();

  let analysis = $derived<SpectrumAnalysis>(analyzeSpectrum(frame, floor));
  let history = $state<number[]>([]);
  let lastSequence = 0;

  $effect(() => {
    const sequence = frame?.sequence || 0;
    if (!sequence || sequence === lastSequence) return;
    lastSequence = sequence;
    history = [...history.slice(-47), Math.min(100, analysis.activityPercent)];
  });

  const fmt = (value: number | null | undefined, digits = 1) =>
    value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
  const statusColor = $derived(
    analysis.state === "ACTIVE" ? "text-red-400" : analysis.state === "QUIET" ? "text-green-400" : "text-neutral-500",
  );
</script>

<div class="bordered border-[#ff2200]/40 bg-black p-2 font-mono text-[10px]">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#321016] pb-1.5">
    <div class="flex items-center gap-2 font-bold tracking-wider text-[#ff2200]">
      <span>RF SIGNAL ANALYSIS</span>
      <span class="text-[9px] text-neutral-500">SPECTRUM HEURISTIC</span>
    </div>
    <div class="flex items-center gap-2">
      <span class={statusColor}>{analysis.state}</span>
      <span class="text-neutral-500">{isConnected ? "LIVE" : "STANDBY"}</span>
      <button
        type="button"
        class="border border-[#ff5500]/60 px-2 py-1 text-[9px] font-bold tracking-wider text-[#fa0] hover:bg-[#32140a] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!isConnected}
        onclick={onToggleScan}
      >{scanning ? "STOP WEB SCAN" : scanLabel}</button>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-1.5 py-2 sm:grid-cols-4 lg:grid-cols-7">
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">CLASS</span><strong class="text-[#fa0]">{analysis.classification}</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">CONFIDENCE</span><strong class="text-white">{analysis.confidence}%</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">NOISE</span><strong class="text-white">{fmt(analysis.noiseDbfs)} dBFS</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">THRESHOLD</span><strong class="text-white">{fmt(analysis.thresholdDbfs)} dBFS</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">ACTIVITY</span><strong class="text-white">{fmt(analysis.activityPercent)}%</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">OCCUPIED BW</span><strong class="text-white">{fmt(analysis.occupiedBandwidthMhz)} MHz</strong></div>
    <div class="bg-[#0b1013] p-1.5"><span class="block text-[#546e7a]">PEAK</span><strong class="text-white">{fmt(analysis.peak?.frequencyMhz, 4)} MHz</strong></div>
  </div>

  <div class="grid gap-2 lg:grid-cols-[1fr_2fr]">
    <div class="border border-[#1c2930] bg-[#080d10] p-1.5">
      <div class="mb-1 flex items-center justify-between text-[#546e7a]">
        <span>ACTIVITY HISTORY</span><span>48 FRAMES</span>
      </div>
      <div class="flex h-12 items-end gap-px border-b border-[#26343a]">
        {#each history as value}
          <div class="min-w-[2px] flex-1 bg-[#ff3300]" style={`height:${Math.max(2, value)}%`}></div>
        {/each}
      </div>
    </div>

    <div class="border border-[#1c2930] bg-[#080d10] p-1.5">
      <div class="mb-1 flex items-center justify-between text-[#546e7a]">
        <span>DETECTED PEAKS</span>
        <span>{analysis.activeStartMhz === null ? "NO ACTIVE REGION" : `${fmt(analysis.activeStartMhz, 3)}–${fmt(analysis.activeEndMhz, 3)} MHz`}</span>
      </div>
      {#if analysis.peaks.length}
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
          {#each analysis.peaks as peak}
            <div class="flex justify-between gap-2 border-b border-[#172127] pb-0.5">
              <span class="text-[#fa0]">{peak.frequencyMhz.toFixed(4)}</span>
              <span class="text-white">{peak.snrDb.toFixed(1)} dB</span>
            </div>
          {/each}
        </div>
      {:else}
        <span class="text-neutral-500">No significant peaks above adaptive threshold.</span>
      {/if}
    </div>
  </div>

  <div class="mt-1.5 border-t border-[#321016] pt-1.5 text-[9px] text-neutral-500">
    {analysis.explanation} This panel does not decode packets or identify a device with certainty.
  </div>
</div>
