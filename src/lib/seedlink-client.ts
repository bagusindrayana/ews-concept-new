/**
 * Lightweight SeedLink WebSocket client for browser usage.
 * SeedLink v3.1 protocol over WebSocket.
 */

export const SEEDLINK_PROTOCOL = "SeedLink3.1";

export interface MiniSeedHeader {
  seq: string;
  staCode: string;
  locCode: string;
  chanCode: string;
  netCode: string;
  numSamples: number;
  sampleRate: number;
  encoding: number;
  littleEndian: boolean;
  recordSize: number;
  startTime: Date;
  dataOffset: number;
}

export interface SeedlinkPacket {
  sequence: number;
  rawsequence: string;
  header: MiniSeedHeader;
  rawData: DataView;
}

function makeString(dv: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = offset; i < offset + length; i++) {
    const c = dv.getUint8(i);
    if (c > 31) out += String.fromCharCode(c);
  }
  return out.trim();
}

function abToString(ab: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(new Uint8Array(ab));
}

function parseBTime(dv: DataView, offset: number, swap: boolean = false): Date {
  const year = dv.getInt16(offset, swap);
  const jday = dv.getInt16(offset + 2, swap);
  const hour = dv.getInt8(offset + 4);
  const min = dv.getInt8(offset + 5);
  const sec = dv.getInt8(offset + 6);
  const tenthMilli = dv.getInt16(offset + 8, swap);

  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(jday);
  d.setUTCHours(hour, min, sec, Math.round(tenthMilli / 10));
  return d;
}

function parseHeader(dv: DataView): MiniSeedHeader {
  const seq = makeString(dv, 0, 6);
  const staCode = makeString(dv, 8, 5);
  const locCode = makeString(dv, 13, 2);
  const chanCode = makeString(dv, 15, 3);
  const netCode = makeString(dv, 18, 2);

  const testYear = dv.getInt16(20, false);
  const swap = testYear < 1960 || testYear > 2055;

  const startTime = parseBTime(dv, 20, swap);
  const numSamples = dv.getInt16(30, swap);
  const sampRateFac = dv.getInt16(32, swap);
  const sampRateMul = dv.getInt16(34, swap);
  const dataOffset = dv.getUint16(44, swap);
  const blocketteOffset = dv.getUint16(46, swap);
  const numBlockettes = dv.getUint8(39);

  let sampleRate = 0;
  if (sampRateFac * sampRateMul !== 0) {
    sampleRate =
      Math.pow(Math.abs(sampRateFac), sampRateFac / Math.abs(sampRateFac)) *
      Math.pow(Math.abs(sampRateMul), sampRateMul / Math.abs(sampRateMul));
  }

  let encoding = 0;
  let littleEndian = false;
  let recordSize = 4096;

  let bOffset = blocketteOffset;
  for (let i = 0; i < numBlockettes; i++) {
    if (bOffset + 4 > dv.byteLength) break;
    const bType = dv.getUint16(bOffset, swap);
    const nextOffset = dv.getUint16(bOffset + 2, swap);

    if (bType === 1000) {
      encoding = dv.getUint8(bOffset + 4);
      const wordOrder = dv.getUint8(bOffset + 5);
      littleEndian = wordOrder === 0;
      recordSize = 1 << dv.getUint8(bOffset + 6);
    } else if (bType === 100) {
      sampleRate = dv.getFloat32(bOffset + 4, swap);
    }

    if (nextOffset === 0) break;
    bOffset = nextOffset;
  }

  return {
    seq, staCode, locCode, chanCode, netCode,
    numSamples, sampleRate, encoding, littleEndian,
    recordSize, startTime, dataOffset,
  };
}

/**
 * Decompress Steim1 encoded data
 */
