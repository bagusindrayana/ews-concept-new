// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'mapbox-gl-animated-popup' {
    import type { MapboxGeoJSONFeature } from 'mapbox-gl';
    
    export interface AnimatedPopupOptions {
        closeOnClick?: boolean;
        maxWidth?: string;
        className?: string;
        openingAnimation?: {
            duration?: number;
            easing?: string;
            transform?: string;
        };
        closingAnimation?: {
            duration?: number;
            easing?: string;
            transform?: string;
        };
    }
    
    export default class AnimatedPopup extends mapboxgl.Popup {
        constructor(options?: AnimatedPopupOptions);
        addTo(map: mapboxgl.Map): this;
    }
}

export {};
