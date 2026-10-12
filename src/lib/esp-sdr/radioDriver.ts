/**
 * WebSerial & WebUSB SDR Driver for ESP32 running ESP-SDR firmware.
 * Based on ESP-WebSDR (https://github.com/ESPARGOS/esp-web-sdr)
 */
import { SerialConnection, NativeUSBPort } from './serialTransport';

export { SerialConnection, NativeUSBPort };

export interface CaptureConfig {
  frequency: number; // Center frequency in MHz (e.g. 2412)
  rate: number;      // Sample rate in Hz (e.g. 80000000 for 80 MS/s)
  bits: number;      // Sample bit depth: 8 or 10
  fft: number;       // FFT size: 256, 512, 1024, 2048, 4096
  bandwidth: number; // Analog bandwidth in MHz (0 = auto)
  gainMode: 'HARDWARE' | 'MANUAL';
  gain: number;      // Manual gain code (e.g. 40)
  maxHold: boolean;
  dcMode: 'raw' | 'fill' | 'offset';
  traceAvg: number;  // 0: Off, 0.3: Short, 0.65: Medium, 0.9: High
  floor: number;     // dBFS floor (e.g. -100)
  range: number;     // dBFS range (e.g. 80)
}

export interface SpectrumFrame {
  frequency: number;
  rate: number;
  fft: number;
  spectrum: Float32Array;
  maxHoldSpectrum?: Float32Array;
  peakHz: number;
  peakDbfs: number;
  fps: number;
  deliveredKsps: number;
  elapsedMs: number;
  crcOk: boolean;
  sequence: number;
  samples: number;
  dropped: number;
  mode: string;
  gainActual?: { mode: string; index: number | null };
}

export interface EspDeviceStats {
  core0Load: number;    // Core 0 CPU %
  core1Load: number;    // Core 1 CPU %
  coverage: number;     // % coverage
  heapFree: number;     // Free heap bytes
  fftsPerSec: number;   // On-chip FFTs/s
  updatedAt: number;
}

export interface EspDeviceInfo {
  connected: boolean;
  simulated: boolean;
  chipModel: string;      // e.g. "ESP32-S3", "ESP32-C3", "ESP32"
  chipFamily: string;     // e.g. "S3", "C3", "ESP32"
  chipArch: string;       // e.g. "Xtensa LX7 Dual-Core 240MHz + SIMD"
  firmware: string;       // e.g. "ESP-SDR (Protocol 6)"
  rawIdentity: string;    // e.g. "S3SDR 6 burst 16380"
  maxSamples: number;     // e.g. 16380
  transport: string;      // "USB" | "UART" | "Virtual WebSerial"
  baudRate: number;       // e.g. 2000000
  usbVendor: string;      // e.g. "Espressif Systems"
  usbProduct: string;     // e.g. "ESP32-S3 Native USB Serial/JTAG"
  usbVidHex: string;      // e.g. "0x303A"
  usbPidHex: string;      // e.g. "0x1001"
  caps: string[];         // e.g. ["SPEC", "SPECN", "GAIN", ...]
  hasSpec: boolean;
  hasSpecN: boolean;
  hasGain: boolean;
  tuneRange: [number, number] | null;
  specCapabilities: any;
  rxLimits?: string | null;
}

export function identifyUsbDevice(vid?: number, pid?: number): {
  vendor: string;
  product: string;
  vidHex: string;
  pidHex: string;
} {
  const vidHex = vid !== undefined ? `0x${vid.toString(16).toUpperCase().padStart(4, '0')}` : 'N/A';
  const pidHex = pid !== undefined ? `0x${pid.toString(16).toUpperCase().padStart(4, '0')}` : 'N/A';

  if (!vid) {
    return {
      vendor: 'Generic Serial',
      product: 'UART / USB Serial Controller',
      vidHex,
      pidHex
    };
  }

  let vendor = 'USB Device';
  let product = `Serial Bridge (${vidHex}:${pidHex})`;

  switch (vid) {
    case 0x303a:
      vendor = 'Espressif Systems';
      switch (pid) {
        case 0x1001: product = 'ESP32-S3 / C3 Native USB JTAG/Serial'; break;
        case 0x1002: product = 'ESP32-C6 Native USB JTAG/Serial'; break;
        case 0x1003: product = 'ESP32-H2 Native USB JTAG/Serial'; break;
        case 0x1007: product = 'ESP32-P4 Native USB JTAG/Serial'; break;
        case 0x0002: product = 'ESP32-S2 Native USB CDC'; break;
        default: product = 'Espressif Native USB Controller'; break;
      }
      break;

    case 0x10c4:
      vendor = 'Silicon Laboratories';
      switch (pid) {
        case 0xea60: product = 'CP2102 / CP2104 USB-to-UART Bridge'; break;
        case 0xea70: product = 'CP2105 Dual Port USB-to-UART'; break;
        default: product = 'CP210x USB-to-UART Bridge'; break;
      }
      break;

    case 0x1a86:
      vendor = 'WCH (Nanjing Qinheng)';
      switch (pid) {
        case 0x7523: product = 'CH340 USB-to-Serial Bridge'; break;
        case 0x5523: product = 'CH341 USB-to-Serial Bridge'; break;
        case 0x55d4: product = 'CH343 / CH9102 High-Speed USB-Serial'; break;
        case 0x55e5: product = 'CH347 High-Speed USB Bridge'; break;
        default: product = 'WCH CH34x USB-Serial Controller'; break;
      }
      break;

    case 0x0403:
      vendor = 'FTDI';
      switch (pid) {
        case 0x6001: product = 'FT232R USB UART'; break;
        case 0x6010: product = 'FT2232H Dual USB UART'; break;
        case 0x6014: product = 'FT232H High-Speed USB UART'; break;
        case 0x6015: product = 'FT-X Series USB UART'; break;
        default: product = 'FTDI USB Serial Device'; break;
      }
      break;

    case 0x067b:
      vendor = 'Prolific Technology';
      switch (pid) {
        case 0x2303: product = 'PL2303 USB-to-Serial Bridge'; break;
        default: product = 'Prolific USB-Serial Controller'; break;
      }
      break;

    case 0x2e8a:
      vendor = 'Raspberry Pi';
      product = 'RP2040 / Pico USB Serial';
      break;
  }

  return { vendor, product, vidHex, pidHex };
}

