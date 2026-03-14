import mapboxgl from "mapbox-gl";
import AnimatedPopup from 'mapbox-gl-animated-popup';
import type { InfoGempa } from '$lib/types';

type TitikGempaSetting = {
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

export class TitikGempa {
    id: string;
    infoGempa: InfoGempa;
    setting?: TitikGempaSetting;

    pWaveRadius: number = 0;
    sWaveRadius: number = 0;
    curTime: number = 0;
    _play: boolean = true;
    gemaMarker: mapboxgl.Marker | null = null;
    finishWave: boolean = false;
    initalPWaveRadius: number = 0;
    initalSWaveRadius: number = 0;

    constructor(id: string, infoGempa: InfoGempa, setting?: TitikGempaSetting) {
        this.id = id;
        this.infoGempa = infoGempa;
        this.setting = setting;
        this.init();
    }

    get description() {
        return this.setting?.description;
    }

    get finish() {
        return this.finishWave;
    }

    get center() {
        return [this.infoGempa.lng, this.infoGempa.lat];
    }

    get mag() {
        return this.infoGempa.mag;
    }

    get depth() {
        return this.infoGempa.depth;
    }

    get time() {
        return this.infoGempa.time;
    }

    get timeDiff() {
        if (this.infoGempa.time != null) {
            const d = new Date(this.infoGempa.time);
            const now = new Date();
            return new Date(now.getTime() - d.getTime()).toLocaleTimeString();
        }
        return "-";
    }

    get readableMag() {
        if (this.mag != null) {
            return Number(this.mag.toString()).toFixed(1);
        }
        return 0;
    }

    get readableDepth() {
        if (this.infoGempa.depth) {
            return parseFloat(this.infoGempa.depth.replace(" Km", "")).toFixed(2);
        }
        return 0;
    }

    get readableTime() {
        if (this.infoGempa.time != null) {
            return new Date(this.infoGempa.time).toLocaleString();
        }
        return "-"
    }

    init() {
        if (this.setting != null) {
            if (this.setting.map != null) {
                if (this.infoGempa.time != null && this.setting.pWaveSpeed != null && this.setting.sWaveSpeed != null) {
                    const d = new Date(this.infoGempa.time);
                    const now = new Date();
                    const diff = now.getTime() - d.getTime();
                    this.initalPWaveRadius = (diff / 1000) * this.setting.pWaveSpeed;
                    this.initalSWaveRadius = (diff / 1000) * this.setting.sWaveSpeed;
                    setTimeout(() => {
                        this.removeAllRender();
                    }, ((Math.abs(this.mag || 1) * 20000) - diff));

                    setTimeout(() => {
                        this.animateWave();
                    }, 1000);
                }

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
        const titikGempa = document.createElement('div');
        titikGempa.dataset.id = this.id;
        titikGempa.classList.add('marker-gempa');

        const icon = document.createElement('div');
        icon.className = 'circles flex justify-center items-center';
        icon.innerHTML = `
            <div class="circle1"></div>
            <div class="circle2"></div>
            <div class="circle3"></div>
            <svg class="blink" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        `;
        titikGempa.appendChild(icon);

        this.gemaMarker = new mapboxgl.Marker(titikGempa)
            .setLngLat([this.center[0], this.center[1]])
            .addTo(this.setting!.map!);
    }

    renderPopup() {
        const placeholder = document.createElement('div');
        placeholder.innerHTML = `
            <div class="ews-card bordered-red min-h-48 min-w-48 whitespace-pre-wrap">
                <div class="ews-card-header bordered-red-bottom">
                    <div class="overflow-hidden">
                        <div class="strip-wrapper"><div class="strip-bar loop-strip-reverse anim-duration-20"></div><div class="strip-bar loop-strip-reverse anim-duration-20"></div></div>
                        <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
                            <p class="p-1 bg-black font-bold text-xs text-glow">GEMPA BUMI</p>
                        </div>
                    </div>
                </div>
                <div class="ews-card-content p-1 lg:p-2  custom-scrollbar">
                    ${this.mag ? `<table class="w-full">
                        <tbody>
                            <tr><td class="flex">Magnitudo</td><td class="text-right break-words pl-2">${Number(this.mag).toFixed(1)}</td></tr>
                            <tr><td class="flex">Kedalaman</td><td class="text-right break-words pl-2">${this.depth}</td></tr>
                            <tr><td class="flex">Waktu</td><td class="text-right break-words pl-2">${new Date(this.infoGempa.time!).toLocaleString()}</td></tr>
                            <tr><td class="flex">Lokasi (Lat,Lng)</td><td class="text-right break-words pl-2">${this.infoGempa.lat} , ${this.infoGempa.lng}</td></tr>
                        </tbody>
                    </table>` : ''}
                    ${this.setting?.description != null && this.setting?.description != '' ? `<hr><p class="mt-1 text-xs">${this.setting?.description}</p>` : ''}
                </div>
            </div>
        `.trim()
            .replace(/>\s+</g, "><");

        if (this.gemaMarker) {
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
                }
            }).setDOMContent(placeholder).setLngLat(this.center);
            this.gemaMarker.setPopup(popup);
            popup.addTo(this.setting!.map);
            setTimeout(() => {
                popup.remove();
            }, 3000);
        }
    }

    renderWave() {
        if (this.setting?.map == null) return;

        const circles: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: this.center
                    },
                    properties: {
                        id: 'p-wave',
                        radius: this.pWaveRadius,
                        lat: parseFloat(this.center[1].toString()),
                        color: 'orange',
                        titikGempa: this.center
                    }
                },
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: this.center
                    },
                    properties: {
                        id: 's-wave',
                        radius: this.sWaveRadius,
                        lat: parseFloat(this.center[1].toString()),
                        color: 'red',
                        titikGempa: this.center
                    }
                }
            ]
        };

        if (!this.setting.map?.getSource('wave-source-' + this.id)) {
            this.setting.map.addSource('wave-source-' + this.id, {
                type: 'geojson',
                data: circles
            });
        } else {
            (this.setting.map?.getSource('wave-source-' + this.id) as mapboxgl.GeoJSONSource).setData(circles);
        }

        if (!this.setting.map.getLayer(this.id) && this.finishWave == false) {
            this.setting.map.addLayer({
                id: this.id,
                type: 'circle',
                source: 'wave-source-' + this.id,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['exponential', 2],
                        ['zoom'],
                        0, 0,
                        22, [
                            '/',
                            ['/', ['get', 'radius'], 0.019],
                            ['cos', ['*', ['get', 'lat'], ['/', Math.PI, 180]]],
                        ],
                    ],
                    'circle-color': 'transparent',
                    'circle-stroke-color': ['get', 'color'],
                    'circle-stroke-width': 2,
                }
            });
            this.setting.map.moveLayer(this.id);
        }
    }

    animateWave() {
        if (this.setting != null && this.infoGempa.time != null) {
            const d = new Date(this.infoGempa.time);
            const now = new Date();
            const diff = now.getTime() - d.getTime();
            this.initalPWaveRadius = (diff / 1000) * this.setting.pWaveSpeed!;
            this.initalSWaveRadius = (diff / 1000) * this.setting.sWaveSpeed!;
        }

        const animate = (time: number) => {
            if (this.finishWave) return;
            if (!this.curTime) this.curTime = time;

            const deltaTime = time - this.curTime;
            if (this.setting != null && this._play) {
                this.pWaveRadius = this.initalPWaveRadius + ((deltaTime / 1000) * this.setting.pWaveSpeed!);
                this.sWaveRadius = this.initalSWaveRadius + ((deltaTime / 1000) * this.setting.sWaveSpeed!);
            }

            this.renderWave();
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    flyTo() {
        if (this.setting?.map != null) {
            this.setting.map.flyTo({
                center: [this.infoGempa.lng, this.infoGempa.lat],
                zoom: 6
            });
        }
    }

    play() {
        this._play = true;
    }

    pause() {
        this._play = false;
    }

    removeAllRender() {
        if (this.setting?.map != null) {
            if (this.setting.map.getLayer(this.id)) {
                this.setting.map.removeLayer(this.id);
            }

            if (this.setting.map.getSource('wave-source-' + this.id)) {
                this.setting.map.removeSource('wave-source-' + this.id);
            }
            if (this.setting.map!.getLayer('hightlight-wave-layer')) {
                this.setting.map!.removeLayer('hightlight-wave-layer');
                this.setting.map!.removeSource('hightlight-wave');
                const markers = document.querySelectorAll('.marker-daerah');
                markers.forEach((v) => {
                    v.parentElement!.remove();
                });
            }
            this.finishWave = true;
        }
    }

    removeMarker() {
        if (this.gemaMarker) {
            this.gemaMarker.remove();
        }
    }
}
