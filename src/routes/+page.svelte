<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "mapbox-gl/dist/mapbox-gl.css";
  import mapboxgl from "mapbox-gl";
  import { io } from "socket.io-client";
  import { DateTime } from "luxon";
  import { EarthquakeDataService } from "$lib/services/earthquakeDataService";
  import * as turf from "@turf/turf";
  import AnimatedPopup from "mapbox-gl-animated-popup";
  import { TitikGempa } from "$lib/components/TitikGempa";
  import { TitikTsunami } from "$lib/components/TitikTsunami";
  import type { InfoGempa, InfoTsunami } from "$lib/types";
  import GempaBumiAlert from "$lib/components/GempaBumiAlert.svelte";
  import TsunamiAlert from "$lib/components/TsunamiAlert.svelte";
  // import Jam from "$lib/components/Jam.svelte";
  import AffectedAreaItem from "$lib/components/AffectedAreaItem.svelte";
  import Card from "$lib/components/Card.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import {
    PUBLIC_SOCKET_DATA_URL,
    PUBLIC_MAPBOX_ACCESS_TOKEN,
  } from "$env/static/public";
  import StripeBar from "$lib/components/StripeBar.svelte";
  import { MapLayerService } from "$lib/services/mapLayerService";
  import { AudioService, SOUNDS } from "$lib/services/audioService";
  // import { fadeOutAudio } from "$lib/utils/audio";
  import { createGempaPopupHTML } from "$lib/utils/mapUtils";
  import { generateRandomGempaData } from "$lib/utils/geoUtils";
  import { demoStore } from "$lib/stores/demoStore";
  import sourceDataConfig from "$lib/config/source-data.json";
  import * as htmlToImage from "html-to-image";
  import {
    saveSnapshot,
    getSnapshots,
    deleteSnapshot,
    type Snapshot,
  } from "$lib/utils/db";
  import Icon from "@iconify/svelte";
  import SerialStatus from "$lib/components/SerialStatus.svelte";

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map;
  let socket: any;
  const earthquakeService = new EarthquakeDataService();
  const mapLayerService = new MapLayerService();
  const audioService = new AudioService();

  //center of indonesia
  let lng = $state(123.90146694265115);
  let lat = $state(-1.370489908625089);

  let geoJsonData: any = null;
  let geoJsonCoastline: any = null;
  let geoJsonTitikGempa: any = null;
  let worker: Worker | null = null;
  let tgs: TitikGempa[] = [];
  let titikGempaBaru: TitikGempa[] = [];
  let tts: TitikTsunami[] = [];
  let markerDaerahs: number[][] = [];

  let lastGempaId = "";
  let lastGempaKecilId = "";

  let detailInfoGempa: InfoGempa | null = $state(null);
  let loadingScreen = $state(true);
  let events = $state<TitikGempa[]>([]);
  let alertGempaBumi: TitikGempa | null = $state(null);
  let alertGempaBumis = $state<TitikGempa[]>([]);
  let alertTsunami: TitikTsunami | null = $state(null);
  let infoTsunami: TitikTsunami | null = $state(null);
  let shakeMap: string | null = $state(null);

  // Settings modal state
  let showSettingsModal = $state(false);
  let showEventLog = $state(true);
  let showGempaDirasakan = $state(true);
  let showGempaTerdeteksi = $state(true);
  let showDetailEvent = $state(true);
  let showShakeMap = $state(true);
  let showSourceModal = $state(false);
  let sourceDataInput = $state(JSON.stringify(sourceDataConfig, null, 4));
  let historyRecords = $state<string[][]>([]);

  // Snapshot Modal state
  let showSnapshotModal = $state(false);
  let snapshotsList: Snapshot[] = $state([]);

  // Missing earthquake tracking states
  let GempaDirasakan: TitikGempa | null = $state(null);
  let GempaTerakhir: TitikGempa | null = $state(null);

  let blinkInterval: ReturnType<typeof setInterval> | null = null;
  let selectedPopup: any = null;
  let timezoneInterval: any = null;

  mapboxgl.accessToken = PUBLIC_MAPBOX_ACCESS_TOKEN;

  async function takeSnapshot(
    eventId: string,
    place: string,
    mag: number | string,
    time: string,
  ) {
    try {
      //hide earthquake layer
      map.setLayoutProperty("earthquakes-layer", "visibility", "none");
      console.log("Taking snapshot for", eventId);
      // Ignore modals and loading screen so the final image looks clean
      const filter = (node: HTMLElement) => {
        return (
          node.id !== "loading-screen" &&
          !node.classList?.contains("modal") &&
          !node.classList?.contains("no-snapshot")
        );
      };
      const imageBase64 = await htmlToImage.toJpeg(document.body, {
        quality: 0.6,
        filter: filter,
      });
      const snapshot: Snapshot = {
        id: eventId + "-" + Date.now(),
        timestamp: Date.now(),
        time,
        place,
        mag,
        imageBase64,
      };
      await saveSnapshot(snapshot);
      console.log("Snapshot saved to IndexedDB");
      //show earthquake layer
      map.setLayoutProperty("earthquakes-layer", "visibility", "visible");
    } catch (err) {
      console.error("Failed to take snapshot:", err);
      //show earthquake layer
      map.setLayoutProperty("earthquakes-layer", "visibility", "visible");
    }
  }

  async function warningHandler(data: any) {
    const time = new Date().toLocaleTimeString();
    const id = data.id || `tg-${time}`;
    if (!map) return;

    const nig: InfoGempa = {
      id,
      lng: parseFloat(data.lng),
      lat: parseFloat(data.lat),
      mag: parseFloat(data.mag || 0),
      depth: data.depth,
      message: data.message,
      place: data.place,
      time: data.time || new Date().toLocaleString(),
      listAffectedArea: [],
      mmi: parseInt(
        (data.time || new Date().toLocaleString())
          ?.replaceAll("-", "")
          .replaceAll(" ", "")
          .replaceAll(":", "") || "0",
      ),
    };

    const tg = new TitikGempa(id, nig, {
      pWaveSpeed: 6000,
      sWaveSpeed: 3000,
      map: map,
      showMarker: true,
      description: data.message,
      showPopup: true,
      showPopUpInSecond: 6,
      zoomToPosition: true,
    });
    tgs.push(tg);
    titikGempaBaru.push(tg);
    alertGempaBumis = [...alertGempaBumis, tg];

    audioService.playEarthquakeSequence(
      document.getElementById("danger") as HTMLAudioElement,
    );

    demoStore.triggerGempa(nig);

    await new Promise((r) => setTimeout(r, 6000));
    events = [...tgs];

    // Take snapshot automatically after 4 seconds (allow UI to settle)
    setTimeout(() => {
      takeSnapshot(
        id,
        data.place || "Unknown",
        data.mag || 0,
        data.time || new Date().toLocaleString(),
      );
    }, 3000);
    if (worker != null) sendWave();
  }

  function blinkCoastline() {
    if (blinkInterval) clearInterval(blinkInterval);
    blinkInterval = setInterval(() => {
      const visibility = map.getLayoutProperty(
        "outline-coastline",
        "visibility",
      );
      map.setLayoutProperty(
        "outline-coastline",
        "visibility",
        visibility == "visible" ? "none" : "visible",
      );
    }, 1000);
  }

  async function warningTsunamiHandler(data: any) {
    if (blinkInterval) clearInterval(blinkInterval);
    const results: any[] = [];
    const id = data.id || `tg-${new Date().getTime()}`;
    const coordinates = data.point.coordinates.split(",");
    console.log(data);
    const nit: InfoTsunami = {
      id,
      lng: parseFloat(coordinates[0]),
      lat: parseFloat(coordinates[1]),
      message: data.description + "\n" + data.instruction,
      level: data.subject,
      time: data.time || new Date().toLocaleString(),
      listAffectedArea: [],
    };

    let level = "WASPADA";
    for (let x = 0; x < data.wzarea.length; x++) {
      const wz = data.wzarea[x];
      const cek = geoJsonCoastline.features.find(
        (f: any) =>
          wz.district
            .replaceAll("-", " ")
            .replaceAll("PULAU ", "")
            .replaceAll("KEPULAUAN ", "")
            .replaceAll(" BAGIAN UTARA", "")
            .replaceAll(" BAGIAN BARAT", "")
            .replaceAll(" BAGIAN SELATAN", "")
            .replaceAll(" BAGIAN TIMUR", "") ===
          f.properties.alt_name
            .replaceAll("KABUPATEN ", "")
            .replaceAll("PULAU ", "")
            .replaceAll("KEPULAUAN ", ""),
      );
      if (cek) {
        let color =
          wz.level == "SIAGA"
            ? "orange"
            : wz.level == "AWAS"
              ? "red"
              : "yellow";
        if (level == "WASPADA" && wz.level == "SIAGA") level = wz.level;
        if (level == "SIAGA" && wz.level == "AWAS") level = wz.level;
        cek.properties.color = color;
        results.push(cek);
        const dist = turf.distance(
          turf.point([nit.lng, nit.lat]),
          turf.point([cek.properties.longitude, cek.properties.latitude]),
        );
        nit.listAffectedArea!.push({
          lng: cek.properties.longitude,
          lat: cek.properties.latitude,
          distance: dist,
          name: cek.properties.alt_name,
          hit: false,
          timeArrival: new Date(
            new Date().getTime() + Math.floor(dist / 3) * 1000,
          ),
        });
      }
    }
    nit.listAffectedArea!.sort((a, b) => a.distance - b.distance);

    for (let x = 0; x < results.length; x++) {
      const p: number[] = turf.centroid(results[x]).geometry.coordinates;
      if (
        markerDaerahs.findIndex((el) => el[0] == p[0] && el[1] == p[1]) == -1
      ) {
        markerDaerahs.push([p[0], p[1]]);
        const markerParent = document.createElement("div");

        const markerEl = document.createElement("div");
        markerEl.innerHTML =
          '<p class="uppercase">' + results[x].properties.alt_name + "</p>";
        markerEl.classList.add("marker-daerah");
        markerEl.classList.add("show-pop-up");
        markerParent.appendChild(markerEl);
        new mapboxgl.Marker(markerParent).setLngLat([p[0], p[1]]).addTo(map);
      }
    }

    const tt = new TitikTsunami(id, nit, {
      pWaveSpeed: 6000,
      sWaveSpeed: 3000,
      map: map,
      showMarker: true,
      description: data.description + "\n" + data.instruction,
      showPopup: true,
      showPopUpInSecond: 6,
      zoomToPosition: true,
      closePopUpInSecond: 13,
    });
    tts.push(tt);
    // alertTsunami = tt;

    if (results.length > 0) {
      if (map.getSource("coastline"))
        (map.getSource("coastline") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: results,
        });
      else {
        map.addSource("coastline", {
          type: "geojson",
          data: { type: "FeatureCollection", features: results },
        });
      }
      map.setLayoutProperty("outline-coastline", "visibility", "visible");
    } else {
      testDemoTsunami();
      return;
    }

    blinkCoastline();
    map.moveLayer("outline-coastline");

    audioService.playTsunamiSequence(level);
    console.log(nit);
    demoStore.triggerTsunami(nit);

    setTimeout(() => {
      shakeMap = data.shakemap;
    }, 9000);
    setTimeout(() => {
      // alertTsunami = null;
      infoTsunami = tt;
    }, 10000);
  }

  function socketInitializer() {
    if (socket != null) return;
    const socketUrl = PUBLIC_SOCKET_DATA_URL ?? "http://localhost:8081";
    socket = io(socketUrl);
    socket.on("connect", () => console.log("connected"));
    socket.on("warning", (v: any) => warningHandler(v));
    socket.on("message", (v: any) => console.log(v));
    socket.on("gempa", (data: any) => updateGempa(data));
    socket.on("tsunami", (data: any) => updateTsunami(data));
  }

  function initWorker() {
    worker = new Worker(new URL("$lib/worker.ts", import.meta.url), {
      type: "module",
    });
    worker.postMessage({
      type: "geoJsonData",
      data: geoJsonData,
      coastline: geoJsonCoastline,
    });
    worker.addEventListener("message", (event: any) => {
      if (
        event.data.type == "checkMultiHighlightArea" &&
        event.data.id == "wave"
      )
        recieveWave(event.data);
    });
  }

  function sendWave() {
    let t: any[] = [];
    for (let i = 0; i < titikGempaBaru.length; i++) {
      const v = titikGempaBaru[i];
      if (!v.finish) {
        t.push({
          id: v.id,
          center: v.center,
          mag: v.mag,
          depth: v.depth,
          pWaveRadius: v.pWaveRadius,
          sWaveRadius: v.sWaveRadius,
          areaTerdampak: [],
          message: v.description,
        });
      }
    }
    if (t.length > 0)
      worker!.postMessage({
        type: "checkMultiHighlightArea",
        titikGempa: t,
        id: "wave",
      });
  }

  async function recieveWave(data: any) {
    let ntgs: TitikGempa[] = [];
    for (let x = 0; x < data.titikGempa.length; x++) {
      const tg = data.titikGempa[x];
      const nig: InfoGempa = {
        id: tg.id,
        lng: parseFloat(tg.center[1]),
        lat: parseFloat(tg.center[0]),
        mag: tg.mag,
        depth: tg.depth,
        message: tg.message,
        place: tg.place,
        time: new Date().toLocaleString(),
        mmi: parseInt(
          new Date()
            .toLocaleString()
            ?.replaceAll("-", "")
            .replaceAll(" ", "")
            .replaceAll(":", "") || "0",
        ),
        listAffectedArea: [],
      };
      for (let il = 0; il < tg.areaTerdampak.length; il++) {
        const at = tg.areaTerdampak[il];

        const dist =
          turf.distance(
            turf.point([tg.center[0], tg.center[1]]),
            turf.point([at.center[0], at.center[1]]),
          ) -
          tg.sWaveRadius / 1000;
        const time = Math.floor(dist / 3) * 1000;
        const timeArrival = new Date(new Date().getTime() + time);

        nig.listAffectedArea!.push({
          lng: at.center[1],
          lat: at.center[0],
          distance: at.distance,
          name: at.alt_name,
          hit: at.hit,
          timeArrival: timeArrival,
        });
      }
      nig.listAffectedArea!.sort((a, b) => a.distance - b.distance);
      ntgs.push(new TitikGempa(tg.id, nig));
    }
    if (ntgs.length > 0) alertGempaBumis = ntgs;

    const areas = data.area;
    for (let x = 0; x < areas.length; x++) {
      const p: number[] = turf.centroid(areas[x]).geometry.coordinates;
      if (
        markerDaerahs.findIndex((el) => el[0] == p[0] && el[1] == p[1]) == -1
      ) {
        markerDaerahs.push([p[0], p[1]]);
        const markerParent = document.createElement("div");
        const markerEl = document.createElement("div");
        markerEl.innerHTML =
          '<p class="uppercase">' + areas[x].properties.alt_name + "</p>";
        markerEl.classList.add("marker-daerah");
        markerEl.classList.add("show-pop-up");
        markerParent.appendChild(markerEl);
        new mapboxgl.Marker(markerParent).setLngLat([p[0], p[1]]).addTo(map);
      }
    }

    if (map.getSource("hightlight-wave"))
      (map.getSource("hightlight-wave") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: areas,
      });
    else {
      map.addSource("hightlight-wave", {
        type: "geojson",
        data: { type: "FeatureCollection", features: areas },
      });
    }

    if (!map.getLayer("hightlight-wave-layer")) {
      map.addLayer({
        id: "hightlight-wave-layer",
        type: "fill",
        source: "hightlight-wave",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.8 },
      });
      map.moveLayer("outline");
      map.moveLayer("outline-coastline");
      for (let tg of tgs) {
        if (map.getLayer(tg.id)) map.moveLayer(tg.id);
      }
    }
    sendWave();
  }

  async function loadGeoJsonCoastline() {
    try {
      geoJsonCoastline = await mapLayerService.loadCoastlineLayer(map);
      loadGeoJsonData();
    } catch (e) {
      alert("Failed: " + e);
    }
  }

  async function loadGeoJsonData() {
    try {
      geoJsonData = await mapLayerService.loadTerritoryLayer(map);
      // initializeMapData();
      timezoneInterval = mapLayerService.addTimezoneLayer(map, mapboxgl);
      mapLayerService.addFaultLinesLayer(map);
      initWorker();
    } catch (e) {
      alert("Failed: " + e);
    }
  }

  // GET DATA EARTHQUAKE (Unified Initialization via Server-Side Proxy)
  function initializeMapData(customConfig?: any) {
    const fetchOptions = customConfig
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customConfig),
        }
      : { method: "GET" };

    fetch("/api/earthquakes", fetchOptions)
      .then((res) => res.json())
      .then(({ geoJson, infoList, dirasakanInfo, kecilInfo }) => {
        // Helper to parse dates from server reliably
        const parseDate = (val: any) => {
          if (!val) return DateTime.now();
          const dt = DateTime.fromISO(val);
          if (dt.isValid) return dt;
          return DateTime.fromFormat(
            String(val).substring(0, 19),
            "yyyy-MM-dd HH:mm:ss",
          );
        };

        // Re-wrap date strings into DateTime objects for logic that requires it
        if (dirasakanInfo) {
          dirasakanInfo.sentTime = parseDate(dirasakanInfo.sentTime);
        }
        if (kecilInfo) {
          kecilInfo.sentTime = parseDate(kecilInfo.sentTime);
        }

        // Set master store references
        geoJsonTitikGempa = geoJson;

        let ntg: TitikGempa[] = infoList.map(
          (info: any) => new TitikGempa(info.id, info),
        );
        tgs = ntg;
        events = [...tgs];

        // Ensure loading screen is removed
        setTimeout(() => {
          const el = document.getElementById("loading-screen");
          if (el) el.style.display = "none";
          loadingScreen = false;
        }, 1000);

        // Add map layers and socket listeners (Clean existing first for reload)
        if (map) {
          if (map.getLayer("earthquakes-layer")) {
            map.removeLayer("earthquakes-layer");
          }
          if (map.getSource("earthquakes")) {
            map.removeSource("earthquakes");
          }

          map.addSource("earthquakes", { type: "geojson", data: geoJson });
          map.addLayer({
            id: "earthquakes-layer",
            type: "circle",
            source: "earthquakes",
            paint: {
              "circle-radius": ["to-number", ["get", "mag"]],
              "circle-stroke-width": 2,
              "circle-color": [
                "case",
                ["<=", ["to-number", ["get", "depth"]], 50],
                "red",
                ["<=", ["to-number", ["get", "depth"]], 100],
                "orange",
                ["<=", ["to-number", ["get", "depth"]], 250],
                "yellow",
                ["<=", ["to-number", ["get", "depth"]], 600],
                "green",
                "blue",
              ],
              "circle-stroke-color": "white",
            },
            layout: {
              visibility: "visible",
            },
          });

          map.on("click", "earthquakes-layer", (e: any) => {
            const coords = e.features[0].geometry.coordinates.slice();
            const d = e.features[0].properties;
            const placeholder = document.createElement("div");
            placeholder.innerHTML = createGempaPopupHTML({
              id: d.id,
              mag: d.mag,
              depth: d.depth,
              time: new Date(d.time).toLocaleString(),
              lat: coords[1],
              lng: coords[0],
              place: d.place ?? "-",
            });
            new AnimatedPopup({
              openingAnimation: {
                duration: 100,
                easing: "easeOutSine",
                transform: "scale",
              },
              closingAnimation: {
                duration: 100,
                easing: "easeInOutSine",
                transform: "scale",
              },
            })
              .setDOMContent(placeholder)
              .setLngLat(coords)
              .addTo(map);
          });

          map.on(
            "mouseenter",
            "earthquakes-layer",
            () => (map.getCanvas().style.cursor = "pointer"),
          );

          map.on(
            "mouseleave",
            "earthquakes-layer",
            () => (map.getCanvas().style.cursor = ""),
          );
        }

        // Handle Audio Alerts and Component State for Gempa Dirasakan
        if (dirasakanInfo) {
          lastGempaId = dirasakanInfo.id;
          if (earthquakeService.isRecent(dirasakanInfo.sentTime)) {
            warningHandler(
              earthquakeService.buildWarningData(
                dirasakanInfo.info,
                dirasakanInfo.raw,
              ),
            );
            setTimeout(() => {
              GempaDirasakan = new TitikGempa(
                dirasakanInfo.info.id,
                dirasakanInfo.info,
                { map },
              );
            }, 6000);
          } else {
            GempaDirasakan = new TitikGempa(
              dirasakanInfo.info.id,
              dirasakanInfo.info,
              { map },
            );
          }
        }

        // Handle Audio Alerts and Component State for Gempa Kecil (Terakhir)
        if (kecilInfo) {
          lastGempaKecilId = kecilInfo.info.id;
          if (earthquakeService.isRecentUtc(kecilInfo.sentTime)) {
            var notif = new Audio(SOUNDS.SMALL_EARTHQUAKE);
            notif.play();
            alertGempaBumi = new TitikGempa(kecilInfo.info.id, kecilInfo.info);
          }
          GempaTerakhir = new TitikGempa(kecilInfo.info.id, kecilInfo.info, {
            pWaveSpeed: 6000,
            sWaveSpeed: 3000,
            map,
            description: kecilInfo.info.message,
            zoomToPosition: true,
            showMarker: true,
            showPopup: false,
          });
        }

        // Finally, spin up the Socket IO listeners
        socketInitializer();
      })
      .catch(console.error);
  }

  function updateGempa(data: any) {
    const { feature: geoFeature, info: nig } =
      earthquakeService.parseGempaFromSocket(data);
    if (lastGempaKecilId != nig.id) {
      lastGempaKecilId = nig.id;
      var notif = new Audio(SOUNDS.SMALL_EARTHQUAKE);
      notif.play();
      if (!map) return;

      if (
        GempaTerakhir != null &&
        GempaTerakhir.setting != null &&
        GempaTerakhir.setting.map != null
      ) {
        GempaTerakhir.removeAllRender();
        GempaTerakhir.removeMarker();
        if (tgs.length > 0) {
          const ig = tgs[0].infoGempa;
          geoJsonTitikGempa.features.push(
            earthquakeService.toGeoJsonFeature(ig),
          );
          (map.getSource("earthquakes") as mapboxgl.GeoJSONSource).setData(
            geoJsonTitikGempa,
          );
        }
      }

      tgs.push(
        new TitikGempa(nig.id, nig, {
          map,
          zoomToPosition: true,
          showMarker: true,
          showPopup: true,
          showPopUpInSecond: 1,
          description: nig.message,
        }),
      );
      tgs.sort(
        (a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime(),
      );
      events = [...tgs];
      GempaTerakhir = new TitikGempa(nig.id, nig);

      // Snapshot small earthquakes too
      setTimeout(() => {
        takeSnapshot(
          nig.id,
          nig.place || "Unknown",
          nig.mag || 0,
          nig.time || new Date().toLocaleString(),
        );
      }, 3000);
    }
  }

  function updateTsunami(data: any) {
    const parsed = earthquakeService.parseTsunamiFromSocket(data);
    if (parsed.isCancel) {
      try {
        map.removeLayer("outline-coastline");
        map.removeLayer("outline");
      } catch {}
    }
    if (lastGempaId != parsed.id) {
      lastGempaId = parsed.id;
      if (parsed.isTsunami) warningTsunamiHandler(data.info);
      else {
        const sentTime = parsed.sentTime;
        warningHandler({
          id: parsed.id,
          lng: parsed.coords[0],
          lat: parsed.coords[1],
          place: data.info.felt,
          mag: parseFloat(parseFloat(data.info.magnitude).toFixed(1)),
          depth: data.info.depth,
          message: data.info.description + "\n" + data.info.instruction,
          time:
            sentTime.toISODate() +
            " " +
            sentTime.toLocaleString(DateTime.TIME_24_WITH_SECONDS),
        });
      }
    }
  }

  async function selectEvent(d: InfoGempa) {
    detailInfoGempa = d;
    if (selectedPopup) selectedPopup.remove();
    if (d.mmi != 0) {
      fetch(
        "https://bmkg-content-inatews.storage.googleapis.com/" +
          d.mmi.toString() +
          ".mmi.jpg",
      ).then((response) => {
        if (response.status != 404) {
          shakeMap = d.mmi.toString() + ".mmi.jpg";
        } else {
          shakeMap = null;
        }
      });
    } else {
      shakeMap = null;
    }

    map.flyTo({ center: [d.lng, d.lat], zoom: 8, essential: true });
    const placeholder = document.createElement("div");
    placeholder.innerHTML = createGempaPopupHTML({
      id: d.id!,
      mag: d.mag!,
      depth: String(d.depth),
      time: new Date(d.time!).toLocaleString(),
      lat: d.lat,
      lng: d.lng,
    });
    selectedPopup = new AnimatedPopup({
      closeOnClick: false,
      openingAnimation: {
        duration: 100,
        easing: "easeOutSine",
        transform: "scale",
      },
      closingAnimation: {
        duration: 100,
        easing: "easeInOutSine",
        transform: "scale",
      },
    })
      .setDOMContent(placeholder)
      .setLngLat([d.lng, d.lat])
      .addTo(map);

    historyRecords = [];
    if (d.id) {
      historyRecords = await earthquakeService.fetchHistoryRecords(d.id);
    }
  }

  function testDemoGempa() {
    const data = generateRandomGempaData(geoJsonData);
    if (!data) {
      alert("Wait loading geojson");
      return;
    }
    showSettingsModal = false;
    warningHandler(data);
  }

  function testDemoTsunami() {
    earthquakeService
      .fetchTsunamiEvents()
      .then((infos) => {
        showSettingsModal = false;
        var randInfo = infos[(Math.random() * infos.length) | 0];
        warningTsunamiHandler(randInfo);
      })
      .catch(alert);
  }

  function removeAlertGempaBumi(index: number) {
    alertGempaBumis = alertGempaBumis.filter((_, idx) => idx !== index);
  }

  function saveSourceData() {
    try {
      const parsed = JSON.parse(sourceDataInput);
      localStorage.setItem("custom_source_data", sourceDataInput);
      showSourceModal = false;
      initializeMapData(parsed);
    } catch (e) {
      alert("Invalid JSON: " + e);
    }
  }

  function resetSourceData() {
    sourceDataInput = JSON.stringify(sourceDataConfig, null, 4);
    localStorage.removeItem("custom_source_data");
    showSourceModal = false;
    initializeMapData();
  }

  onMount(() => {
    map = new mapboxgl.Map({
      container: mapContainer,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 5,
      maxZoom: 22,
      preserveDrawingBuffer: true,
    });
    map.on("load", () => {
      const customData = localStorage.getItem("custom_source_data");
      if (customData) {
        try {
          sourceDataInput = customData;
          initializeMapData(JSON.parse(customData));
        } catch (e) {
          console.log(e);
          initializeMapData();
        }
      } else {
        initializeMapData();
      }
      loadGeoJsonCoastline();
    });
  });

  onDestroy(() => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    if (timezoneInterval) clearInterval(timezoneInterval);
  });