export function identifyEspChip(family: string): { model: string; arch: string; defaultRange: [number, number] } {
  const f = (family || '').toUpperCase();
  switch (f) {
    case 'ESP32':
      return {
        model: 'ESP32',
        arch: 'Xtensa® LX6 Dual-Core @ 240MHz (Wi-Fi 4 + BT 4.2)',
        defaultRange: [2400, 2484]
      };
    case 'S2':
      return {
        model: 'ESP32-S2',
        arch: 'Xtensa® LX7 Single-Core @ 240MHz (Wi-Fi 4 + USB OTG)',
        defaultRange: [2400, 2484]
      };
    case 'S3':
      return {
        model: 'ESP32-S3',
        arch: 'Xtensa® LX7 Dual-Core @ 240MHz + AI/SIMD Vector (Wi-Fi 4 + BLE 5)',
        defaultRange: [2400, 2484]
      };
    case 'S31':
      return {
        model: 'ESP32-S31',
        arch: 'Xtensa® LX7 Dual-Core with Ethernet PHY Interface',
        defaultRange: [2400, 2484]
      };
    case 'C2':
      return {
        model: 'ESP32-C2 / ESP8684',
        arch: 'RISC-V 32-bit Single-Core @ 120MHz (Wi-Fi 4 + BLE 5)',
        defaultRange: [2400, 2484]
      };
    case 'C3':
      return {
        model: 'ESP32-C3',
        arch: 'RISC-V 32-bit Single-Core @ 160MHz (Wi-Fi 4 + BLE 5)',
        defaultRange: [2400, 2484]
      };
    case 'C5':
      return {
        model: 'ESP32-C5',
        arch: 'RISC-V 32-bit Dual-Band 2.4/5GHz @ 240MHz (Wi-Fi 6 + BLE 5)',
        defaultRange: [2400, 5850]
      };
    case 'C6':
      return {
        model: 'ESP32-C6',
        arch: 'RISC-V 32-bit Single-Core @ 160MHz (Wi-Fi 6 + BLE 5 + 802.15.4)',
        defaultRange: [2400, 2484]
      };
    case 'C61':
      return {
        model: 'ESP32-C61',
        arch: 'RISC-V 32-bit Wi-Fi 6 @ 160MHz',
        defaultRange: [2400, 2484]
      };
    case 'H2':
      return {
        model: 'ESP32-H2',
        arch: 'RISC-V 32-bit @ 96MHz (IEEE 802.15.4 / Thread / Zigbee + BLE 5.4)',
        defaultRange: [2400, 2484]
      };
    default:
      return {
        model: family ? `ESP32-${family}` : 'ESP32-SDR',
        arch: 'Espressif 32-bit Wireless SoC',
        defaultRange: [2400, 2500]
      };
  }
}

export interface LogEntry {
  id: number;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'rx';
  message: string;
}

// 256-color LUT for SDR waterfall (ESPARGOS palette)
export const WATERFALL_COLOR_STOPS: [number, number, number][] = [
  [3, 8, 23],       // Deep dark navy
  [18, 31, 81],     // Dark blue
  [38, 63, 153],    // Blue
  [30, 139, 181],   // Cyan-teal
  [66, 213, 174],   // Mint green
  [217, 237, 103],  // Lime yellow
  [255, 162, 61],   // Bright orange
  [255, 244, 228]   // Cream white
];

export function createWaterfallLut(): Uint32Array {
  const stops = WATERFALL_COLOR_STOPS;
  const lut32 = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const p = (i / 255) * (stops.length - 1);
    const j = Math.min(stops.length - 2, Math.floor(p));
    const t = p - j;
    const r = Math.round(stops[j][0] * (1 - t) + stops[j + 1][0] * t);
    const g = Math.round(stops[j][1] * (1 - t) + stops[j + 1][1] * t);
    const b = Math.round(stops[j][2] * (1 - t) + stops[j + 1][2] * t);
    // Little-endian RGBA memory layout: 0xAABBGGRR
    lut32[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return lut32;
}

// CRC32 implementation
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// MessageChannel yielding to prevent tab throttling
let yieldFn: (() => Promise<void>) | null = null;
function yieldTask(): Promise<void> {
  if (!yieldFn) {
    if (typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      const waiting: (() => void)[] = [];
      channel.port1.onmessage = () => waiting.shift()?.();
      yieldFn = () => new Promise(resolve => {
        waiting.push(resolve);
        channel.port2.postMessage(0);
      });
    } else {
      yieldFn = () => new Promise(r => setTimeout(r, 0));
    }
  }
  return yieldFn();
}

// Client-side FFT for Burst IQ streaming
function fftInPlace(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len *= 2) {
    const a = -2 * Math.PI / len;
    const cr = Math.cos(a), ci = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const k = i + j, l = k + len / 2;
        const tr = re[l] * wr - im[l] * wi;
        const ti = re[l] * wi + im[l] * wr;
        re[l] = re[k] - tr;
        im[l] = im[k] - ti;
        re[k] += tr;
        im[k] += ti;
        const next = wr * cr - wi * ci;
        wi = wr * ci + wi * cr;
        wr = next;
      }
    }
  }
}

let spectrumWorkspace: {
  n: number;
  window: Float64Array;
  norm: number;
  sums: Float64Array;
  re: Float64Array;
  im: Float64Array;
} | null = null;

function computeSpectrum(iq: Float32Array, n: number): Float32Array {
  if (!spectrumWorkspace || spectrumWorkspace.n !== n) {
    const window = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    spectrumWorkspace = {
      n,
      window,
      norm: window.reduce((a, b) => a + b, 0) ** 2,
      sums: new Float64Array(n),
      re: new Float64Array(n),
      im: new Float64Array(n)
    };
  }
  const { window, norm, sums, re, im } = spectrumWorkspace;
  const blocks = Math.floor(iq.length / 2 / n);
  sums.fill(0);
  for (let b = 0; b < blocks; b++) {
    let mi = 0, mq = 0;
    for (let j = 0; j < n; j++) {
      mi += iq[2 * (b * n + j)];
      mq += iq[2 * (b * n + j) + 1];
    }
    mi /= n; mq /= n;
    for (let j = 0; j < n; j++) {
      re[j] = (iq[2 * (b * n + j)] - mi) * window[j];
      im[j] = (iq[2 * (b * n + j) + 1] - mq) * window[j];
    }
    fftInPlace(re, im);
    for (let j = 0; j < n; j++) sums[j] += re[j] ** 2 + im[j] ** 2;
  }
  const out = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const val = blocks ? sums[(j + Math.floor(n / 2)) % n] / norm / blocks : 0;
    out[j] = 10 * Math.log10(Math.max(1e-14, val));
  }
  return out;
}

// Convert firmware on-chip spectrum bins to dBFS
export function specToDbfs(bins: Uint8Array, step: number, n: number, dcMode: string = 'raw'): Float32Array {
  const out = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const v = bins[(Math.floor(n / 2) - j + n) % n];
    out[j] = v / step - 84.3;
  }
  if (dcMode === 'fill') {
    const c = Math.floor(n / 2);
    if (c >= 2 && c + 2 < n) {
      const m = 10 * Math.log10((10 ** (out[c - 2] / 10) + 10 ** (out[c + 2] / 10)) / 2);
      out[c - 1] = out[c] = out[c + 1] = m;
    }
  }
  return out;
}

// Incremental decoder for ESP32 on-chip spectrum frames
class SpectrumDecoder {
  n: number;
  bytes: Uint8Array = new Uint8Array(0);
  crcErrors: number = 0;

  constructor(n: number) {
    this.n = n;
  }