function decompressSteim1(dv: DataView, numSamples: number, swap: boolean): Int32Array {
  const samples = new Int32Array(numSamples);
  let sampleIdx = 0;
  const numFrames = Math.floor(dv.byteLength / 64);
  let lastValue = 0;

  for (let frame = 0; frame < numFrames && sampleIdx < numSamples; frame++) {
    const frameOffset = frame * 64;
    const nibbleWord = dv.getUint32(frameOffset, swap);

    for (let word = 1; word < 16 && sampleIdx < numSamples; word++) {
      const nibble = (nibbleWord >> (30 - 2 * word)) & 0x03;
      const wordOffset = frameOffset + word * 4;

      if (nibble === 0) {
        if (frame === 0 && word === 1) {
          lastValue = dv.getInt32(wordOffset, swap);
          samples[sampleIdx++] = lastValue;
        }
      } else if (nibble === 1) {
        for (let i = 0; i < 4 && sampleIdx < numSamples; i++) {
          lastValue += dv.getInt8(wordOffset + i);
          samples[sampleIdx++] = lastValue;
        }
      } else if (nibble === 2) {
        for (let i = 0; i < 2 && sampleIdx < numSamples; i++) {
          lastValue += dv.getInt16(wordOffset + i * 2, swap);
          samples[sampleIdx++] = lastValue;
        }
      } else if (nibble === 3) {
        lastValue += dv.getInt32(wordOffset, swap);
        samples[sampleIdx++] = lastValue;
      }
    }
  }
  return samples;
}

/**
 * Decompress Steim2 encoded data
 */
function decompressSteim2(dv: DataView, numSamples: number, swap: boolean): Int32Array {
  const samples = new Int32Array(numSamples);
  let sampleIdx = 0;
  const numFrames = Math.floor(dv.byteLength / 64);
  let lastValue = 0;

  for (let frame = 0; frame < numFrames && sampleIdx < numSamples; frame++) {
    const frameOffset = frame * 64;
    const nibbleWord = dv.getUint32(frameOffset, swap);

    for (let word = 1; word < 16 && sampleIdx < numSamples; word++) {
      const nibble = (nibbleWord >> (30 - 2 * word)) & 0x03;
      const wordOffset = frameOffset + word * 4;

      if (nibble === 0) {
        if (frame === 0 && word === 1) {
          lastValue = dv.getInt32(wordOffset, swap);
          samples[sampleIdx++] = lastValue;
        }
      } else if (nibble === 1) {
        for (let i = 0; i < 4 && sampleIdx < numSamples; i++) {
          lastValue += dv.getInt8(wordOffset + i);
          samples[sampleIdx++] = lastValue;
        }
      } else if (nibble === 2) {
        const subCode = (dv.getUint32(wordOffset, swap) >> 30) & 0x03;
        const val = dv.getUint32(wordOffset, swap);
        if (subCode === 1) {
          let diff = val & 0x3FFFFFFF;
          if (diff >= 0x20000000) diff -= 0x40000000;
          lastValue += diff;
          samples[sampleIdx++] = lastValue;
        } else if (subCode === 2) {
          for (let i = 0; i < 2 && sampleIdx < numSamples; i++) {
            let diff = (val >> (15 - i * 15)) & 0x7FFF;
            if (diff >= 0x4000) diff -= 0x8000;
            lastValue += diff;
            samples[sampleIdx++] = lastValue;
          }
        } else if (subCode === 3) {
          for (let i = 0; i < 3 && sampleIdx < numSamples; i++) {
            let diff = (val >> (20 - i * 10)) & 0x3FF;
            if (diff >= 0x200) diff -= 0x400;
            lastValue += diff;
            samples[sampleIdx++] = lastValue;
          }
        }
      } else if (nibble === 3) {
        const subCode = (dv.getUint32(wordOffset, swap) >> 30) & 0x03;
        const val = dv.getUint32(wordOffset, swap);
        if (subCode === 0) {
          for (let i = 0; i < 5 && sampleIdx < numSamples; i++) {
            let diff = (val >> (24 - i * 6)) & 0x3F;
            if (diff >= 0x20) diff -= 0x40;
            lastValue += diff;
            samples[sampleIdx++] = lastValue;
          }
        } else if (subCode === 1) {
          for (let i = 0; i < 6 && sampleIdx < numSamples; i++) {
            let diff = (val >> (25 - i * 5)) & 0x1F;
            if (diff >= 0x10) diff -= 0x20;
            lastValue += diff;
            samples[sampleIdx++] = lastValue;
          }
        } else if (subCode === 2) {
          for (let i = 0; i < 7 && sampleIdx < numSamples; i++) {
            let diff = (val >> (24 - i * 4)) & 0x0F;
            if (diff >= 0x08) diff -= 0x10;
            lastValue += diff;
            samples[sampleIdx++] = lastValue;
          }
        }
      }
    }
  }
  return samples;
}

