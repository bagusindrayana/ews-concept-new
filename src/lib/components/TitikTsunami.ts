import mapboxgl from "mapbox-gl";
import AnimatedPopup from 'mapbox-gl-animated-popup';
import type { InfoTsunami } from '$lib/types';

type TitikTsunamiSetting = {
    map: mapboxgl.Map;
    showMarker?: boolean;
    showPopup?: boolean;
    zoomToPosition?: boolean;
    sWaveSpeed?: number;
    pWaveSpeed?: number;
    description?: string;
    showPopUpInSecond?: number;
    closePopUpInSecond?: number;
}

export class TitikTsunami {
    id: string;
    infoTsunami: InfoTsunami;
    setting?: TitikTsunamiSetting;
    tsunamiMarker: mapboxgl.Marker | null = null;

    constructor(id: string, infoTsunami: InfoTsunami, setting?: TitikTsunamiSetting) {
        this.id = id;
        this.infoTsunami = infoTsunami;
        this.setting = setting;
        this.init();
    }

    get center() {
        return [this.infoTsunami.lng, this.infoTsunami.lat];
    }

    init() {
        if (this.setting != null) {
            if (this.setting.map != null) {
                if (this.setting.showMarker) {
                    this.renderMarker();
                }

                if (this.setting.zoomToPosition) {
                    this.flyTo();
                }

                if (this.setting.showPopup) {
                    if (this.setting.showPopUpInSecond) {
                        setTimeout(() => {
                            this.renderPopup();
                        }, this.setting.showPopUpInSecond * 1000);
                    } else {
                        setTimeout(() => {
                            this.renderPopup();
                        }, 1000);
                    }
                }
            }
        }
    }

    renderMarker() {
        const titikTsunami = document.createElement('div');
        titikTsunami.classList.add('marker-tsunami');

        const icon = document.createElement('div');
        icon.className = 'circles flex justify-center items-center';
        icon.innerHTML = `
            <div class="circle1"></div>
            <div class="circle2"></div>
            <div class="circle3"></div>
            <svg class="blink" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        `;
        titikTsunami.appendChild(icon);

        this.tsunamiMarker = new mapboxgl.Marker(titikTsunami)
            .setLngLat([this.center[0], this.center[1]])
            .addTo(this.setting!.map!);
    }

    renderPopup() {
        const placeholder = document.createElement('div');
        placeholder.innerHTML = `
            <div class="ews-card bordered-red min-h-48 min-w-64 whitespace-pre-wrap">
                <div class="ews-card-header bordered-red-bottom">
                    <div class="overflow-hidden">
                        <div class="strip-wrapper"><div class="strip-bar loop-strip-reverse anim-duration-20"></div><div class="strip-bar loop-strip-reverse anim-duration-20"></div></div>
                        <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
                            <p class="p-1 bg-black font-bold text-xs text-glow">PERINGATAN TSUNAMI</p>
                        </div>
                    </div>
                </div>
                <div class="ews-card-content p-1 lg:p-2  custom-scrollbar">
                    <p class="mt-1">${this.setting?.description || ''}</p>
                </div>
            </div>
        `.trim()
            .replace(/>\s+</g, "><");

        if (this.tsunamiMarker) {
            const popup = new AnimatedPopup({
                closeOnClick: false,
                openingAnimation: {
                    duration: 100,
                    easing: 'easeOutSine',
                    transform: 'scale'
                },
                closingAnimation: {
                    duration: 100,
                    easing: 'easeInOutSine',
                    transform: 'scale'
                },
            }).setDOMContent(placeholder).setLngLat(this.center).setMaxWidth('256px');
            this.tsunamiMarker.setPopup(popup);
            popup.addTo(this.setting!.map);

            if (this.setting!.closePopUpInSecond) {
                setTimeout(() => {
                    popup.remove();
                }, this.setting!.closePopUpInSecond * 1000);
            }
        }
    }

    flyTo() {
        if (this.setting?.map != null) {
            this.setting.map.flyTo({
                center: [this.infoTsunami.lng, this.infoTsunami.lat],
                zoom: 6
            });
        }
    }
}
