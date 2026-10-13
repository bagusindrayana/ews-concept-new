import type { SpectrumFrame } from "./radioDriver";

export interface RfPeak {
  frequencyMhz: number;
  levelDbfs: number;
  snrDb: number;
}

export interface SpectrumAnalysis {
  state: "NO_FRAME" | "QUIET" | "ACTIVE";
  noiseDbfs: number;
  thresholdDbfs: number;
  peak: RfPeak | null;
  peaks: RfPeak[];
  activityPercent: number;
  occupiedBandwidthMhz: number;
  dominantBandwidthMhz: number;
  activeStartMhz: number | null;
  activeEndMhz: number | null;
  classification: string;
  confidence: number;
  explanation: string;
}

const EMPTY: SpectrumAnalysis = {
  state: "NO_FRAME",
  noiseDbfs: -100,
  thresholdDbfs: -92,
  peak: null,
  peaks: [],
  activityPercent: 0,
  occupiedBandwidthMhz: 0,
  dominantBandwidthMhz: 0,
  activeStartMhz: null,
  activeEndMhz: null,
  classification: "WAITING FOR RF FRAME",
  confidence: 0,
  explanation: "Belum ada frame spectrum dari receiver.",
};

function percentile(values: number[], p: number): number {
  if (!values.length) return -100;
  values.sort((a, b) => a - b);
  return values[Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * p)))];
}

function frequencyAt(frame: SpectrumFrame, index: number): number {
  return frame.frequency * 1e6 + (index - frame.spectrum.length / 2) * (frame.rate / frame.spectrum.length);
}

function classify(
  frame: SpectrumFrame,
  activityPercent: number,
  occupiedBandwidthMhz: number,
  dominantBandwidthMhz: number,
  peakSnrDb: number,
): Pick<SpectrumAnalysis, "classification" | "confidence" | "explanation"> {
  const center = frame.frequency;
  const in24G = center >= 2300 && center <= 2500;
  const in5G = center >= 4900 && center <= 6000;

  // These are deliberately conservative spectrum-only labels. They are not
  // protocol decoders and must not be presented as an identity guarantee.
  if (in24G && dominantBandwidthMhz >= 14 && dominantBandwidthMhz <= 30 && activityPercent >= 12) {
    return {
      classification: "WI-FI-LIKE WIDEBAND",
      confidence: Math.min(91, Math.round(54 + dominantBandwidthMhz + Math.min(20, activityPercent / 2))),
      explanation: "Lebar sinyal dan pola energi menyerupai kanal OFDM 2.4 GHz; bukan hasil decode Wi-Fi.",
    };
  }

  if (in24G && dominantBandwidthMhz >= 18 && activityPercent >= 35) {
    return {
      classification: "WIDEBAND 2.4 GHz / MICROWAVE-LIKE",
      confidence: Math.min(86, Math.round(48 + activityPercent / 2)),
      explanation: "Energi lebar dan relatif terus-menerus di ISM 2.4 GHz; bisa microwave atau interferensi lain.",
    };
  }

  if (dominantBandwidthMhz <= 3 && peakSnrDb >= 10) {
    return {
      classification: "NARROWBAND / FSK-LIKE",
      confidence: Math.min(82, Math.round(50 + peakSnrDb * 2)),
      explanation: "Sinyal sempit dengan peak kuat; mungkin carrier, FSK, remote, atau pemancar narrowband.",
    };
  }

  if ((in24G || in5G) && occupiedBandwidthMhz >= 30) {
    return {
      classification: "WIDEBAND RF ACTIVITY",
      confidence: Math.min(75, Math.round(42 + activityPercent / 2)),
      explanation: "Aktivitas memenuhi rentang lebar; protokol atau sumber tidak dapat ditentukan dari FFT saja.",
    };
  }

  return {
    classification: "UNKNOWN RF ACTIVITY",
    confidence: Math.min(65, Math.round(35 + peakSnrDb * 2)),
    explanation: "Ada energi di atas noise floor, tetapi signature belum cukup spesifik.",
  };
}

export function analyzeSpectrum(frame: SpectrumFrame | null, floor = -100): SpectrumAnalysis {
  if (!frame?.spectrum?.length) return EMPTY;

  const spectrum = frame.spectrum;
  const n = spectrum.length;
  const noiseSamples: number[] = [];
  const sampleStep = Math.max(1, Math.floor(n / 512));
  for (let i = 0; i < n; i += sampleStep) noiseSamples.push(spectrum[i]);

  const noiseDbfs = percentile(noiseSamples, 0.35);
  const thresholdDbfs = Math.max(floor + 6, noiseDbfs + 8);
  const active = new Uint8Array(n);
  let activeBins = 0;
  let minBin = n;
  let maxBin = -1;
  const runs: { start: number; end: number }[] = [];
  let runStart = -1;

  for (let i = 0; i < n; i++) {
    if (spectrum[i] >= thresholdDbfs) {
      active[i] = 1;
      activeBins++;
      minBin = Math.min(minBin, i);
      maxBin = Math.max(maxBin, i);
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      runs.push({ start: runStart, end: i - 1 });
      runStart = -1;
    }
  }
  if (runStart >= 0) runs.push({ start: runStart, end: n - 1 });

  const binWidthHz = frame.rate / n;
  const mergeGap = Math.max(1, Math.round(n * 0.0015));
  const merged: { start: number; end: number }[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && run.start - previous.end <= mergeGap) previous.end = run.end;
    else merged.push({ ...run });
  }

  let dominant = merged[0] || null;
  for (const run of merged) {
    if (!dominant || run.end - run.start > dominant.end - dominant.start) dominant = run;
  }

  const peaks: RfPeak[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (!active[i] || spectrum[i] < spectrum[i - 1] || spectrum[i] < spectrum[i + 1]) continue;
    const peak: RfPeak = {
      frequencyMhz: frequencyAt(frame, i) / 1e6,
      levelDbfs: spectrum[i],
      snrDb: spectrum[i] - noiseDbfs,
    };
    const separation = Math.max(2, Math.round(n * 0.004));
    if (!peaks.some((p) => Math.abs((p.frequencyMhz * 1e6 - frequencyAt(frame, i)) / binWidthHz) < separation)) {
      peaks.push(peak);
    }
  }
  peaks.sort((a, b) => b.levelDbfs - a.levelDbfs);
  const topPeaks = peaks.slice(0, 5);
  const peak = topPeaks[0] || null;

  const occupiedBandwidthMhz = maxBin >= minBin ? ((maxBin - minBin + 1) * binWidthHz) / 1e6 : 0;
  const dominantBandwidthMhz = dominant ? ((dominant.end - dominant.start + 1) * binWidthHz) / 1e6 : 0;
  const classification = activeBins
    ? classify(frame, (activeBins / n) * 100, occupiedBandwidthMhz, dominantBandwidthMhz, peak?.snrDb || 0)
    : {
        classification: "QUIET / NO SIGNIFICANT RF",
        confidence: 100,
        explanation: "Tidak ada bin yang melewati adaptive noise threshold.",
      };

  return {
    state: activeBins ? "ACTIVE" : "QUIET",
    noiseDbfs,
    thresholdDbfs,
    peak,
    peaks: topPeaks,
    activityPercent: (activeBins / n) * 100,
    occupiedBandwidthMhz,
    dominantBandwidthMhz,
    activeStartMhz: minBin < n ? frequencyAt(frame, minBin) / 1e6 : null,
    activeEndMhz: maxBin >= 0 ? frequencyAt(frame, maxBin) / 1e6 : null,
    ...classification,
  };
}