/**
 * Decompress data based on encoding type
 */
export function decompressData(header: MiniSeedHeader, rawData: DataView): number[] {
  const swap = header.littleEndian;

  try {
    if (header.encoding === 10) {
      return Array.from(decompressSteim1(rawData, header.numSamples, swap));
    } else if (header.encoding === 11) {
      return Array.from(decompressSteim2(rawData, header.numSamples, swap));
    } else if (header.encoding === 1) {
      const samples: number[] = [];
      for (let i = 0; i < header.numSamples; i++) {
        samples.push(rawData.getInt16(i * 2, swap));
      }
      return samples;
    } else if (header.encoding === 3) {
      const samples: number[] = [];
      for (let i = 0; i < header.numSamples; i++) {
        samples.push(rawData.getInt32(i * 4, swap));
      }
      return samples;
    } else if (header.encoding === 4) {
      const samples: number[] = [];
      for (let i = 0; i < header.numSamples; i++) {
        samples.push(rawData.getFloat32(i * 4, swap));
      }
      return samples;
    } else if (header.encoding === 5) {
      const samples: number[] = [];
      for (let i = 0; i < header.numSamples; i++) {
        samples.push(rawData.getFloat64(i * 8, swap));
      }
      return samples;
    } else {
      console.warn(`Unknown encoding: ${header.encoding}, attempting raw int32`);
      const samples: number[] = [];
      const count = Math.min(header.numSamples, Math.floor(rawData.byteLength / 4));
      for (let i = 0; i < count; i++) {
        samples.push(rawData.getInt32(i * 4, swap));
      }
      return samples;
    }
  } catch (e) {
    console.warn("Decompress error:", e);
    return [];
  }
}

export type LogCallback = (msg: string) => void;
export type PacketCallback = (packet: SeedlinkPacket) => void;
export type ErrorCallback = (error: Error) => void;
export type CloseCallback = () => void;

export class SeedlinkClient {
  url: string;
  requestConfig: string[];
  onPacket: PacketCallback;
  onError: ErrorCallback;
  onClose: CloseCallback;
  onLog: LogCallback;
  webSocket: WebSocket | null = null;
  command: string = "DATA";

