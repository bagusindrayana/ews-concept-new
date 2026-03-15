import { writable } from 'svelte/store';
import type { InfoGempa, InfoTsunami } from '$lib/types';
import { browser } from '$app/environment';

export interface DemoState {
    gempaAlert: InfoGempa | null;
    tsunamiAlert: InfoTsunami | null;
}

const initialState: DemoState = {
    gempaAlert: null,
    tsunamiAlert: null,
};

function createDemoStore() {
    const { subscribe, set, update } = writable<DemoState>(initialState);

    let channel: BroadcastChannel | null = null;

    if (browser) {
        channel = new BroadcastChannel('ews-demo-events');
        channel.onmessage = (event) => {
            if (event.data.type === 'TRIGGER_GEMPA') {
                update(s => ({ ...s, gempaAlert: event.data.payload }));
            } else if (event.data.type === 'TRIGGER_TSUNAMI') {
                update(s => ({ ...s, tsunamiAlert: event.data.payload }));
            } else if (event.data.type === 'CLEAR_ALERTS') {
                set(initialState);
            }
        };
    }

    return {
        subscribe,
        triggerGempa: (data: InfoGempa) => {
            update(s => ({ ...s, gempaAlert: data }));
            channel?.postMessage({ type: 'TRIGGER_GEMPA', payload: data });
        },
        triggerTsunami: (data: InfoTsunami) => {
            update(s => ({ ...s, tsunamiAlert: data }));
            channel?.postMessage({ type: 'TRIGGER_TSUNAMI', payload: data });
        },
        clearAlerts: () => {
            set(initialState);
            channel?.postMessage({ type: 'CLEAR_ALERTS' });
        }
    };
}

export const demoStore = createDemoStore();
