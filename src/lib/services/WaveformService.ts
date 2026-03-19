import type { DataPoint } from "$lib/components/WaveformChart.svelte";

export class WaveformService {
    private buffer: DataPoint[] = [];
    private maxBufferMs: number;
    private seis: any;

    constructor(maxBufferMs: number = 300000) {
        this.maxBufferMs = maxBufferMs;
    }

    public async init() {
        if (!this.seis) {
            this.seis = await import("seisplotjs");
        }
    }

    public processMiniseed(mseedDataBuffer: ArrayBuffer, nominalSampleRateMs: number = 10) {
        if (!this.seis) {
            console.warn("WaveformService not initialized with seisplotjs, ignoring data.");
            return;
        }
        
        const mseedData = mseedDataBuffer.slice(8);
        const records = this.seis.miniseed.parseDataRecords(mseedData);

        const newPoints: DataPoint[] = [];

        records.forEach((r: any) => {
            const samples = r.decompress();
            const mean = samples.reduce((sum: number, v: number) => sum + v, 0) / samples.length;
            const demeaned = samples.map((v: number) => v - mean);

            let startTimeMs = Date.now();
            if (r.header && r.header.start) {
                try {
                    startTimeMs = r.header.start.valueOf();
                } catch (e) {
                    console.warn(e);
                }
            }

            let msPerSample = nominalSampleRateMs;
            if (r.header && r.header.sampleRate) {
                msPerSample = 1000 / r.header.sampleRate;
            }

            for (let i = 0; i < demeaned.length; i++) {
                newPoints.push({
                    t: startTimeMs + i * msPerSample,
                    v: demeaned[i],
                });
            }
        });

        this.addPoints(newPoints);
    }

    public generateDemoData(demoPhase: number, samplesToGenerate: number = 4, msPerSample: number = 10): number {
        const now = Date.now();
        let currentPhase = demoPhase;
        const newPoints: DataPoint[] = [];

        for (let i = 0; i < samplesToGenerate; i++) {
            currentPhase += 0.1;
            const noise = (Math.random() - 0.5) * 500;
            const primaryWave = Math.sin(currentPhase) * 3000;
            const secondaryWave = Math.cos(currentPhase * 0.5) * 1000;
            const spike = Math.random() > 0.98 ? (Math.random() - 0.5) * 10000 : 0;

            newPoints.push({
                t: now - (samplesToGenerate - i - 1) * msPerSample,
                v: primaryWave + secondaryWave + noise + spike,
            });
        }

        this.addPoints(newPoints);
        return currentPhase;
    }

    public addPoints(points: DataPoint[]) {
        if (points.length === 0) return;
        
        // Use a more performant way to push large arrays if needed, but for miniseed packets this is usually fine
        for(let i=0; i<points.length; i++){
            this.buffer.push(points[i]);
        }
        
        this.trimBuffer();
    }

    private trimBuffer() {
        this.buffer.sort((a, b) => a.t - b.t);

        const latestTime = this.buffer[this.buffer.length - 1].t;
        const cutoffTime = latestTime - this.maxBufferMs;

        let trimIndex = 0;
        while (trimIndex < this.buffer.length && this.buffer[trimIndex].t < cutoffTime) {
            trimIndex++;
        }

        if (trimIndex > 0) {
            this.buffer.splice(0, trimIndex);
        }
    }

    public getBuffer(): DataPoint[] {
        return this.buffer;
    }

    public clearBuffer(): void {
        this.buffer.length = 0;
    }
}