  constructor(
    url: string,
    requestConfig: string[],
    onPacket: PacketCallback,
    onError: ErrorCallback,
    onClose: CloseCallback = () => {},
    onLog: LogCallback = () => {},
  ) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.onPacket = onPacket;
    this.onError = onError;
    this.onClose = onClose;
    this.onLog = onLog;
  }

  async connect(): Promise<void> {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.onLog(`Opening WebSocket to ${this.url}`);
        const ws = new WebSocket(this.url, SEEDLINK_PROTOCOL);
        this.webSocket = ws;
        ws.binaryType = "arraybuffer";

        ws.onopen = async () => {
          try {
            this.onLog("WebSocket opened, sending HELLO...");
            const helloResp = await this.sendHello();
            this.onLog(`Server: ${helloResp.substring(0, 80)}`);

            for (const cmd of this.requestConfig) {
              this.onLog(`Sending: ${cmd}`);
              const resp = await this.sendCmd(cmd);
              this.onLog(`Response: ${resp}`);
            }

            this.onLog(`Sending: ${this.command}`);
            const dataResp = await this.sendCmd(this.command);
            this.onLog(`Response: ${dataResp}`);

            // Switch to data mode
            ws.onmessage = (event) => this.handleData(event);
            this.onLog("Sending END, switching to data mode...");
            ws.send("END\r");
            resolve();
          } catch (err: any) {
            this.close();
            reject(err);
          }
        };

        ws.onerror = (event) => {
          const err = new Error("WebSocket connection error");
          this.onLog(`WebSocket error: ${JSON.stringify(event)}`);
          this.onError(err);
          reject(err);
        };

        ws.onclose = (event) => {
          this.onLog(`WebSocket closed: code=${event.code} reason=${event.reason}`);
          this.webSocket = null;
          this.onClose();
        };
      } catch (err: any) {
        reject(err);
      }
    });
  }

  close() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
  }

  isConnected(): boolean {
    return this.webSocket !== null && this.webSocket.readyState === WebSocket.OPEN;
  }

  private sendHello(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket) return reject(new Error("Not connected"));
      const timeout = setTimeout(() => reject(new Error("HELLO timeout")), 10000);
      this.webSocket.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data instanceof ArrayBuffer) {
          resolve(abToString(event.data).trim());
        } else if (typeof event.data === "string") {
          resolve(event.data.trim());
        } else {
          reject(new Error("Unexpected HELLO response type"));
        }
      };
      this.webSocket.send("HELLO\r");
    });
  }

  private sendCmd(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket) return reject(new Error("Not connected"));
      const timeout = setTimeout(() => reject(new Error(`Command "${cmd}" timeout`)), 10000);
      this.webSocket.onmessage = (event) => {
        clearTimeout(timeout);
        let msg = "";
        if (event.data instanceof ArrayBuffer) {
          msg = abToString(event.data).trim();
        } else if (typeof event.data === "string") {
          msg = event.data.trim();
        }
        if (msg.startsWith("OK")) {
          resolve(msg);
        } else if (msg.startsWith("ERROR")) {
          reject(new Error(`Command "${cmd}" failed: ${msg}`));
        } else {
          // Some servers may send additional info, treat non-error as OK
          this.onLog(`Unexpected response to "${cmd}": "${msg}"`);
          resolve(msg);
        }
      };
      // SeedLink protocol uses CR only, not CRLF
      this.webSocket.send(cmd + "\r");
    });
  }

  private handleData(event: MessageEvent) {
    if (!(event.data instanceof ArrayBuffer)) {
      this.onLog(`Non-binary message received: ${String(event.data).substring(0, 50)}`);
      return;
    }

    const data: ArrayBuffer = event.data;
    if (data.byteLength < 64) {
      this.onLog(`Tiny packet received: ${data.byteLength} bytes`);
      return;
    }

    try {
      const slHeader = new DataView(data, 0, 8);

      // Check for 'SL' marker (ASCII 83, 76)
      const byte0 = slHeader.getUint8(0);
      const byte1 = slHeader.getUint8(1);
      if (byte0 !== 83 || byte1 !== 76) {
        // Not a SeedLink data packet — might be info/keepalive
        const preview = abToString(data).substring(0, 60);
        this.onLog(`Non-SL packet (${data.byteLength}b): ${preview}`);
        return;
      }

      let seqStr = "";
      for (let i = 0; i < 6; i++) {
        seqStr += String.fromCharCode(slHeader.getUint8(2 + i));
      }

      const mseedView = new DataView(data, 8, data.byteLength - 8);
      const header = parseHeader(mseedView);
      const rawData = new DataView(
        data,
        8 + header.dataOffset,
        header.recordSize - header.dataOffset,
      );

      this.onPacket({
        sequence: parseInt(seqStr, 16),
        rawsequence: seqStr,
        header,
        rawData,
      });
    } catch (e: any) {
      this.onLog(`Parse error: ${e.message}`);
      this.onError(e);
    }
  }
}
