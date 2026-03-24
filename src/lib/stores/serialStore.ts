import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { demoStore } from './demoStore';

export type SerialStatus = 'connected' | 'disconnected' | 'unsupported' | 'connecting';

interface SerialState {
    status: SerialStatus;
    error: string | null;
}

function createSerialStore() {
    const { subscribe, set, update } = writable<SerialState>({
        status: browser && 'serial' in navigator ? 'disconnected' : 'unsupported',
        error: null
    });

    let port: SerialPort | null = null;
    let writer: WritableStreamDefaultWriter | null = null;

    async function connect() {
        if (!browser || !('serial' in navigator)) return;

        update(s => ({ ...s, status: 'connecting', error: null }));

        try {
            port = await navigator.serial.requestPort();
            await port.open({ 
                baudRate: 115200,
                dataTerminalReady: true,
                requestToSend: true
            });
            writer = port.writable?.getWriter() || null;

            update(s => ({ ...s, status: 'connected' }));

            port.addEventListener('error', () => {
                console.error('Serial port error:');
            });

            // Listen for port disconnection
            port.addEventListener('disconnect', () => {
                disconnect();
            });

        } catch (err: any) {
            console.error('Serial connection error:', err);
            update(s => ({ ...s, status: 'disconnected', error: err.message }));
        }
    }

    async function disconnect() {
        if (writer) {
            await writer.releaseLock();
            writer = null;
        }
        if (port) {
            await port.close();
            port = null;
        }
        update(s => ({ ...s, status: 'disconnected' }));
    }

    async function sendData(data: any) {
        if (!writer) return;

        try {
            const encoder = new TextEncoder();
            const jsonString = JSON.stringify(data) + '\n';
            console.log(jsonString);
            await writer.write(encoder.encode(jsonString));
        } catch (err) {
            console.error('Failed to send data:', err);
        }
    }

    // Auto-subscribe to demoStore for earthquake alerts
    if (browser) {
        demoStore.subscribe(state => {
            if (state.gempaAlert) {
                sendData({
                    type: 'GEMPA',
                    id: state.gempaAlert.id,
                    mag: state.gempaAlert.mag,
                    // depth: state.gempaAlert.depth,
                    // mmi: state.gempaAlert.mmi,
                    // place: state.gempaAlert.place
                });
            }
        });
    }

    async function testConnection() {
        await sendData({ type: 'TEST', message: 'HEARTBEAT' });
    }

    return {
        subscribe,
        connect,
        disconnect,
        sendData,
        testConnection
    };
}

export const serialStore = createSerialStore();