</script>

<div class="min-h-screen bg-black font-mono relative overflow-hidden">
  <audio id="danger" class="hidden"
    ><source src={SOUNDS.DANGER} type="audio/mp3" /></audio
  >
  <div bind:this={mapContainer} class="w-full h-screen"></div>

  <!-- SETTINGS BUTTON -->
  <div
    class="hidden md:flex no-snapshot fixed right-2 translate-y-0 top-2 left-0 right-0 m-auto flex-row justify-center items-center z-5 gap-2 pointer-events-none"
    style="width:fit-content"
  >
    <button
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      onclick={() => (showSettingsModal = true)}>SETTING</button
    >
    <button
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      onclick={() => (showSourceModal = true)}>SOURCE</button
    >
    <button
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      onclick={async () => {
        snapshotsList = await getSnapshots();
        showSnapshotModal = true;
      }}>SNAPSHOTS</button
    >
    <a
      class="ews-btn ews-btn-primary scale-75 md:scale-100 pointer-events-auto"
      href="/status-ui">STATION</a
    >
  </div>

  <div
    class="flex flex-col md:hidden justify-center fixed z-5 items-end left-auto right-0 top-0 bottom-0 m-auto"
  >
    <button
      class="ews-btn-primary p-1"
      onclick={() => (showSettingsModal = true)}
    >
      <Icon icon="weui:setting-filled" width="20" height="20" />
    </button>
    <button
      class="ews-btn-primary p-1"
      onclick={() => (showSourceModal = true)}
    >
      <Icon icon="ic:baseline-source" width="20" height="20" />
    </button>
    <button
      class="ews-btn-primary p-1"
      onclick={async () => {
        snapshotsList = await getSnapshots();
        showSnapshotModal = true;
      }}
    >
      <Icon icon="ic:baseline-camera" width="20" height="20" />
    </button>
    <a class="ews-btn-primary p-1" href="/status-ui">
      <Icon icon="zondicons:station" width="20" height="20" />
    </a>
  </div>

  <!-- SETTINGS MODAL -->
  <Modal bind:show={showSettingsModal} title="SETTING" variant="medium">
    <!-- Card Toggles -->
    <p class=" text-xs font-bold mb-3" style="color:var(--orange)">
      SHOWING CARD
    </p>
    <div class="settings-item">
      <span class=" text-sm">Event Log</span>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={showEventLog} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-item">
      <span class=" text-sm">Last Earthquake Felt</span>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={showGempaDirasakan} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-item">
      <span class=" text-sm">Last Detected Earthquake</span>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={showGempaTerdeteksi} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-item">
      <span class=" text-sm">Detail Event</span>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={showDetailEvent} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="settings-item">
      <span class=" text-sm">Shakemap</span>
      <label class="toggle-switch">
        <input type="checkbox" bind:checked={showShakeMap} />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <!-- Web Serial Connection -->
    <div class="mt-4 pt-3" style="border-top: 1px solid rgba(255, 165, 0, 0.3)">
      <p class=" text-xs font-bold mb-3" style="color:var(--orange)">
        HARDWARE LINK (WEB SERIAL)
      </p>
      <div class="flex-col justify-start items-start gap-3">
        <p class="text-[10px] opacity-70 leading-relaxed uppercase mb-2">
          Connect to ESP32 for external alerts (Buzzer/LED).
        </p>
        <div class="origin-left">
          <SerialStatus />
        </div>
      </div>
    </div>

    <!-- Test Buttons -->
    <div
      class="mt-4 pt-3"
      style="border-top: 1px solid rgba(var(--danger-glow-rgb), 0.3)"
    >
      <p class=" text-xs font-bold mb-3" style="color:var(--orange)">
        SIMULATION
      </p>
      <div class="flex gap-2">
        <button
          onclick={testDemoGempa}
          class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
        >
          <StripeBar loop={true} duration={20}></StripeBar>
          <span class="absolute bg-black ews-label px-2 py-1"
            >⚠ TEST EARTHQUAKE</span
          ></button
        >

        <button
          onclick={testDemoTsunami}
          class="cursor-pointer p-0 b-0 overflow-hidden flex items-center justify-center bordered p-1"
        >
          <StripeBar color="red" loop={true} reverse={true} duration={20}
          ></StripeBar>
          <span class="absolute bg-black ews-label px-2 py-1"
            >⚠ TEST TSUNAMI</span
          ></button
        >
      </div>
    </div>
  </Modal>

  <!-- SOURCE DATA MODAL -->
  <Modal
    bind:show={showSourceModal}
    title="SOURCE DATA CONFIG"
    variant="large"
    contentClass="flex flex-col gap-4"
  >
    <textarea
      bind:value={sourceDataInput}
      class="w-full h-96 bg-black text-green-500 font-mono p-2 border border-gray-700 focus:outline-none focus:border-red-500 custom-scrollbar text-xs"
    ></textarea>
    <div class="flex gap-2 justify-end">
      <button class="ews-btn ews-btn-danger" onclick={resetSourceData}
        >RESET</button
      >
      <button class="ews-btn ews-btn-primary" onclick={saveSourceData}
        >SAVE & RELOAD</button
      >
    </div>
  </Modal>

  <!-- SNAPSHOT MODAL -->
  <Modal
    bind:show={showSnapshotModal}
    title="SNAPSHOT LIST"
    variant="large"
    contentClass="flex flex-col gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar"
  >
    {#if snapshotsList.length === 0}
      <p class="text-center text-gray-400 my-8">No snapshots available.</p>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        {#each snapshotsList as snap (snap.id)}
          <div
            class="border border-gray-700 p-2 rounded bg-black flex flex-col items-center"
          >
            <p class="text-xs text-orange-500 font-bold mb-1">{snap.time}</p>
            <p
              class="text-xs text-gray-300 mb-2 truncate max-w-full"
              title={snap.place}
            >
              {snap.mag} M - {snap.place}
            </p>
            <img
              src={snap.imageBase64}
              alt="Snapshot"
              class="w-full h-auto mb-2 border border-gray-800"
            />
            <div class="flex gap-2 w-full mt-auto">
              <!-- Using standard download mechanism -->
              <a
                href={snap.imageBase64}
                download={`snapshot-${snap.time.replace(/[\/: ]/g, "-")}.jpg`}
                class="ews-btn ews-btn-primary flex-1 text-center decoration-none border-t border-red"
                >DOWNLOAD</a
              >
              <button
                class="ews-btn ews-btn-danger flex-1 text-center"
                onclick={async () => {
                  await deleteSnapshot(snap.id);
                  snapshotsList = await getSnapshots();
                }}>DELETE</button
              >
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Modal>

  <!-- EARTHQUAKE ALERT SECTION -->
  <div
    id="gempa-bumi-alert"
    class="fixed top-6 md:top-3 left-6 md:left-3 right-0 flex gap-2 justify-start items-start pointer-events-none"
  >
    {#if !loadingScreen && alertGempaBumi != undefined && alertGempaBumi != null}
      <Card
        className="hidden md:block show-pop-up md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto"
      >
        {#snippet title()}
          <StripeBar color="red" loop={true} reverse={true} duration={20}>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs">EARTHQUAKE</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-sm p-1 lg:p-2"
            style="font-size:10px"
          >
            <div class="w-full flex gap-2">
              <div>
                <div
                  class="ews-title text-3xl internal bordered flex mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {alertGempaBumi?.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal">
                    <div
                      class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                    <div
                      class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                  </div>
                </div>
                <p class=" font-bold">
                  DEPTH : {alertGempaBumi?.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-1 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left">TIME</td><td class="text-right"
                        >{alertGempaBumi?.readableTime} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">MAG</td><td class="text-right"
                        >{Number(alertGempaBumi?.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">DEPTH</td><td class="text-right"
                        >{alertGempaBumi?.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LAT</td><td class="text-right"
                        >{alertGempaBumi?.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LNG</td><td class="text-right"
                        >{alertGempaBumi?.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-2 bordered w-full">
              <p class=" p-2 break-words">
                {alertGempaBumi?.infoGempa.message}
              </p>
            </div>
          </div>
          {#if alertGempaBumi?.mag != undefined && alertGempaBumi?.mag >= 5}
            <div
              class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
              style="max-height:20vh"
            >
              <ul>
                {#if alertGempaBumi?.infoGempa.listAffectedArea}
                  {#each alertGempaBumi?.infoGempa.listAffectedArea as kota, i}
                    <li
                      class="flex flex-grow justify-between items-center mb-2 item-daerah {kota.hit
                        ? 'danger'
                        : ''} slide-in-left"
                    >
                      <AffectedAreaItem {kota} />
                    </li>
                  {/each}
                {/if}
              </ul>
            </div>
          {/if}
        {/snippet}
        {#snippet footer()}
          <button
            class="flex justify-center w-full cursor-pointer"
            onclick={() =>
              alertGempaBumi && selectEvent(alertGempaBumi.infoGempa)}
          >
            <Icon icon="ri:map-pin-fill" width="24" height="24" />
          </button>
        {/snippet}
      </Card>
    {/if}

    <!-- INFO TSUNAMI CARD -->
    {#if !loadingScreen && infoTsunami != undefined && infoTsunami != null}
      <Card
        className="hidden md:block show-pop-up md:w-1/3 lg:w-1/4 xl:w-1/5 2xl:w-1/6 pointer-events-auto bordered-red"
      >
        {#snippet title()}
          <div class="overflow-hidden">
            <StripeBar color="red" loop={true} reverse={true} duration={20}
            ></StripeBar>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs">TSUNAMI WARNING</p>
            </div>
          </div>
        {/snippet}

        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-sm p-1 lg:p-2"
            style="font-size:10px"
          >
            <div class="mt-2 bordered w-full">
              <p class=" p-2 break-words">
                {infoTsunami?.infoTsunami.message}
              </p>
            </div>
          </div>
          {#if infoTsunami?.infoTsunami.level?.includes("PD-1") || infoTsunami?.infoTsunami.level?.includes("PD-2")}
            <div
              class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
              style="max-height:20vh"
            >
              <ul>
                {#if infoTsunami?.infoTsunami.listAffectedArea}
                  {#each infoTsunami?.infoTsunami.listAffectedArea as kota, i}
                    <li
                      class="flex flex-grow justify-between items-center mb-2 item-daerah slide-in-left"
                    >
                      <AffectedAreaItem {kota} />
                    </li>
                  {/each}
                {/if}
              </ul>
            </div>
          {/if}
        {/snippet}

        {#snippet footer()}
          <div class="flex justify-center w-full">
            <span>{infoTsunami?.infoTsunami.level}</span>
          </div>
        {/snippet}
      </Card>
    {/if}

    <!-- ALERT EARTHQUAKES LIST -->
    {#if !loadingScreen}
      {#each alertGempaBumis as agi, i (agi.id)}
        <Card
          className="hidden md:block show-pop-up md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto"
        >
          {#snippet title()}
            <StripeBar color="red" reverse={true} loop={true} duration={20}>
              <div
                class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
              >
                <p class="p-1 bg-black font-bold text-xs">EARTHQUAKE</p>
              </div>
              <div
                class="absolute top-2 right-1 flex justify-center items-center"
                style="color:#e60003"
              >
                <button
                  onclick={() => removeAlertGempaBumi(i)}
                  class="bg-black px-2 py-1 cursor-pointer"
                  style="color:#e60003">X</button
                >
              </div>
            </StripeBar>
          {/snippet}
          {#snippet children()}
            <div
              class="flex flex-col w-full justify-center items-center text-sm p-1 lg:p-2"
              style="font-size:10px"
            >
              <div class="w-full flex gap-2">
                <div>
                  <div
                    class="ews-title text-3xl internal bordered flex mb-2 w-full lg:w-32"
                  >
                    <div class="flex flex-col items-center p-1">
                      <div class="text -characters">{agi.readableMag}</div>
                      <div class="text">MAG</div>
                    </div>
                    <div class="decal">
                      <div
                        class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                      ></div>
                      <div
                        class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                      ></div>
                    </div>
                  </div>
                  <p class=" font-bold">
                    DEPTH : {agi.readableDepth} KM
                  </p>
                </div>
                <div class="bordered p-1 lg:p-2 w-full">
                  <table class="w-full">
                    <tbody>
                      <tr
                        ><td class="text-left">TIME</td><td class="text-right"
                          >{agi.readableTime} WIB</td
                        ></tr
                      >
                      <tr
                        ><td class="text-left">MAG</td><td class="text-right"
                          >{Number(agi.mag).toFixed(1)}</td
                        ></tr
                      >
                      <tr
                        ><td class="text-left">DEPTH</td><td class="text-right"
                          >{agi.depth}</td
                        ></tr
                      >
                      <tr
                        ><td class="text-left">LAT</td><td class="text-right"
                          >{agi.infoGempa.lat}</td
                        ></tr
                      >
                      <tr
                        ><td class="text-left">LNG</td><td class="text-right"
                          >{agi.infoGempa.lng}</td
                        ></tr
                      >
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="mt-2 bordered w-full">
                <p class=" p-2 break-words">{agi.infoGempa.message}</p>
              </div>
            </div>
            {#if agi.mag >= 5}
              <div
                class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
                style="max-height:20vh"
              >
                <ul>
                  {#if agi.infoGempa.listAffectedArea}
                    {#each agi.infoGempa.listAffectedArea as kota, i}
                      <li
                        class="flex flex-grow justify-between items-center mb-2 item-daerah {kota.hit
                          ? 'danger'
                          : ''} slide-in-left"
                      >
                        <AffectedAreaItem {kota} />
                      </li>
                    {/each}
                  {/if}
                </ul>
              </div>
            {/if}
          {/snippet}

          {#snippet footer()}
            <button
              class="flex justify-center w-full cursor-pointer"
              onclick={() => agi && selectEvent(agi.infoGempa)}
            >
              <Icon icon="ri:map-pin-fill" width="20" height="20" />
            </button>
          {/snippet}
        </Card>
      {/each}
    {/if}
  </div>

  <!-- EVENT LOG -->
  {#if !loadingScreen && showEventLog}
    <Card
      className="no-snapshot fixed top-1 left-2 right-2 md:left-auto md:right-3 md:top-3 md:w-1/3 lg:w-1/5 show-pop-up ews-card ews-card-red ews-card-float"
    >
      {#snippet title()}
        <StripeBar color="red"
          ><div
            class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
          >
            <p class="text-lg bg-black font-bold ews-title text-3xl p-1">
              EVENT LOG
            </p>
          </div></StripeBar
        >
      {/snippet}
      {#snippet children()}
        <div class="w-full p-0 lg:p-2">
          <ul>
            {#each events as v, i (v.id)}
              <li class="w-full">
                <button
                  onclick={() => selectEvent(v.infoGempa)}
                  class="flex flex-col mb-1 md:mb-2 list-event cursor-pointer slide-in-left w-full text-start"
                  style="animation-delay:{i * 0.01}s"
                >
                  <span style="font-size:11px">{v.infoGempa.time} WIB</span>
                  <div class="bordered p-2" style="font-size:12px">
                    {v.readableMag} M - {v.infoGempa.place || "uknown"}
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/snippet}
    </Card>
  {/if}

  <!-- EARTHQUAKE DIRASAKAN SECTION -->
  <div
    id="gempa-bumi-dirasakan"
    class="fixed bottom-6 left-2 right-2 md:right-3 md:left-3 flex flex-row md:flex-col-reverse lg:flex-row gap-2 justify-center md:justify-start lg:items-end items-end pointer-events-none"
  >
    {#if !loadingScreen && GempaDirasakan != undefined && GempaDirasakan != null && showGempaDirasakan}
      <Card
        className="no-snapshot block show-pop-up w-1/2 md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto bordered-red"
      >
        {#snippet title()}
          <StripeBar loop={true} color="red">
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <div
                class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
              >
                <p
                  class="text-xs lg:text-lg bg-black font-bold p-1 ews-title text-3xl"
                >
                  LAST EARTHQUAKE FELT
                </p>
              </div>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet footer()}
          <button
            class="flex justify-center w-full cursor-pointer"
            onclick={() =>
              GempaDirasakan && selectEvent(GempaDirasakan.infoGempa)}
          >
            <Icon icon="ri:map-pin-fill" width="20" height="20" />
          </button>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-sm p-1 lg:p-2"
            style="font-size:10px"
          >
            <div class="w-full flex flex-col md:flex-row gap-2">
              <div>
                <div
                  class="ews-title text-3xl internal bordered flex justify-between mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {GempaDirasakan?.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal">
                    <div
                      class="w-full h-full stripe-bar-red-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                    <div
                      class="w-full h-full stripe-bar-red-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                  </div>
                </div>
                <p class=" font-bold">
                  DEPTH : {GempaDirasakan?.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-1 lg:p-2 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left p-0">TIME</td><td
                        class="text-right p-0"
                        >{GempaDirasakan?.infoGempa.time} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">MAG</td><td
                        class="text-right p-0"
                        >{Number(GempaDirasakan?.infoGempa.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">DEPTH</td><td
                        class="text-right p-0"
                        >{GempaDirasakan?.infoGempa.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">LAT</td><td
                        class="text-right p-0"
                        >{GempaDirasakan?.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">LNG</td><td
                        class="text-right p-0"
                        >{GempaDirasakan?.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-2 bordered hidden lg:block">
              <p class=" p-2 break-words">
                {GempaDirasakan?.infoGempa.message}
              </p>
            </div>
          </div>
        {/snippet}
      </Card>
    {/if}

    <!-- LAST DETECTED EARTHQUAKE -->
    {#if !loadingScreen && GempaTerakhir != undefined && GempaTerakhir != null && showGempaTerdeteksi}
      <Card
        className="block show-pop-up w-1/2 md:w-1/4 lg:w-1/6 pointer-events-auto"
      >
        {#snippet title()}
          <div class="overflow-hidden">
            <StripeBar loop={true} reverse={true}></StripeBar>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="bg-black font-bold p-1 ews-title text-xs lg:text-lg">
                LAST DETECTED EARTHQUAKE
              </p>
            </div>
          </div>
        {/snippet}
        {#snippet footer()}
          <button
            class="flex justify-center w-full cursor-pointer"
            onclick={() =>
              GempaTerakhir && selectEvent(GempaTerakhir.infoGempa)}
          >
            <Icon icon="ri:map-pin-fill" width="20" height="20" />
          </button>
        {/snippet}
        {#snippet children()}
          <div class=" text-sm w-full p-1 lg:p-2" style="font-size:10px">
            <table class="w-full">
              <tbody>
                <tr
                  ><td class="text-left">PLACE</td><td class="text-right"
                    >{GempaTerakhir?.infoGempa.place}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">TIME</td><td class="text-right"
                    >{GempaTerakhir?.readableTime} WIB</td
                  ></tr
                >
                <tr
                  ><td class="text-left">MAG</td><td class="text-right"
                    >{Number(GempaTerakhir?.infoGempa.mag).toFixed(1)}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">DEPTH</td><td class="text-right"
                    >{GempaTerakhir?.readableDepth} KM</td
                  ></tr
                >
                <tr
                  ><td class="text-left">LAT</td><td class="text-right"
                    >{GempaTerakhir?.infoGempa.lat}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">LNG</td><td class="text-right"
                    >{GempaTerakhir?.infoGempa.lng}</td
                  ></tr
                >
              </tbody>
            </table>
          </div>
        {/snippet}
      </Card>
    {/if}
  </div>

  <div
    class="hidden md:block right-0 bottom-0 left-0 md:left-auto md:bottom-6 md:right-3 fixed pointer-events-none flex gap-2 justify-end items-end"
  >
    <!-- DETAIL INFO EARTHQUAKE & SHAKEMAP -->
    {#if !loadingScreen && detailInfoGempa != undefined && detailInfoGempa != null && showDetailEvent}
      <Card
        className=" show-pop-up pointer-events-auto max-w-[100vw] md:max-w-100 "
      >
        {#snippet title()}
          <div class="flex justify-between">
            <p class="font-bold -red text-sm">DETAIL EVENT</p>
            <button
              onclick={() => {
                if (selectedPopup) selectedPopup.remove();
                detailInfoGempa = null;
              }}>X</button
            >
          </div>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full gap-2 text-sm w-full p-1 lg:p-2"
            style="font-size:10px"
          >
            <div class="bordered p-1 md:p-2">
              <table class="w-full">
                <tbody>
                  <tr
                    ><td class="text-left flex">PLACE</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      >{detailInfoGempa?.place}</td
                    ></tr
                  >
                  <tr
                    ><td class="text-left flex">TIME</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      data-time={detailInfoGempa?.time}
                      >{detailInfoGempa?.time} WIB</td
                    ></tr
                  >
                  <tr
                    ><td class="text-left flex">MAG</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      >{Number(detailInfoGempa?.mag).toFixed(1)}</td
                    ></tr
                  >
                  <tr
                    ><td class="text-left flex">DEPTH</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      >{parseFloat(
                        String(detailInfoGempa?.depth).replace("Km", ""),
                      ).toFixed(2)} KM</td
                    ></tr
                  >
                  <tr
                    ><td class="text-left flex">LAT</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      >{detailInfoGempa?.lat}</td
                    ></tr
                  >
                  <tr
                    ><td class="text-left flex">LNG</td><td
                      class="text-right break-words pl-1 md:pl-2"
                      >{detailInfoGempa?.lng}</td
                    ></tr
                  >
                </tbody>
              </table>
            </div>
            <div
              class="bordered pl-1 md:p-2 overflow-auto max-h-60 custom-scrollbar"
            >
              <table
                id="histori_tabel"
                style="font-size:10px"
                class="w-full text-right"
              >
                <thead>
                  <tr
                    ><th class="p-1">Time(UTC)</th><th class="p-1">+OT(min)</th
                    ><th class="p-1">Lat</th><th class="p-1">Lng</th><th
                      class="p-1">Depth</th
                    ><th class="p-1">Phase</th><th class="p-1">MagType</th><th
                      class="p-1">Mag</th
                    ><th class="p-1">MagCount</th><th class="p-1">Status</th
                    ></tr
                  >
                </thead>
                <tbody>
                  {#each historyRecords as row}
                    <tr>
                      {#each row as cell}
                        <td class="p-1">{cell}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/snippet}
      </Card>
    {/if}

    <!-- SHAKEMAP -->
    {#if shakeMap && showShakeMap}
      <Card className="show-pop-up pointer-events-auto">
        {#snippet title()}
          <div class="flex justify-between">
            <p class="font-bold -red text-sm">SHAKEMAP</p>
            <button
              onclick={() => {
                shakeMap = null;
              }}>X</button
            >
          </div>
        {/snippet}
        {#snippet children()}
          <div class="p-1 lg:p-2 w-full">
            <a
              href={"https://bmkg-content-inatews.storage.googleapis.com/" +
                shakeMap}
              target="_blank"
            >
              <img
                src={"https://bmkg-content-inatews.storage.googleapis.com/" +
                  shakeMap}
                alt=""
                width="300"
                style="filter: invert(1)"
              />
            </a>
          </div>
        {/snippet}
      </Card>
    {/if}
  </div>

  <!-- MOBILE WARNING CARD -->
  {#if !loadingScreen && alertGempaBumi && GempaDirasakan != undefined && GempaDirasakan != null}
    <div class="hidden show-pop-up fixed top-14 left-2 right-2 md:w-1/2 z-10">
      <Card>
        {#snippet title()}
          <StripeBar reverse={true} loop={true} duration={20}>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs">EARTHQUAKE</p>
            </div>
          </StripeBar>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-sm p-1 lg:p-2"
            style="font-size:10px"
          >
            <div class="w-full flex gap-2">
              <div>
                <div
                  class="ews-title text-3xl internal bordered flex mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {GempaDirasakan?.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal">
                    <div
                      class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                    <div
                      class="w-full h-full stripe-bar-vertical loop-stripe-vertical anim-duration-20"
                    ></div>
                  </div>
                </div>
                <p class=" font-bold">
                  DEPTH : {GempaDirasakan?.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-1 lg:p-2 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left">TIME</td><td class="text-right"
                        >{GempaDirasakan?.infoGempa.time} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">MAG</td><td class="text-right"
                        >{Number(GempaDirasakan?.infoGempa.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">DEPTH</td><td class="text-right"
                        >{GempaDirasakan?.infoGempa.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LAT</td><td class="text-right"
                        >{GempaDirasakan?.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LNG</td><td class="text-right"
                        >{GempaDirasakan?.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <!-- <div class="mt-2 bordered">
              <p class=" p-2 break-words">
                {GempaDirasakan?.infoGempa.message}
              </p>
            </div> -->
          </div>
        {/snippet}

        {#snippet footer()}
          <div
            class="flex justify-center w-full cursor-pointer"
            onclick={() =>
              GempaDirasakan && selectEvent(GempaDirasakan.infoGempa)}
          >
            <span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 25 25"
                stroke="currentColor"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.03125 10.392C5.03125 6.26528 8.3766 2.91992 12.5033 2.91992C16.63 2.91992 19.9754 6.26528 19.9754 10.392C19.9754 13.194 18.9108 15.7454 17.6454 17.7938C16.3778 19.8458 14.8791 21.441 13.9389 22.3454C13.139 23.1148 11.9045 23.1163 11.1026 22.3493C10.1581 21.4458 8.65084 19.8507 7.37569 17.7982C6.1028 15.7493 5.03125 13.1963 5.03125 10.392ZM9.50391 10.3906C9.50391 12.0475 10.8471 13.3906 12.5039 13.3906C14.1608 13.3906 15.5039 12.0475 15.5039 10.3906C15.5039 8.73377 14.1608 7.39062 12.5039 7.39062C10.8471 7.39062 9.50391 8.73377 9.50391 10.3906Z"
                  fill="#323544"
                />
              </svg>
            </span>
          </div>
        {/snippet}
      </Card>
    </div>
  {/if}

  <!-- EARTHQUAKE ALERT -->
  {#if !loadingScreen}
    {#each alertGempaBumis as v, i (v.id)}
      <div>
        <GempaBumiAlert
          magnitudo={v.mag}
          kedalaman={v.depth}
          show={true}
          closeInSecond={6}
        />
      </div>
    {/each}
  {/if}

  <!-- FOOTER LINKS -->
  <div
    class="fixed bottom-1 md:bottom-1 m-auto right-0 md:right-72 left-0 md:left-auto flex justify-center items-center gap-2 w-36 md:w-auto pointer-events-none opacity-50 hover:opacity-100 transition-opacity"
  >
    <a
      href="https://inatews.bmkg.go.id"
      class="flex gap-1 pointer-events-auto text-[10px]"
      ><div class="bmkg-icon scale-75"></div>
      <span>BMKG</span></a
    >
    <a
      href="https://github.com/bagusindrayana/ews-concept-new"
      class="flex gap-1 pointer-events-auto text-[10px]"
      ><div class="github-icon scale-75"></div>
      <span>Github</span></a
    >
  </div>

  <!-- TSUNAMI ALERT -->
  {#if !loadingScreen && alertTsunami != null && alertTsunami != undefined}
    <TsunamiAlert infoTsunami={alertTsunami.infoTsunami} />
  {/if}

  <!-- LOADING SCREEN -->
  <div
    class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center z-10 -red"
    id="loading-screen"
  >
    <span class="loader"></span>
    <p class="my-2 red-color p-2">
      THIS IS A CONCEPT DESIGN - EARTHQUAKE DATA FROM BMKG
    </p>
  </div>
</div>