  feed(incoming: Uint8Array): { header?: any; bins?: Uint8Array; report?: string; status?: number; stats?: any }[] {
    const joined = new Uint8Array(this.bytes.length + incoming.length);
    joined.set(this.bytes);
    joined.set(incoming, this.bytes.length);
    this.bytes = joined;

    const events: any[] = [];
    let at = 0;

    while (this.bytes.length - at >= 4) {
      const b = this.bytes.subarray(at);
      if (b[0] !== 83 || b[1] !== 80) { // 'S', 'P'
        at++;
        continue;
      }

      // Check SPECEND
      if (b[2] === 69 && b[3] === 67) { // 'E', 'C'
        if (b.length < 8) break;
        const prefix = String.fromCharCode(...b.subarray(0, 8));
        if (prefix !== 'SPECEND ') {
          at++;
          continue;
        }
        const end = b.indexOf(10); // '\n'
        if (end < 0) {
          if (b.length > 256) { at++; continue; }
          break;
        }
        const report = String.fromCharCode(...b.subarray(0, end)).trim();
        if (!/^SPECEND(?: \d+){12}$/.test(report)) {
          at++;
          continue;
        }
        events.push({ report, status: Number(report.split(' ')[1]) });
        at += end + 1;
        continue;
      }

      // Check SPS1 (stats)
      if (b[2] === 83 && b[3] === 49) {
        if (b.length < 40) break;
        const dv = new DataView(b.buffer, b.byteOffset, 40);
        if (crc32(b.subarray(0, 36)) !== dv.getUint32(36, true)) {
          this.crcErrors++;
          at++;
          continue;
        }
        events.push({
          stats: {
            core0: dv.getUint16(4, true) / 10,
            core1: dv.getUint16(6, true) / 10,
            coverage: dv.getUint16(8, true) / 10,
            heapFree: dv.getUint32(12, true),
            fftsPerS: dv.getUint32(32, true),
            t: performance.now()
          }
        });
        at += 40;
        continue;
      }

      // Check SPC1 (Spectrum binary frame)
      if (b[2] !== 67 || b[3] !== 49) { // 'C', '1'
        at++;
        continue;
      }

      const length = 32 + this.n;
      if (b.length < length) {
        const text = String.fromCharCode(...b.subarray(0, Math.min(b.length, 32)));
        const stop = text.indexOf('SPECEND ');
        if (stop >= 0) {
          this.crcErrors++;
          at += stop;
          continue;
        }
        break;
      }

      const dv = new DataView(b.buffer, b.byteOffset, length);
      if (b[26] !== Math.log2(this.n) || b[27] !== 2 || crc32(b.subarray(0, length - 4)) !== dv.getUint32(length - 4, true)) {
        this.crcErrors++;
        at++;
        continue;
      }

      const h = {
        frame: dv.getUint32(4, true),
        pairIndex: Number(dv.getBigUint64(8, true)),
        pairs: dv.getUint32(16, true),
        ffts: dv.getUint16(20, true),
        flags: b[22],
        gain: b[23],
        drops: dv.getUint16(24, true),
        step: b[27],
        n: this.n,
        bytes: length
      };

      events.push({ header: h, bins: b.slice(28, 28 + this.n) });
      at += length;
    }

    this.bytes = this.bytes.slice(at);
    return events;
  }
}

/**
 * Main ESP-SDR Driver class
 */
export class EspSdrDriver {
  port: any = null;
  reader: any = null;
  writer: any = null;
  queue: Uint8Array[] = [];
  queued: number = 0;
  private wakeListeners: Set<() => void> = new Set();
  failed: Error | null = null;
  tail: Promise<any> = Promise.resolve();

  // Firmware & connection state
  identity: string = '';
  family: string = 'ESP32';
  maxSamples: number = 16380;
  baudRate: number = 2000000;
  transport: string = 'UART';
  hasSpec: boolean = false;
  hasSpecN: boolean = false;
  hasSpecStats: boolean = false;
  hasGain: boolean = false;
  activeConfig: CaptureConfig | null = null;
  simConfig: CaptureConfig | null = null;
  private pendingConfigChange: boolean = false;
  specCapabilities: any = null;
  tuneRange: [number, number] | null = null;
  portInfo: { usbVendorId?: number; usbProductId?: number } = {};
  capsList: string[] = [];
  rxLimits: string | null = null;

  // Rich Device Information & On-Chip Telemetry
  deviceInfo: EspDeviceInfo | null = null;
  deviceStats: EspDeviceStats | null = null;

  // Running status
  isConnected: boolean = false;
  isStreaming: boolean = false;
  isSimulating: boolean = false;
  simTimer: any = null;
  simStartTime: number = 0;

  // Measurement stats
  sequence: number = 0;
  droppedCaptures: number = 0;
  lastFpsTimestamp: number = 0;
  fpsCounter: number = 0;
  currentFps: number = 0;

  // Smoothed traces
  smoothedTrace: Float32Array | null = null;
  maxHoldTrace: Float32Array | null = null;

  // Log ID counter
  private logId = 0;

  // Callbacks
  onLog?: (entry: LogEntry) => void;
  onFrame?: (frame: SpectrumFrame) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error') => void;
  onDeviceInfo?: (info: EspDeviceInfo | null) => void;
  onStats?: (stats: EspDeviceStats | null) => void;
  onConfigAdjusted?: (config: CaptureConfig) => void;

  constructor() {}

  spectrumProfiles(rate?: number): number[][] {
    const list: number[][] = this.specCapabilities?.profiles || [];
    if (rate !== undefined) {
      return list.filter((p: any) => p[0] === rate);
    }
    return list;
  }

  static isSupported(): boolean {
    return SerialConnection.isSupported();
  }

  static isWebSerialSupported(): boolean {
    return SerialConnection.isWebSerialSupported();
  }

  static isWebUsbSupported(): boolean {
    return SerialConnection.isWebUsbSupported();
  }

  static isMobile(): boolean {
    return SerialConnection.isMobile();
  }

  log(type: 'info' | 'success' | 'warn' | 'error' | 'rx', message: string) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry: LogEntry = {
      id: ++this.logId,
      timestamp: timeStr,
      type,
      message
    };
    if (this.onLog) {
      const cb = this.onLog;
      queueMicrotask(() => {
        try { cb(entry); } catch {}
      });
    }
  }

  private notifyWake() {
    if (this.wakeListeners.size > 0) {
      const callbacks = Array.from(this.wakeListeners);
      this.wakeListeners.clear();
      for (const cb of callbacks) {
        try { cb(); } catch {}
      }
    }
  }

  private run<T>(f: () => Promise<T>): Promise<T> {
    const p = this.tail.then(f);
    this.tail = p.catch(() => {});
    return p;
  }

  private async pump() {
    try {
      while (this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.queue.push(value);
          this.queued += value.length;
          if (this.queued > 2 * 1024 * 1024) {
            throw new Error('WebSerial queue overflow (> 2MB)');
          }
          this.notifyWake();
        }
      }
    } catch (e: any) {
      this.failed = e;
    } finally {
      this.failed ||= new Error('WebSerial connection closed');
      this.notifyWake();
    }
  }

  private async read(n: number, deadline = performance.now() + 5000, idleMs = Infinity): Promise<Uint8Array> {
    let idleDeadline = performance.now() + idleMs;
    const out = new Uint8Array(n);
    let offset = 0;

    while (offset < n) {
      if (this.queued > 0) {
        const b = this.queue[0];
        const k = Math.min(n - offset, b.length);
        out.set(b.subarray(0, k), offset);
        offset += k;
        this.queued -= k;
        idleDeadline = performance.now() + idleMs;
        if (k === b.length) this.queue.shift();
        else this.queue[0] = b.subarray(k);
        continue;
      }

      if (this.failed) throw this.failed;

      const ms = Math.min(deadline, idleDeadline) - performance.now();
      if (ms <= 0) {
        throw Object.assign(new Error('WebSerial response timed out'), { code: 'SERIAL_TIMEOUT' });
      }

      await new Promise<void>((resolve, reject) => {
        let timer: any = null;
        const onWake = () => {
          if (timer) clearTimeout(timer);
          this.wakeListeners.delete(onWake);
          resolve();
        };
        timer = setTimeout(() => {
          this.wakeListeners.delete(onWake);
          reject(Object.assign(new Error('WebSerial read timed out'), { code: 'SERIAL_TIMEOUT' }));
        }, ms);
        this.wakeListeners.add(onWake);
      });
    }

    return out;
  }

  private async command(s: string) {
    if (!this.writer) throw new Error('Not connected to writer');
    await this.writer.write(new TextEncoder().encode(s + '\n'));
  }

  private async line(prefix = '', limit = 1024): Promise<string> {
    let s = '';
    const end = performance.now() + 5000;
    while (performance.now() < end) {
      const b = (await this.read(1, end))[0];
      if (b === 10) { // '\n'
        s = s.trim();
        if (s.length === 0) continue;
        if (prefix) {
          if (s.startsWith(prefix)) return s;
          // If expecting a specific prefix (e.g. 'SPEC ') but encountered an 'OK'
          // from a preceding command (or comment), discard it and continue reading
          if (s === 'OK' || s.startsWith('#') || s.startsWith('//')) {
            s = '';
            continue;
          }
          throw new Error(s || 'Empty WebSerial response');
        }
        return s;
      }
      if (b !== 13) {
        s += String.fromCharCode(b);
        if (s.length > limit) {
          s = '';
        }
      }
    }
    throw Object.assign(new Error(`Timed out waiting for response${prefix ? ` '${prefix}'` : ''}`), { code: 'CAPTURE_DAMAGED' });
  }

  private async synchronize() {
    this.log('info', 'Synchronizing with ESP-SDR firmware (checking serial sync)...');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const marker = 'SYNC ' + Date.now();
      const deadline = performance.now() + 2000;
      await this.command('\n' + marker);
      let window = '';
      try {
        for (let j = 0; j < 70000; j++) {
          window += String.fromCharCode((await this.read(1, deadline))[0]);
          if (window.length > marker.length + 1) window = window.slice(-marker.length - 1);
          if (window === marker + '\n') {
            this.log('success', `Synchronized successfully on attempt ${attempt}.`);
            return;
          }
        }
      } catch (e: any) {
        if (this.failed) throw e;
      }
    }
    throw new Error('SDR synchronization failed. Ensure ESP-SDR firmware is flashed and no other software is using this port.');
  }

  private async startUartFirmware() {
    // External USB/UART bridge reset pulse: DTR=GPIO0, RTS=EN
    const vendor = this.port.getInfo?.().usbVendorId;
    if ([0x10c4, 0x1a86, 0x0403, 0x067b].includes(vendor)) {
      this.log('info', `USB/UART bridge detected (VID: 0x${vendor.toString(16)}). Applying RTS/DTR reset sequence.`);
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      try {
        await new Promise(r => setTimeout(r, 100));
      } finally {
        await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      }
    }
  }

  private async openPort(port: any, baudRate: number) {
    this.port = port;
    this.log('info', `Opening port with baud rate ${baudRate}...`);
    await port.open({ baudRate, bufferSize: 131072, flowControl: 'none' });
    this.baudRate = baudRate;
    this.reader = port.readable.getReader();
    this.writer = port.writable.getWriter();
    this.queue = [];
    this.queued = 0;
    this.failed = null;
    this.pump();
  }

  private async negotiate() {
    this.log('info', 'Querying device INFO...');
    await this.command('INFO');
    this.identity = await this.line();
    this.log('success', `Firmware identity: "${this.identity}"`);

    const m = /^(ESP32|C2|C3|C5|C6|C61|H2|S2|S3|S31)SDR 6 burst (\d+)$/.exec(this.identity);
    if (m) {
      this.family = m[1];
      this.maxSamples = Number(m[2]);
    }

    this.log('info', 'Querying device CAPS...');
    await this.command('CAPS');
    const caps = await this.line();
    this.log('success', `Capabilities: ${caps}`);

    const capTokens = caps.split(' ');
    this.capsList = capTokens;
    this.hasSpec = capTokens.includes('SPEC');
    this.hasSpecN = capTokens.includes('SPECN');
    this.hasSpecStats = capTokens.includes('SPECSTAT');
    this.hasGain = capTokens.includes('GAIN');

    if (capTokens.includes('UARTBAUD')) {
      await this.command('TRANSPORT?');
      const t = /^TRANSPORT (UART|USB) (\d+)$/.exec(await this.line());
      if (t) {
        this.transport = t[1];
        this.log('info', `Transport: ${this.transport}`);
      }
    }

    if (capTokens.includes('TUNEEXT')) {
      await this.command('RANGE?');
      const h = (await this.line('RANGE ')).split(' ');
      const lo = Number(h[1]), hi = Number(h[2]);
      if (Number.isInteger(lo) && Number.isInteger(hi)) {
        this.tuneRange = [lo, hi];
        this.log('info', `Tuning Range: ${lo} - ${hi} MHz`);
      }
    }

    if (capTokens.includes('RXLIMITS')) {
      try {
        await this.command('LIMITS?');
        const lim = await this.line('LIMITS ');
        this.rxLimits = lim;
        this.log('info', `Device limits: ${lim}`);
      } catch {
        // Optional
      }
    }

    // Spectrum profile negotiation
    if (this.hasSpec) {
      if (capTokens.includes('SPECCAPS')) {
        await this.command('SPECINFO?');
        const specLine = await this.line('SPECINFO ', 4096);
        try {
          this.specCapabilities = JSON.parse(specLine.slice(9));
          this.log('success', `Loaded on-chip spectrum capabilities with ${this.specCapabilities?.profiles?.length || 0} profiles.`);
        } catch {
          this.log('warn', 'Failed parsing SPECCAPS response');
        }
      } else if (this.family === 'S3') {
        const profiles = [[16000000, 6, 256, 4, 1], [40000000, 1, 256, 12, 3], [80000000, 0, 256, 48, 5]];
        if (this.hasSpecN) {
          profiles.push(
            [16000000, 6, 1024, 8, 4],
            [16000000, 6, 2048, 6, 8],
            [40000000, 1, 1024, 18, 10],
            [40000000, 1, 2048, 10, 20]
          );
        }
        this.specCapabilities = { continuous: true, transports: ['USB'], profiles };
      }
    }
  }

  async connect(baudRate = 2000000, selectedPort: any = null, transport?: 'webusb' | 'webserial'): Promise<void> {
    if (this.isSimulating) {
      this.stopSimulation();
    }

    if (!EspSdrDriver.isSupported()) {
      const err = new Error('Neither WebSerial nor WebUSB API is supported in this browser. Please use Chrome, Edge, or Opera.');
      this.log('error', err.message);
      this.onStatusChange?.('error');
      throw err;
    }

    const preferred = transport || SerialConnection.defaultTransport();
    this.onStatusChange?.('connecting');
    this.log('info', `Requesting ${preferred === 'webusb' ? 'WebUSB (native CDC)' : 'WebSerial'} port authorization...`);

    let port = selectedPort;
    if (!port) {
      try {
        port = await SerialConnection.requestPort(preferred);
      } catch (e: any) {
        this.log('warn', `Port selection cancelled or failed: ${e.message}`);
        this.onStatusChange?.('disconnected');
        return;
      }
    }

    const info = port.getInfo ? port.getInfo() : {};
    this.portInfo = {
      usbVendorId: info.usbVendorId,
      usbProductId: info.usbProductId
    };
    const transportType = port.kind === 'webusb' ? 'WebUSB' : 'WebSerial';
    this.log('success', `Selected ${transportType} port: VID 0x${(info.usbVendorId || 0).toString(16)}, PID 0x${(info.usbProductId || 0).toString(16)}`);

    return this.run(async () => {
      await this.disconnect();
      try {
        await this.openPort(port, baudRate);
        await this.startUartFirmware();
        await this.synchronize();
        await this.negotiate();

        const usb = identifyUsbDevice(this.portInfo.usbVendorId, this.portInfo.usbProductId);
        const chip = identifyEspChip(this.family);

        this.deviceInfo = {
          connected: true,
          simulated: false,
          chipModel: chip.model,
          chipFamily: this.family,
          chipArch: chip.arch,
          firmware: `ESP-SDR (Protocol 6)`,
          rawIdentity: this.identity || `${chip.model} SDR`,
          maxSamples: this.maxSamples,
          transport: this.transport,
          baudRate: this.baudRate,
          usbVendor: usb.vendor,
          usbProduct: usb.product,
          usbVidHex: usb.vidHex,
          usbPidHex: usb.pidHex,
          caps: this.capsList,
          hasSpec: this.hasSpec,
          hasSpecN: this.hasSpecN,
          hasGain: this.hasGain,
          tuneRange: this.tuneRange || chip.defaultRange,
          specCapabilities: this.specCapabilities,
          rxLimits: this.rxLimits
        };
        this.onDeviceInfo?.(this.deviceInfo);

        this.isConnected = true;
        this.log('success', `Device connected: ${chip.model} (${this.identity || chip.arch})`);
        this.onStatusChange?.('connected');
      } catch (e: any) {
        this.log('error', `Connection error: ${e.message}`);
        await this.disconnect();
        this.onStatusChange?.('error');
        throw e;
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopStream();
    this.stopSimulation();

    this.wakeListeners.clear();

    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      try { this.reader.releaseLock(); } catch {}
      this.reader = null;
    }
    if (this.writer) {
      try { this.writer.releaseLock(); } catch {}
      this.writer = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch {}
      this.port = null;
    }

    this.isConnected = false;
    this.queue = [];
    this.queued = 0;
    this.failed = null;
    this.smoothedTrace = null;
    this.maxHoldTrace = null;
    this.deviceInfo = null;
    this.deviceStats = null;
    this.onDeviceInfo?.(null);
    this.onStats?.(null);

    this.log('info', 'Disconnected from serial device.');
    this.onStatusChange?.('disconnected');
  }

  async tune(frequency: number, bandwidth = 0) {
    if (!this.isConnected && !this.isSimulating) return;
    if (this.isSimulating) {
      this.log('info', `Simulating tune to ${frequency} MHz...`);
      return;
    }
    if (this.isStreaming) {
      this.updateConfig({ frequency, bandwidth });
      return;
    }
    try {
      this.log('info', `Tuning frequency to ${frequency} MHz (bandwidth: ${bandwidth} MHz)...`);
      await this.command(`FREQ ${frequency}`);
      await this.line('OK');
      if (bandwidth > 0) {
        await this.command(`BANDWIDTH ${bandwidth}`);
        await this.line('OK');
      }
      this.log('success', `Frequency tuned to ${frequency} MHz.`);
    } catch (err: any) {
      this.log('error', `Tuning error (${frequency} MHz): ${err.message}`);
      throw err;
    }
  }

  async setGain(mode = 'HARDWARE', code = 40): Promise<{ mode: string; index: number | null }> {
    if ((!this.isConnected && !this.isSimulating) || !this.hasGain) return { mode: 'HARDWARE', index: null };
    if (this.isStreaming) {
      this.updateConfig({ gainMode: mode, gain: code });
      return { mode, index: mode === 'MANUAL' ? code : null };
    }
    try {
      const setting = mode === 'MANUAL' ? `MANUAL ${code}` : mode;
      await this.command(`GAIN ${setting}`);
      await this.line('OK');
      return { mode, index: mode === 'MANUAL' ? code : null };
    } catch (err: any) {
      this.log('error', `Set gain error (${mode}): ${err.message}`);
      return { mode: 'HARDWARE', index: null };
    }
  }

  /**
   * Update active streaming parameters on-the-fly without crashing serial connection
   */
  updateConfig(newConfig: Partial<CaptureConfig>) {
    if (this.isSimulating) {
      if (this.simConfig) {
        const oldFft = this.simConfig.fft;
        const oldFreq = this.simConfig.frequency;
        const oldRate = this.simConfig.rate;
        const oldGainMode = this.simConfig.gainMode;
        Object.assign(this.simConfig, newConfig);
        if (newConfig.fft && this.smoothedTrace && this.smoothedTrace.length !== newConfig.fft) {
          this.smoothedTrace = null;
          this.maxHoldTrace = null;
        }
        if (newConfig.fft && newConfig.fft !== oldFft && this.simTimer) {
          clearInterval(this.simTimer);
          this.simTimer = setInterval(() => this.runSimulationStep(), this.getSimInterval(this.simConfig.fft));
        }
        if (newConfig.fft !== oldFft || newConfig.frequency !== oldFreq || newConfig.rate !== oldRate) {
          this.log('info', `Simulation config updated: FFT=${this.simConfig?.fft} Bins, Freq=${this.simConfig?.frequency} MHz, Rate=${(this.simConfig?.rate || 0) / 1e6} MS/s`);
        } else if (newConfig.gainMode && newConfig.gainMode !== oldGainMode) {
          this.log('info', `Simulation Gain Mode: ${newConfig.gainMode}`);
        }
      }
      return;
    }
    if (this.activeConfig) {
      const oldFft = this.activeConfig.fft;
      const oldFreq = this.activeConfig.frequency;
      const oldRate = this.activeConfig.rate;
      const oldGainMode = this.activeConfig.gainMode;
      Object.assign(this.activeConfig, newConfig);
      this.pendingConfigChange = true;
      if (newConfig.fft && this.smoothedTrace && this.smoothedTrace.length !== newConfig.fft) {
        this.smoothedTrace = null;
        this.maxHoldTrace = null;
      }
      if (newConfig.fft !== oldFft || newConfig.frequency !== oldFreq || newConfig.rate !== oldRate) {
        this.log('info', `Hardware config updated: FFT=${this.activeConfig.fft} Bins, Freq=${this.activeConfig.frequency} MHz, Rate=${this.activeConfig.rate / 1e6} MS/s`);
      } else if (newConfig.gainMode && newConfig.gainMode !== oldGainMode) {
        this.log('info', `Hardware Gain Mode: ${newConfig.gainMode}`);
      }
    }
  }

  /**
   * Start streaming RF spectrum data from connected ESP32
   */
  async startStream(config: CaptureConfig) {
    if (!this.isConnected) {
      throw new Error('Please connect to ESP32 first.');
    }
    if (this.isStreaming) {
      this.stopStream();
      await yieldTask();
    }

    this.activeConfig = { ...config };
    this.pendingConfigChange = false;
    this.isStreaming = true;
    this.onStatusChange?.('streaming');
    this.log('info', `Starting spectrum stream: Freq=${config.frequency}MHz, Rate=${config.rate / 1e6}MS/s, FFT=${config.fft}...`);

    this.run(async () => {
      while (this.isStreaming && this.isConnected) {
        if (!this.activeConfig) break;
        const currentConfig = { ...this.activeConfig };
        this.pendingConfigChange = false;

        try {
          // 1. Tune frequency & gain while device is between stream frames
          await this.command(`FREQ ${currentConfig.frequency}`);
          await this.line('OK');
          if (currentConfig.bandwidth > 0) {
            await this.command(`BANDWIDTH ${currentConfig.bandwidth}`);
            await this.line('OK');
          }

          let gainActual: { mode: string; index: number | null } = {
            mode: currentConfig.gainMode,
            index: currentConfig.gainMode === 'MANUAL' ? currentConfig.gain : null
          };
          if (this.hasGain) {
            const setting = currentConfig.gainMode === 'MANUAL' ? `MANUAL ${currentConfig.gain}` : currentConfig.gainMode;
            await this.command(`GAIN ${setting}`);
            await this.line('OK');
          }

          const canSpec = this.hasSpec && this.specCapabilities;
          if (canSpec) {
            // On-Chip spectrum streaming: validate requested rate & FFT against chip DSP profile table
            const allProfiles = this.spectrumProfiles();
            let profile = allProfiles.filter((p: any) => p[0] === currentConfig.rate).find((p: any) => p[2] === currentConfig.fft);

            if (!profile) {
              // 1. Check if another rate supports the requested FFT size (e.g. 40 MS/s or 16 MS/s supports 1024 / 2048)
              const alt = allProfiles.find((p: any) => p[2] === currentConfig.fft);
              if (alt) {
                profile = alt;
                currentConfig.rate = alt[0];
                if (this.activeConfig) this.activeConfig.rate = alt[0];
                this.log('info', `Adjusted sample rate to ${alt[0] / 1e6} MS/s to match FFT ${currentConfig.fft} profile on ${this.family || 'ESP32'}.`);
                this.onConfigAdjusted?.({ ...currentConfig });
              } else {
                // 2. FFT size is not in chip profiles at all (e.g. 512 or 4096 in hardware on-chip mode)
                const rateProfiles = allProfiles.filter((p: any) => p[0] === currentConfig.rate);
                if (rateProfiles.length > 0) {
                  profile = rateProfiles.reduce((prev: any, curr: any) =>
                    Math.abs(curr[2] - currentConfig.fft) < Math.abs(prev[2] - currentConfig.fft) ? curr : prev,
                    rateProfiles[0]
                  );
                  this.log('warn', `FFT ${currentConfig.fft} not supported on-chip at ${currentConfig.rate / 1e6} MS/s. Using closest supported: ${profile[2]} bins.`);
                } else if (allProfiles.length > 0) {
                  profile = allProfiles[0];
                  currentConfig.rate = profile[0];
                  if (this.activeConfig) this.activeConfig.rate = profile[0];
                  this.log('warn', `Switched to supported profile: ${profile[0] / 1e6} MS/s, FFT ${profile[2]} bins.`);
                } else {
                  profile = [currentConfig.rate, 0, 256, 48, 5];
                }
                currentConfig.fft = profile[2];
                if (this.activeConfig) this.activeConfig.fft = profile[2];
                this.onConfigAdjusted?.({ ...currentConfig });
              }
            }

            const specBins = profile[2];
            const divider = profile[1];
            const step = profile[3];
            const profileUpf = profile[4];
            const upf = Math.min(1000, Math.max(profileUpf || 1, 1));
            const n = specBins;
            const decoder = new SpectrumDecoder(n);

            await this.command(`SPEC 0 ${step} ${upf} ${currentConfig.maxHold ? 1 : 0} ${divider}${this.hasSpecN ? ' ' + specBins : ''}${this.hasSpecN && this.hasSpecStats ? ' 1' : ''}`);
            const head = (await this.line('SPEC ')).split(' ');
            this.log('success', `Active spectrum tuned to ${currentConfig.frequency} MHz (SPEC on-chip, FFT ${specBins} bins @ ${currentConfig.rate / 1e6} MS/s).`);

            let count = 0;
            let ended = false;
            let stopping = false;

            while (!ended && this.isStreaming && this.isConnected) {
              if ((++count & 15) === 0) await yieldTask();

              // Check if user changed any tuning/filter settings
              const changed = this.pendingConfigChange || (this.activeConfig && (
                this.activeConfig.frequency !== currentConfig.frequency ||
                this.activeConfig.rate !== currentConfig.rate ||
                this.activeConfig.fft !== currentConfig.fft ||
                this.activeConfig.gainMode !== currentConfig.gainMode ||
                this.activeConfig.gain !== currentConfig.gain ||
                this.activeConfig.bandwidth !== currentConfig.bandwidth
              ));

              if (!stopping && (!this.isStreaming || !this.isConnected || changed)) {
                stopping = true;
                // An empty line halts hardware SPEC stream and returns SPECEND report
                await this.command('');
              }

              const chunk = await this.read(Math.max(1, Math.min(this.queued, 8192)), performance.now() + 5000);
              const events = decoder.feed(chunk);

              for (const ev of events) {
                if (ev.report) {
                  ended = true;
                  break;
                }
                if (ev.stats) {
                  this.deviceStats = {
                    core0Load: ev.stats.core0,
                    core1Load: ev.stats.core1,
                    coverage: ev.stats.coverage,
                    heapFree: ev.stats.heapFree,
                    fftsPerSec: ev.stats.fftsPerS,
                    updatedAt: Date.now()
                  };
                  this.onStats?.(this.deviceStats);
                }
                if (ev.header && ev.bins) {
                  const s = specToDbfs(ev.bins, ev.header.step, n, currentConfig.dcMode);
                  this.handleProcessedSpectrum(s, currentConfig, gainActual, 'SPEC on-chip');
                }
              }
            }

            // Drain any pending trailing bytes after stopping until SPECEND is consumed
            if (!ended && this.isConnected && this.writer) {
              try {
                await this.command('');
                const deadline = performance.now() + 2000;
                while (!ended) {
                  const chunk = await this.read(Math.max(1, Math.min(this.queued, 8192)), deadline);
                  const events = decoder.feed(chunk);
                  ended = events.some((e: any) => e.report);
                }
              } catch {
                // Drain boundary reached
              }
            }
          } else {
            // Burst raw IQ streaming
            const divider = Math.max(0, [80000000, 40000000, 20000000, 10000000, 8000000, 4000000].indexOf(currentConfig.rate));
            const startT = performance.now();
            const n = currentConfig.fft;
            await this.command(`CAP${currentConfig.bits * 2} ${n} ${divider}`);
            const header = await this.line();
            const h = /^DATA (\d+) ([0-9a-fA-F]{1,8}) (\d+)$/.exec(header);
            if (h) {
              const byteCount = Math.ceil(n * currentConfig.bits * 2 / 8);
              const bytes = await this.read(byteCount, performance.now() + 5000, 500);
              const crcValid = crc32(bytes) === parseInt(h[2], 16);

              const iq = new Float32Array(n * 2);
              for (let j = 0; j < n; j++) {
                let i = bytes[j * 2], q = bytes[j * 2 + 1];
                if (i >= 128) i -= 256;
                if (q >= 128) q -= 256;
                iq[2 * j] = (i * 4) / 512;
                iq[2 * j + 1] = -(q * 4) / 512;
              }

              const ps = computeSpectrum(iq, n);
              const elapsed = performance.now() - startT;
              this.handleProcessedSpectrum(ps, currentConfig, gainActual, 'Burst IQ', elapsed, crcValid);
            }
            await yieldTask();
          }
        } catch (err: any) {
          if (!this.isStreaming) break;
          this.log('error', `Streaming error: ${err.message}`);
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (this.isConnected) {
        this.onStatusChange?.('connected');
      }
    }).catch((err: any) => {
      this.log('error', `Stream coordinator error: ${err.message}`);
    });
  }

  stopStream() {
    this.isStreaming = false;
    this.pendingConfigChange = false;
    if (this.isConnected) {
      this.command('').catch(() => {});
      this.onStatusChange?.('connected');
    }
  }

  private handleProcessedSpectrum(
    rawSpectrum: Float32Array,
    config: CaptureConfig,
    gainActual?: { mode: string; index: number | null },
    modeName = 'SPEC on-chip',
    elapsedMs = 10,
    crcOk = true
  ) {
    const n = rawSpectrum.length;
    const a = config.traceAvg;

    // Exponential moving average for trace
    if (!this.smoothedTrace || this.smoothedTrace.length !== n) {
      this.smoothedTrace = new Float32Array(rawSpectrum);
    } else {
      for (let i = 0; i < n; i++) {
        if (a > 0) {
          const linAvg = a * (10 ** (this.smoothedTrace[i] / 10)) + (1 - a) * (10 ** (rawSpectrum[i] / 10));
          this.smoothedTrace[i] = 10 * Math.log10(Math.max(1e-14, linAvg));
        } else {
          this.smoothedTrace[i] = rawSpectrum[i];
        }
      }
    }

    // Max hold calculation
    if (!this.maxHoldTrace || this.maxHoldTrace.length !== n) {
      this.maxHoldTrace = new Float32Array(rawSpectrum);
    } else {
      for (let i = 0; i < n; i++) {
        if (rawSpectrum[i] > this.maxHoldTrace[i]) {
          this.maxHoldTrace[i] = rawSpectrum[i];
        }
      }
    }

    // FPS calculation
    this.fpsCounter++;
    const now = performance.now();
    if (now - this.lastFpsTimestamp >= 1000) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.lastFpsTimestamp));
      this.fpsCounter = 0;
      this.lastFpsTimestamp = now;
    }

    // Find peak frequency
    let peakIdx = 0;
    for (let i = 1; i < n; i++) {
      if (this.smoothedTrace[i] > this.smoothedTrace[peakIdx]) {
        peakIdx = i;
      }
    }

    const peakHz = config.frequency * 1e6 + (peakIdx - n / 2) * (config.rate / n);
    const peakDbfs = this.smoothedTrace[peakIdx];

    const frame: SpectrumFrame = {
      frequency: config.frequency,
      rate: config.rate,
      fft: n,
      spectrum: this.smoothedTrace,
      maxHoldSpectrum: config.maxHold ? this.maxHoldTrace : undefined,
      peakHz,
      peakDbfs,
      fps: this.currentFps || 60,
      deliveredKsps: Math.round(n / (elapsedMs || 1)),
      elapsedMs: Math.round(elapsedMs * 10) / 10,
      crcOk,
      sequence: ++this.sequence,
      samples: n,
      dropped: this.droppedCaptures,
      mode: modeName,
      gainActual
    };

    this.onFrame?.(frame);
  }

  /**
   * Demo Simulation Mode: Generates realistic 2.4 GHz WiFi spectrum & waterfall data
   */
  startSimulation(config: CaptureConfig) {
    if (this.isConnected) {
      this.disconnect();
    }
    this.stopSimulation();

    this.isSimulating = true;
    this.onStatusChange?.('streaming');
    this.log('info', 'Starting SIMULATION mode (synthetic 2.4GHz ISM Wi-Fi capture)...');
    this.log('success', `Simulating ESP32-C5 at ${config.frequency} MHz, ${config.rate / 1e6} MS/s, ${config.fft} bins.`);

    const usb = identifyUsbDevice(0x303a, 0x1001);
    const chip = identifyEspChip('C5');
    this.deviceInfo = {
      connected: true,
      simulated: true,
      chipModel: 'ESP32-C5 (Simulated)',
      chipFamily: 'C5',
      chipArch: 'Dual-Band 2.4/5.8GHz RISC-V @ 240MHz (Simulated)',
      firmware: 'ESP-SDR v6 (Synthetic Engine)',
      rawIdentity: 'C5SDR 6 burst 16380 [SIMULATION]',
      maxSamples: 16380,
      transport: 'Virtual WebSerial',
      baudRate: this.baudRate,
      usbVendor: 'Espressif Systems (Simulated)',
      usbProduct: 'ESP32-C5 USB Virtual Interface',
      usbVidHex: '0x303A',
      usbPidHex: '0x1001',
      caps: ['SPEC', 'SPECN', 'GAIN', 'UARTBAUD', 'TUNEEXT', 'SPECCAPS', 'SIMULATION'],
      hasSpec: true,
      hasSpecN: true,
      hasGain: true,
      tuneRange: [2400, 5850],
      specCapabilities: {
        continuous: true,
        transports: ['USB'],
        profiles: [
          [16000000, 6, 256, 4, 1],
          [16000000, 6, 1024, 8, 4],
          [16000000, 6, 2048, 6, 8],
          [40000000, 1, 256, 12, 3],
          [40000000, 1, 1024, 18, 10],
          [40000000, 1, 2048, 10, 20],
          [80000000, 0, 256, 48, 5]
        ]
      },
      rxLimits: 'GAIN 0-60dB BW 20-80MHz'
    };
    this.onDeviceInfo?.(this.deviceInfo);

    this.simConfig = { ...config };
    this.simStartTime = performance.now();
    const interval = this.getSimInterval(this.simConfig.fft);
    this.simTimer = setInterval(() => this.runSimulationStep(), interval);
  }

  private getSimInterval(fft: number): number {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      // On mobile, clamp simulation interval to ~30 FPS (>= 32ms) to prevent mobile CPU/GPU throttling
      switch (fft) {
        case 256: return 32;   // ~31 FPS
        case 512: return 35;   // ~28 FPS
        case 1024: return 40;  // ~25 FPS
        case 2048: return 50;  // ~20 FPS
        case 4096: return 85;  // ~12 FPS
        default: return 35;
      }
    }

    switch (fft) {
      case 256: return 16;   // ~60 FPS
      case 512: return 20;   // ~50 FPS
      case 1024: return 30;  // ~33 FPS
      case 2048: return 50;  // ~20 FPS - slow waterfall scroll, smooth high-res waveform
      case 4096: return 85;  // ~12 FPS - slowest waterfall
      default: return 30;
    }
  }

  private runSimulationStep() {
    if (!this.isSimulating || !this.simConfig) return;

    const cfg = this.simConfig;
    const n = cfg.fft;
    const rateMhz = (cfg.rate || 80000000) / 1e6;
    const freq = cfg.frequency || 2412;

    const simRaw = new Float32Array(n);
    const centerBin = Math.floor(n / 2);

    const timeSec = (performance.now() - this.simStartTime) / 1000;
    // WiFi channel activity pulsing
    const burstActive = Math.sin(timeSec * 5) > -0.2 || Math.random() < 0.35;

    const gainOffset = cfg.gainMode === 'MANUAL' ? (cfg.gain - 40) * 0.4 : 0;

    for (let i = 0; i < n; i++) {
      // Noise floor with slight processing gain factor
      const baseNoise = -96 + 10 * Math.log10(2048 / Math.max(64, n)) + gainOffset * 0.3;
      const noise = baseNoise + (Math.random() - 0.5) * 5;
      const distFromCenter = Math.abs(i - centerBin);

      // 22 MHz Wi-Fi OFDM shape (Channel 1, 2401 to 2423 MHz)
      let signal = -120;
      const halfChanBins = Math.floor(n * (11 / rateMhz));
      if (distFromCenter <= halfChanBins * 1.5) {
        const normDist = distFromCenter / Math.max(1, halfChanBins);
        let shape = 0;
        if (normDist <= 0.85) {
          // At lower FFT (256/512): subcarriers blend together into a simple, flat trapezoid
          // At higher FFT (1024/2048/4096): fine individual OFDM subcarrier ripples are resolved!
          const ripples = n >= 1024 ? (Math.sin(i * 0.8) * 0.06 + Math.sin(i * 0.25) * 0.04) : 0;
          shape = 1.0 - (normDist ** 2) * 0.15 + ripples;
        } else {
          // Steep spectral mask skirt
          shape = Math.max(0, 1.0 - (normDist - 0.85) * 1.5);
        }
        const basePower = (burstActive ? -48 : -68) + gainOffset;
        signal = basePower * shape - (1 - shape) * 88 + (Math.random() - 0.5) * 4;
      }

      // Persistent CW carrier line at 2400 MHz
      let carrier2400 = -120;
      const bin2400 = centerBin - Math.floor(n * ((freq - 2400) / rateMhz));
      if (Math.abs(i - bin2400) <= (n >= 1024 ? 1 : 0)) {
        carrier2400 = -26 + gainOffset + (Math.random() - 0.5) * 2;
      }

      // Center DC leakage / LO carrier spike at 2412 MHz
      let dcSpike = -120;
      if (distFromCenter <= 1 && cfg.dcMode !== 'fill') {
        dcSpike = -22 + (Math.random() - 0.5) * 3;
      }

      // Occasional subcarrier burst lines
      let burstSub = -120;
      if (burstActive && Math.random() < 0.15 && distFromCenter < halfChanBins && n >= 512) {
        burstSub = -36 + gainOffset + Math.random() * 6;
      }

      const maxLinear =
        10 ** (noise / 10) +
        10 ** (signal / 10) +
        10 ** (carrier2400 / 10) +
        10 ** (dcSpike / 10) +
        10 ** (burstSub / 10);
      simRaw[i] = 10 * Math.log10(Math.max(1e-14, maxLinear));
    }

    // Simulated on-chip ESP hardware stats
    if (Math.random() < 0.25) {
      const core0 = Math.min(100, Math.max(5, Math.round((38 + Math.sin(timeSec * 2) * 9 + Math.random() * 5) * 10) / 10));
      const core1 = Math.min(100, Math.max(3, Math.round((14 + Math.cos(timeSec * 1.5) * 6 + Math.random() * 4) * 10) / 10));
      this.deviceStats = {
        core0Load: core0,
        core1Load: core1,
        coverage: Math.round((98.2 + Math.random() * 1.5) * 10) / 10,
        heapFree: 284160 + Math.floor(Math.sin(timeSec) * 2048),
        fftsPerSec: Math.round(1000 / this.getSimInterval(n)) * 8,
        updatedAt: Date.now()
      };
      this.onStats?.(this.deviceStats);
    }

    this.handleProcessedSpectrum(
      simRaw,
      cfg,
      { mode: cfg.gainMode, index: cfg.gainMode === 'MANUAL' ? cfg.gain : null },
      'Simulation (WiFi 2.4G)',
      Math.round(this.getSimInterval(n)),
      true
    );
  }

  stopSimulation() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    this.isSimulating = false;
    this.smoothedTrace = null;
    this.maxHoldTrace = null;
    this.deviceInfo = null;
    this.deviceStats = null;
    this.onDeviceInfo?.(null);
    this.onStats?.(null);
    this.onStatusChange?.('disconnected');
    this.log('info', 'Simulation stopped.');
  }

  resetMaxHold() {
    this.maxHoldTrace = null;
  }
}
