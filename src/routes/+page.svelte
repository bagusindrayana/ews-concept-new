<script lang="ts">
  import { onMount } from "svelte";
  import "mapbox-gl/dist/mapbox-gl.css";
  import mapboxgl from "mapbox-gl";
  import { io } from "socket.io-client";
  import { DateTime } from "luxon";
  import { XMLParser } from "fast-xml-parser";
  import * as turf from "@turf/turf";
  import AnimatedPopup from "mapbox-gl-animated-popup";
  import { TitikGempa } from "$lib/components/TitikGempa";
  import { TitikTsunami } from "$lib/components/TitikTsunami";
  import type { InfoGempa, InfoTsunami } from "$lib/types";
  import GempaBumiAlert from "$lib/components/GempaBumiAlert.svelte";
  import TsunamiAlert from "$lib/components/TsunamiAlert.svelte";
  import Jam from "$lib/components/Jam.svelte";
  import ItemKotaTerdampak from "$lib/components/ItemKotaTerdampak.svelte";
  import Card from "$lib/components/Card.svelte";

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map;
  let socket: any;

  const dangerSound = "/sounds/siren-alarm-96503.mp3";
  const smallEarthQuakeSound = "/sounds/wrong-answer-129254.mp3";
  const tsunamiAlertSound = "/sounds/security-alarm-80493.mp3";

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

  // Missing earthquake tracking states
  let GempaDirasakan: TitikGempa | null = $state(null);
  let GempaTerakhir: TitikGempa | null = $state(null);

  let blinkInterval: ReturnType<typeof setInterval> | null = null;
  let selectedPopup: any = null;

  mapboxgl.accessToken =
    "pk.eyJ1IjoiYmFndXNpbmRyYXlhbmEiLCJhIjoiY2p0dHMxN2ZhMWV5bjRlbnNwdGY4MHFuNSJ9.0j5UAU7dprNjZrouWnoJyg";

  function fadeOutAudio(audioElement: HTMLAudioElement, duration: number) {
    let fadeInterval = 50;
    let step = audioElement.volume / (duration / fadeInterval);
    let fadeAudio = setInterval(() => {
      if (audioElement.volume > step) {
        audioElement.volume -= step;
      } else {
        audioElement.volume = 0;
        audioElement.pause();
        clearInterval(fadeAudio);
      }
    }, fadeInterval);
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
      listKotaTerdampak: [],
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

    var bgNotif = new Audio("/sounds/alert-109578.wav");
    bgNotif.volume = 0.3;
    bgNotif.loop = true;
    bgNotif.play();
    const audioDangerElement = document.getElementById(
      "danger",
    ) as HTMLAudioElement;
    setTimeout(() => {
      if (audioDangerElement) audioDangerElement.play();
      setTimeout(() => {
        new Audio("/voice/gempabumi.wav").play();
      }, 2000);
      setTimeout(() => fadeOutAudio(bgNotif, 2000), 6000);
    }, 2000);

    await new Promise((r) => setTimeout(r, 6000));
    events = [...tgs];
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

    const nit: InfoTsunami = {
      id,
      lng: parseFloat(coordinates[0]),
      lat: parseFloat(coordinates[1]),
      message: data.description + "\n" + data.instruction,
      level: data.subject,
      time: data.time || new Date().toLocaleString(),
      listKotaTerdampak: [],
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
        nit.listKotaTerdampak!.push({
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
    nit.listKotaTerdampak!.sort((a, b) => a.distance - b.distance);

    for (let x = 0; x < results.length; x++) {
      const p: number[] = turf.centroid(results[x]).geometry.coordinates;
      if (
        markerDaerahs.findIndex((el) => el[0] == p[0] && el[1] == p[1]) == -1
      ) {
        markerDaerahs.push([p[0], p[1]]);
        const markerParent = document.createElement("div");
        markerParent.innerHTML =
          '<p class="uppercase marker-daerah show-pop-up">' +
          results[x].properties.alt_name +
          "</p>";
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
    alertTsunami = tt;

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

    var bgNotif = new Audio("/sounds/security-alarm-63578.wav");
    bgNotif.volume = 0.3;
    bgNotif.loop = true;
    bgNotif.play();
    var notif = new Audio(tsunamiAlertSound);
    notif.loop = true;
    notif.play();

    setTimeout(() => {
      new Audio("/voice/terdeteksi.wav").play();
      setTimeout(() => {
        new Audio("/voice/" + level.toLowerCase() + ".wav").play();
        setTimeout(() => {
          new Audio("/voice/potensi.wav").play();
          if (level == "AWAS") {
            setTimeout(() => {
              new Audio("/voice/evakuasi.wav").play();
              setTimeout(() => {
                fadeOutAudio(notif, 1000);
                fadeOutAudio(bgNotif, 1000);
              }, 4000);
            }, 6000);
          } else {
            setTimeout(() => {
              new Audio("/voice/informasi.wav").play();
              setTimeout(() => {
                fadeOutAudio(notif, 1000);
                fadeOutAudio(bgNotif, 1000);
              }, 4000);
            }, 6000);
          }
        }, 5000);
      }, 5000);
    }, 2000);

    setTimeout(() => {
      shakeMap = data.shakemap;
    }, 9000);
    setTimeout(() => {
      alertTsunami = null;
      infoTsunami = tt;
    }, 10000);
  }

  function socketInitializer() {
    if (socket != null) return;
    socket = io("https://early-warning.potadev.com");
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
        listKotaTerdampak: [],
      };
      for (let il = 0; il < tg.areaTerdampak.length; il++) {
        const at = tg.areaTerdampak[il];
        nig.listKotaTerdampak!.push({
          lng: at.center[1],
          lat: at.center[0],
          distance: at.distance,
          name: at.alt_name,
          hit: at.hit,
          timeArrival: new Date(
            new Date().getTime() + Math.floor(at.distance / 3) * 1000,
          ),
        });
      }
      nig.listKotaTerdampak!.sort((a, b) => a.distance - b.distance);
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
        markerParent.innerHTML =
          '<p class="uppercase marker-daerah show-pop-up">' +
          areas[x].properties.alt_name +
          "</p>";
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

  function loadGeoJsonCoastline() {
    fetch("/geojson/garis_pantai.geojson")
      .then((r) => r.json())
      .then((data) => {
        geoJsonCoastline = data;
        if (!map.getSource("coastline")) {
          map.addSource("coastline", {
            type: "geojson",
            generateId: true,
            data,
          });
          map.addLayer({
            id: "outline-coastline",
            type: "line",
            source: "coastline",
            layout: { visibility: "none" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": 5,
              "line-opacity": 1,
            },
          });
        }
        loadGeoJsonData();
      })
      .catch((e) => alert("Failed: " + e));
  }

  function loadGeoJsonData() {
    fetch("/geojson/all_kabkota_ind_reduce.geojson")
      .then((r) => r.json())
      .then((data) => {
        geoJsonData = data;
        if (!map.getSource("wilayah")) {
          map.addSource("wilayah", { type: "geojson", generateId: true, data });
          map.addLayer({
            id: "outline",
            type: "line",
            source: "wilayah",
            paint: {
              "line-color": "#807a72",
              "line-width": 1,
              "line-opacity": 0.7,
            },
          });
          map.addLayer({
            id: "wilayah-fill",
            type: "fill",
            source: "wilayah",
            paint: { "fill-color": "red", "fill-opacity": 0 },
          });
        }
        getTitikGempaJson();
        getTimezoneGeojson();
        getFaultLineGeojson();
        initWorker();
      })
      .catch((e) => alert("Failed: " + e));
  }

  function getTitikGempaJson() {
    const url =
      "https://bmkg-content-inatews.storage.googleapis.com/gempaQL.json?t=" +
      new Date().getTime();
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        geoJsonTitikGempa = data;
        setTimeout(() => {
          const el = document.getElementById("loading-screen");
          if (el) el.style.display = "none";
          loadingScreen = false;
        }, 1000);
        let ntg: TitikGempa[] = [];
        for (let index = 0; index < data.features.length; index++) {
          const f = data.features[index];
          const dt = DateTime.fromSQL(f.properties.time, {
            zone: "UTC",
          }).setZone("Asia/Jakarta");
          ntg.push(
            new TitikGempa(f.properties.id, {
              id: f.properties.id,
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
              mag: f.properties.mag,
              depth: f.properties.depth,
              place: f.properties.place,
              time:
                dt.toISODate() +
                " " +
                dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS),
              mmi: 0,
            }),
          );
        }
        tgs = ntg;
        events = [...tgs];
        if (!map.getLayer("earthquakes-layer")) {
          map.addSource("earthquakes", { type: "geojson", data });
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
          });
        }
        map.on("click", "earthquakes-layer", (e: any) => {
          const coords = e.features[0].geometry.coordinates.slice();
          const d = e.features[0].properties;
          const placeholder = document.createElement("div");
          placeholder.innerHTML = `
          <div class="card bordered-red min-h-48 min-w-48 whitespace-pre-wrap" data-id="${d.id}">
            <div class="card-header bordered-red-bottom overflow-hidden">
              <div class="strip-wrapper"><div class="strip-bar"></div></div>
              <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
                <p class="p-1 bg-black font-bold text-xs text-glow">GEMPA BUMI</p>
              </div>
            </div>
            <div class="card-content p-2 text-glow text-sm w-full" style="font-size:10px">
              <table class="w-full">
                <tbody>
                  <tr><td class="flex">Magnitudo</td><td class="text-right break-words pl-2">${Number(d.mag).toFixed(1)}</td></tr>
                  <tr><td class="flex">Kedalaman</td><td class="text-right break-words pl-2">${d.depth}</td></tr>
                  <tr><td class="flex">Waktu</td><td class="text-right break-words pl-2">${new Date(d.time).toLocaleString()}</td></tr>
                  <tr><td class="flex">Lokasi (Lat,Lng)</td><td class="text-right break-words pl-2">${coords[0]} , ${coords[1]}</td></tr>
                </tbody>
              </table>
            </div>
          </div>`
            .trim()
            .replace(/>\s+</g, "><");
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
        getGempa();
        getGempaKecil();
      })
      .catch(console.error);
  }

  function getTimezoneGeojson() {
    map.addSource("timezone", {
      type: "geojson",
      generateId: true,
      data: "/geojson/timezones_wVVG8.geojson",
    });
    map.addLayer({
      id: "timezone-line",
      type: "line",
      source: "timezone",
      paint: { "line-color": "orange", "line-width": 1, "line-opacity": 0.5 },
    });

    const markerData = [
      {
        lng: 107.4999769225339,
        lat: 3.4359354227361933,
        zone: "Asia/Jakarta",
        label: "WIB / GMT+7",
      },
      {
        lng: 119.1174733337183,
        lat: 3.4359354227361933,
        zone: "Asia/Makassar",
        label: "WITA / GMT+8",
      },
      {
        lng: 131.58387377752751,
        lat: 3.4359354227361933,
        zone: "Asia/Jayapura",
        label: "WIT / GMT+9",
      },
    ];

    markerData.forEach((m) => {
      const wrapper = document.createElement("div");
      const el = document.createElement("div");
      el.className = "bordered p-1 text-time show-pop-up text-center";
      const zoneClass = m.zone.replace(/\//g, "-");
      el.innerHTML = `<p class="uppercase text-xl" style="line-height:1rem"><span class="jam-${zoneClass}"></span></p><p>${m.label}</p>`;
      wrapper.appendChild(el);
      new mapboxgl.Marker({ element: wrapper })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
    });

    setInterval(() => {
      markerData.forEach((m) => {
        const zoneClass = m.zone.replace(/\//g, "-");
        const el = document.querySelector(`.jam-${zoneClass}`);
        if (el)
          el.textContent = DateTime.now().setZone(m.zone).toFormat("HH:mm:ss");
      });
    }, 1000);
  }

  function getFaultLineGeojson() {
    map.addSource("indo_faults_lines", {
      type: "geojson",
      generateId: true,
      data: "/geojson/indo_faults_lines.geojson",
    });
    map.addLayer({
      id: "indo_faults_line_layer",
      type: "line",
      source: "indo_faults_lines",
      paint: { "line-color": "red", "line-width": 1, "line-opacity": 0.5 },
    });
  }

  function getGempa() {
    if (lastGempaId) return;
    const url =
      "https://bmkg-content-inatews.storage.googleapis.com/datagempa.json?t=" +
      new Date().getTime();
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const coords = data.info.point.coordinates.split(",");
        lastGempaId = data.identifier;
        const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), {
          zone: "Asia/Jakarta",
        });
        const readAbleTime =
          sentTime.toISODate() +
          " " +
          sentTime.toLocaleString(DateTime.TIME_24_WITH_SECONDS);
        const nig: InfoGempa = {
          id: data.identifier,
          lng: parseFloat(coords[0]),
          lat: parseFloat(coords[1]),
          place: data.info.felt,
          mag: data.info.magnitude,
          depth: data.info.depth,
          message: data.info.description,
          time: readAbleTime,
          mmi: parseInt(
            readAbleTime
              ?.replaceAll("-", "")
              .replaceAll(" ", "")
              .replaceAll(":", "") || "0",
          ),
        };
        const cek = tgs.find((v) => v.id == data.identifier);
        if (
          DateTime.now().setZone("Asia/Jakarta").toMillis() -
            sentTime.toMillis() <
          600000
        ) {
          warningHandler({
            id: data.identifier,
            lng: parseFloat(coords[0]),
            lat: parseFloat(coords[1]),
            mag: parseFloat(data.info.magnitude),
            place: data.info.felt,
            depth: data.info.depth,
            message: data.info.description + "\n" + data.info.instruction,
            time: readAbleTime,
          });
          setTimeout(() => {
            GempaDirasakan = new TitikGempa(nig.id, nig, { map });
          }, 6000);
        } else if (!cek) {
          tgs.push(new TitikGempa(nig.id, nig));
          tgs.sort(
            (a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime(),
          );
          geoJsonTitikGempa.features.push({
            geometry: {
              type: "Point",
              coordinates: [nig.lng, nig.lat, 1],
            },
            type: "Feature",
            properties: {
              id: nig.id,
              depth: parseFloat(String(nig.depth).replace(" Km", "")).toFixed(
                2,
              ),
              mag: nig.mag,
              time: nig.time,
              place: nig.place,
            },
          });
          (map.getSource("earthquakes") as mapboxgl.GeoJSONSource).setData(
            geoJsonTitikGempa,
          );
          events = [...tgs];
        }
        GempaDirasakan = new TitikGempa(nig.id, nig, { map });
        socketInitializer();
      })
      .catch(console.error);
  }

  function getGempaKecil() {
    if (lastGempaKecilId) return;
    const url =
      "https://bmkg-content-inatews.storage.googleapis.com/lastQL.json?t=" +
      new Date().getTime();
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.features.length > 0) {
          const feature = data.features[0];
          lastGempaKecilId = feature.properties.id;
          const dt = DateTime.fromSQL(feature.properties.time, {
            zone: "UTC",
          }).setZone("Asia/Jakarta");
          const readAbleTime =
            dt.toISODate() +
            " " +
            dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS);
          const nig: InfoGempa = {
            id: feature.properties.id,
            lng: parseFloat(feature.geometry.coordinates[0]),
            lat: parseFloat(feature.geometry.coordinates[1]),
            mag: parseFloat(feature.properties.mag),
            depth: feature.properties.depth,
            message: `${feature.properties.place}\nMag : ${Number(feature.properties.mag).toFixed(1)}`,
            place: feature.properties.place,
            time: readAbleTime,
            mmi: parseInt(
              readAbleTime
                ?.replaceAll("-", "")
                .replaceAll(" ", "")
                .replaceAll(":", "") || "0",
            ),
          };
          if (
            DateTime.now().setZone("UTC").toMillis() -
              DateTime.fromSQL(feature.properties.time, {
                zone: "UTC",
              }).toMillis() <
            600000
          ) {
            var notif = new Audio(smallEarthQuakeSound);
            notif.play();
            alertGempaBumi = new TitikGempa(feature.properties.id, nig);
          }

          GempaTerakhir = new TitikGempa(nig.id, nig, {
            pWaveSpeed: 6000,
            sWaveSpeed: 3000,
            map,
            description: nig.message,
            zoomToPosition: true,
            showMarker: true,
            showPopup: false,
          });
          const cek = tgs.find((v) => v.id == feature.properties.id);
          if (!cek) {
            tgs.unshift(new TitikGempa(feature.properties.id, nig));
            geoJsonTitikGempa.features.push(feature);
            (map.getSource("earthquakes") as mapboxgl.GeoJSONSource).setData(
              geoJsonTitikGempa,
            );
            events = [...tgs];
          }
        }
      })
      .catch(console.error);
  }

  function updateGempa(data: any) {
    const feature = data.features[0];
    const msg = `${feature.properties.place}\nMag : ${Number(feature.properties.mag).toFixed(1)}\nDepth : ${feature.properties.depth}`;
    const dt = DateTime.fromSQL(feature.properties.time, {
      zone: "UTC",
    }).setZone("Asia/Jakarta");
    const nig: InfoGempa = {
      id: feature.properties.id,
      lng: parseFloat(feature.geometry.coordinates[0]),
      lat: parseFloat(feature.geometry.coordinates[1]),
      mag: parseFloat(feature.properties.mag),
      depth: feature.properties.depth,
      message: msg,
      place: feature.properties.place,
      time:
        dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS),
      mmi: parseInt(
        dt
          .toISODate()
          ?.replaceAll("-", "")
          .replaceAll(" ", "")
          .replaceAll(":", "") || "0",
      ),
    };
    if (lastGempaKecilId != feature.properties.id) {
      lastGempaKecilId = feature.properties.id;
      var notif = new Audio(smallEarthQuakeSound);
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
          geoJsonTitikGempa.features.push({
            geometry: {
              type: "Point",
              coordinates: [ig.lng, ig.lat, 1],
            },
            type: "Feature",
            properties: {
              id: ig.id,
              depth: ig.depth,
              mag: ig.mag,
              time: ig.time,
              place: ig.place,
            },
          });
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
          description: msg,
        }),
      );
      tgs.sort(
        (a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime(),
      );
      events = [...tgs];
      GempaTerakhir = new TitikGempa(nig.id, nig);
    }
  }

  function updateTsunami(data: any) {
    var tsunami = false;
    if (data.info.wzarea != undefined && data.info.wzarea.length > 0) {
      if (data.info.subject == "Warning Tsunami PD-4") {
        try {
          map.removeLayer("outline-coastline");
          map.removeLayer("outline");
        } catch {}
      } else if (data.info.subject.includes("Warning Tsunami")) tsunami = true;
    }
    if (lastGempaId != data.identifier) {
      lastGempaId = data.identifier;
      const coords = data.info.point.coordinates.split(",");
      const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), {
        zone: "Asia/Jakarta",
      });
      if (tsunami) warningTsunamiHandler(data.info);
      else
        warningHandler({
          id: data.identifier,
          lng: parseFloat(coords[0]),
          lat: parseFloat(coords[1]),
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

  function selectEvent(d: InfoGempa) {
    detailInfoGempa = d;
    if (selectedPopup) selectedPopup.remove();
    if (d.mmi != 0) {
      // shakeMap = d.mmi.toString() + ".mmi.jpg";
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

    map.flyTo({ center: [d.lng, d.lat], zoom: 6, essential: true });
    const placeholder = document.createElement("div");
    placeholder.innerHTML = `
      <div class="card bordered-red min-h-48 min-w-48 whitespace-pre-wrap" data-id="${d.id}">
        <div class="card-header bordered-red-bottom overflow-hidden">
          <div class="strip-wrapper"><div class="strip-bar"></div></div>
          <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
            <p class="p-1 bg-black font-bold text-xs text-glow">GEMPA BUMI</p>
          </div>
        </div>
        <div class="card-content p-2 text-glow text-sm w-full">
          <table class="w-full">
            <tbody>
              <tr><td class="flex">Magnitudo</td><td class="text-right break-words pl-2">${Number(d.mag).toFixed(1)}</td></tr>
              <tr><td class="flex">Kedalaman</td><td class="text-right break-words pl-2">${d.depth}</td></tr>
              <tr><td class="flex">Waktu</td><td class="text-right break-words pl-2">${new Date(d.time!).toLocaleString()}</td></tr>
              <tr><td class="flex">Lokasi (Lat,Lng)</td><td class="text-right break-words pl-2">${d.lat} , ${d.lng}</td></tr>
            </tbody>
          </table>
        </div>
      </div>`
      .trim()
      .replace(/>\s+</g, "><");
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
    const cekTable = document.querySelector("#histori_tabel tbody");
    if (cekTable) cekTable.innerHTML = "<tr></tr>";
    setTimeout(() => {
      readTextFile(
        "https://bmkg-content-inatews.storage.googleapis.com/history." +
          d.id +
          ".txt",
      );
    }, 500);
  }

  function testDemoGempa() {
    if (geoJsonData == null) {
      alert("Wait loading geojson");
      return;
    }
    const bbox = turf.bbox(geoJsonData);
    const randomPosition = turf.randomPosition(bbox);
    const mag = (Math.random() * (10 - 5) + 5).toFixed(1);
    const depth = (Math.random() * 20).toFixed(1) + " Km";
    const message =
      "Gempa Bumi Test : Lat " +
      randomPosition[1].toFixed(4) +
      " Lng " +
      randomPosition[0].toFixed(4) +
      " Mag " +
      mag +
      " Depth " +
      depth;
    const dt = DateTime.now();
    const readAbleTime =
      dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS);
    warningHandler({
      id: `tg-${new Date().getTime()}`,
      lng: parseFloat(randomPosition[0].toFixed(4)),
      lat: parseFloat(randomPosition[1].toFixed(4)),
      mag: parseFloat(mag),
      depth,
      message,
      time: readAbleTime,
    });
  }

  function testDemoTsunami() {
    fetch(
      "https://bmkg-content-inatews.storage.googleapis.com/last30tsunamievent.xml",
    )
      .then((r) => r.text())
      .then((data) => {
        const parser = new XMLParser();
        let jObj = parser.parse(data);
        var infos = jObj.alert.info.filter((v: any) => v.wzarea != undefined);
        var randInfo = infos[(Math.random() * infos.length) | 0];
        warningTsunamiHandler(randInfo);
      })
      .catch(alert);
  }

  function readTextFile(e: string) {
    var t = new XMLHttpRequest();
    t.open("GET", e, false);
    t.onreadystatechange = function () {
      if (4 === t.readyState && (200 === t.status || 0 == t.status)) {
        let u = t.responseText.split("\n");
        var table = document.getElementById(
          "histori_tabel",
        ) as HTMLTableElement;
        for (let i = 1; i < u.length - 1; i++) {
          let T = u[i].split("|");
          var n = table.insertRow(i);
          for (let j = 0; j < T.length; j++) n.insertCell(j).innerHTML = T[j];
        }
      }
    };
    t.send(null);
  }

  function removeAlertGempaBumi(index: number) {
    alertGempaBumis = alertGempaBumis.filter((_, idx) => idx !== index);
  }

  onMount(() => {
    map = new mapboxgl.Map({
      container: mapContainer,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 5,
      maxZoom: 22,
    });
    map.on("load", () => loadGeoJsonCoastline());
  });
</script>

<div class="min-h-screen bg-black font-mono relative overflow-hidden">
  <audio id="danger" class="hidden"
    ><source src={dangerSound} type="audio/mp3" /></audio
  >
  <div bind:this={mapContainer} class="w-full h-screen"></div>

  <div
    class="fixed top-12 w-28 md:bottom-auto md:top-2 left-0 right-0 m-auto flex flex-col justify-center items-center gap-2"
  >
    <button
      class="bordered w-24 text-sm text-center bg-black cursor-pointer"
      onclick={testDemoGempa}>TEST GEMPA</button
    >
    <button
      class="bordered w-28 text-sm text-center bg-black cursor-pointer"
      onclick={testDemoTsunami}>TEST TSUNAMI</button
    >
  </div>

  <!-- GEMPA BUMI ALERT SECTION -->
  <div
    id="gempa-bumi-alert"
    class="fixed top-6 md:top-3 left-6 md:left-3 right-0 flex gap-2 justify-start items-start pointer-events-none"
  >
    {#if !loadingScreen && alertGempaBumi}
      <Card
        className="hidden md:block show-pop-up md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto"
      >
        {#snippet title()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
            </div>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs text-glow">GEMPA BUMI</p>
            </div>
          </div>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-glow text-sm"
            style="font-size:10px"
          >
            <div class="w-full flex gap-2">
              <div>
                <div
                  id="internal"
                  class="label bordered flex mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {alertGempaBumi.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal -blink -striped"></div>
                </div>
                <p class="text-glow font-bold">
                  DEPTH : {alertGempaBumi.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-1 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left">TIME</td><td class="text-right"
                        >{alertGempaBumi.readableTime} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">MAG</td><td class="text-right"
                        >{Number(alertGempaBumi.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">DEPTH</td><td class="text-right"
                        >{alertGempaBumi.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LAT</td><td class="text-right"
                        >{alertGempaBumi.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LNG</td><td class="text-right"
                        >{alertGempaBumi.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-2 bordered w-full">
              <p class="text-glow p-2 break-words">
                {alertGempaBumi.infoGempa.message}
              </p>
            </div>
          </div>
          {#if alertGempaBumi.mag >= 5}
            <div
              class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
              style="max-height:20vh"
            >
              <ul>
                {#if alertGempaBumi.infoGempa.listKotaTerdampak}
                  {#each alertGempaBumi.infoGempa.listKotaTerdampak as kota, i}
                    <li
                      class="flex flex-grow justify-between items-center mb-2 item-daerah {kota.hit
                        ? 'danger'
                        : ''} slide-in-left"
                    >
                      <ItemKotaTerdampak {kota} />
                    </li>
                  {/each}
                {/if}
              </ul>
            </div>
          {/if}
        {/snippet}
      </Card>
    {/if}

    <!-- INFO TSUNAMI CARD -->
    {#if !loadingScreen && infoTsunami}
      <Card
        className="hidden md:block show-pop-up md:w-1/3 lg:w-1/4 xl:w-1/5 2xl:w-1/6 pointer-events-auto"
      >
        {#snippet title()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
            </div>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs text-glow">
                PERINGATAN TSUNAMI
              </p>
            </div>
          </div>
        {/snippet}
        {#snippet footer()}
          <div class="flex justify-center w-full">
            <span>{infoTsunami.infoTsunami.level}</span>
          </div>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-glow text-sm"
            style="font-size:10px"
          >
            <div class="mt-2 bordered w-full">
              <p class="text-glow p-2 break-words">
                {infoTsunami.infoTsunami.message}
              </p>
            </div>
          </div>
          {#if infoTsunami.infoTsunami.level?.includes("PD-1") || infoTsunami.infoTsunami.level?.includes("PD-2")}
            <div
              class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
              style="max-height:20vh"
            >
              <ul>
                {#if infoTsunami.infoTsunami.listKotaTerdampak}
                  {#each infoTsunami.infoTsunami.listKotaTerdampak as kota, i}
                    <li
                      class="flex flex-grow justify-between items-center mb-2 item-daerah slide-in-left"
                    >
                      <ItemKotaTerdampak {kota} />
                    </li>
                  {/each}
                {/if}
              </ul>
            </div>
          {/if}
        {/snippet}
      </Card>
    {/if}

    <!-- ALERT GEMPA BUMIS LIST -->
    {#if !loadingScreen}
      {#each alertGempaBumis as agi, i}
        <Card
          className="hidden md:block show-pop-up md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto"
        >
          {#snippet title()}
            <div class="overflow-hidden">
              <div class="strip-wrapper">
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                ></div>
                <div
                  class="strip-bar loop-strip-reverse anim-duration-20"
                ></div>
              </div>
              <div
                class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
              >
                <p class="p-1 bg-black font-bold text-xs text-glow">
                  GEMPA BUMI
                </p>
              </div>
              <div
                class="absolute top-1 right-1 flex justify-center items-center"
                style="color:#e60003"
              >
                <button onclick={() => removeAlertGempaBumi(i)}>X</button>
              </div>
            </div>
          {/snippet}
          {#snippet children()}
            <div
              class="flex flex-col w-full justify-center items-center text-glow text-sm"
              style="font-size:10px"
            >
              <div class="w-full flex gap-2">
                <div>
                  <div
                    id="internal"
                    class="label bordered flex mb-2 w-full lg:w-32"
                  >
                    <div class="flex flex-col items-center p-1">
                      <div class="text -characters">{agi.readableMag}</div>
                      <div class="text">MAG</div>
                    </div>
                    <div class="decal -blink -striped"></div>
                  </div>
                  <p class="text-glow font-bold">
                    DEPTH : {agi.readableDepth} KM
                  </p>
                </div>
                <div class="bordered p-2 w-full">
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
                <p class="text-glow p-2 break-words">{agi.infoGempa.message}</p>
              </div>
            </div>
            {#if agi.mag >= 5}
              <div
                class="bordered-red p-2 overflow-y-auto custom-scrollbar mt-2 pointer-events-auto"
                style="max-height:20vh"
              >
                <ul>
                  {#if agi.infoGempa.listKotaTerdampak}
                    {#each agi.infoGempa.listKotaTerdampak as kota, i}
                      <li
                        class="flex flex-grow justify-between items-center mb-2 item-daerah {kota.hit
                          ? 'danger'
                          : ''} slide-in-left"
                      >
                        <ItemKotaTerdampak {kota} />
                      </li>
                    {/each}
                  {/if}
                </ul>
              </div>
            {/if}
          {/snippet}
        </Card>
      {/each}
    {/if}
  </div>

  <!-- EVENT LOG -->
  {#if !loadingScreen}
    <Card
      className="fixed right-0 md:right-3 top-1 md:top-3 card-float md:w-1/3 lg:w-1/5 show-pop-up"
    >
      {#snippet title()}
        <p
          class="font-bold text-glow-red text-sm text-center"
          style="color:red"
        >
          EVENT LOG
        </p>
      {/snippet}
      {#snippet children()}
        <ul>
          {#each events as v, i}
            <li
              onclick={() => selectEvent(v.infoGempa)}
              class="flex flex-col mb-2 list-event cursor-pointer slide-in-left"
              style="animation-delay:{i * 0.01}s"
            >
              <span style="font-size:11px">{v.infoGempa.time} WIB</span>
              <div class="bordered p-2" style="font-size:12px">
                {v.readableMag} M - {v.infoGempa.place || "uknown"}
              </div>
            </li>
          {/each}
        </ul>
      {/snippet}
    </Card>
  {/if}

  <!-- GEMPA BUMI DIRASAKAN SECTION -->
  <div
    id="gempa-bumi-dirasakan"
    class="fixed bottom-6 left-6 md:right-0 md:left-3 flex flex-col-reverse lg:flex-row gap-2 justify-start lg:items-end items-start pointer-events-none"
  >
    {#if !loadingScreen && GempaDirasakan}
      <Card
        className="hidden md:block show-pop-up md:w-1/2 lg:w-2/5 xl:w-1/5 pointer-events-auto"
      >
        {#snippet title()}
          <div class="w-full flex justify-center text-center">
            <p class="font-bold text-glow-red text-sm">
              GEMPA DIRASAKAN TERAKHIR
            </p>
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
                width="25"
                height="25"
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
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-glow text-sm"
            style="font-size:10px"
          >
            <div class="w-full flex flex-col md:flex-row gap-2">
              <div>
                <div
                  id="internal"
                  class="label bordered flex justify-between mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {GempaDirasakan.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal -blink -striped"></div>
                </div>
                <p class="text-glow font-bold">
                  DEPTH : {GempaDirasakan.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-2 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left p-0">TIME</td><td
                        class="text-right p-0"
                        >{GempaDirasakan.infoGempa.time} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">MAG</td><td
                        class="text-right p-0"
                        >{Number(GempaDirasakan.infoGempa.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">DEPTH</td><td
                        class="text-right p-0"
                        >{GempaDirasakan.infoGempa.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">LAT</td><td
                        class="text-right p-0"
                        >{GempaDirasakan.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left p-0">LNG</td><td
                        class="text-right p-0"
                        >{GempaDirasakan.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-2 bordered">
              <p class="text-glow p-2 break-words">
                {GempaDirasakan.infoGempa.message}
              </p>
            </div>
          </div>
        {/snippet}
      </Card>
    {/if}

    <!-- GEMPA TERDETEKSI TERAKHIR -->
    {#if !loadingScreen && GempaTerakhir}
      <Card
        className="hidden md:block show-pop-up md:w-1/4 lg:w-1/6 pointer-events-auto"
      >
        {#snippet title()}
          <div class="w-full flex justify-center text-center">
            <p class="font-bold text-glow-red text-sm">
              GEMPA TERDETEKSI TERAKHIR
            </p>
          </div>
        {/snippet}
        {#snippet footer()}
          <div
            class="flex justify-center w-full cursor-pointer"
            onclick={() =>
              GempaTerakhir && selectEvent(GempaTerakhir.infoGempa)}
          >
            <span>
              <svg
                width="25"
                height="25"
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
        {#snippet children()}
          <div class="text-glow text-sm w-full" style="font-size:10px">
            <table class="w-full">
              <tbody>
                <tr
                  ><td class="text-left">PLACE</td><td class="text-right"
                    >{GempaTerakhir.infoGempa.place}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">TIME</td><td class="text-right"
                    >{GempaTerakhir.readableTime} WIB</td
                  ></tr
                >
                <tr
                  ><td class="text-left">MAG</td><td class="text-right"
                    >{Number(GempaTerakhir.infoGempa.mag).toFixed(1)}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">DEPTH</td><td class="text-right"
                    >{GempaTerakhir.readableDepth} KM</td
                  ></tr
                >
                <tr
                  ><td class="text-left">LAT</td><td class="text-right"
                    >{GempaTerakhir.infoGempa.lat}</td
                  ></tr
                >
                <tr
                  ><td class="text-left">LNG</td><td class="text-right"
                    >{GempaTerakhir.infoGempa.lng}</td
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
    class="right-6 bottom-6 md:bottom-6 md:right-3 fixed pointer-events-none flex gap-2 justify-end items-end"
  >
    <!-- DETAIL INFO GEMPA & SHAKEMAP -->
    {#if !loadingScreen && detailInfoGempa}
      <Card className="show-pop-up pointer-events-auto">
        {#snippet title()}
          <div class="flex justify-between">
            <p class="font-bold text-glow-red text-sm">DETAIL EVENT</p>
            <button
              onclick={() => {
                if (selectedPopup) selectedPopup.remove();
                detailInfoGempa = null;
              }}>X</button
            >
          </div>
        {/snippet}
        {#snippet children()}
          <div class="text-glow text-sm w-full" style="font-size:10px">
            <div class="flex flex-col w-full gap-2">
              <div class="bordered p-2">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left flex">PLACE</td><td
                        class="text-right break-words pl-2"
                        >{detailInfoGempa.place}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left flex">TIME</td><td
                        class="text-right break-words pl-2"
                        data-time={detailInfoGempa.time}
                        >{detailInfoGempa.time} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left flex">MAG</td><td
                        class="text-right break-words pl-2"
                        >{Number(detailInfoGempa.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left flex">DEPTH</td><td
                        class="text-right break-words pl-2"
                        >{parseFloat(
                          String(detailInfoGempa.depth).replace("Km", ""),
                        ).toFixed(2)} KM</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left flex">LAT</td><td
                        class="text-right break-words pl-2"
                        >{detailInfoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left flex">LNG</td><td
                        class="text-right break-words pl-2"
                        >{detailInfoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
              <div class="bordered p-2 overflow-y-auto max-h-60">
                <table
                  id="histori_tabel"
                  style="font-size:10px"
                  class="w-full text-right"
                >
                  <thead>
                    <tr
                      ><th class="p-1">Time(UTC)</th><th class="p-1"
                        >+OT(min)</th
                      ><th class="p-1">Lat</th><th class="p-1">Lng</th><th
                        class="p-1">Depth</th
                      ><th class="p-1">Phase</th><th class="p-1">MagType</th><th
                        class="p-1">Mag</th
                      ><th class="p-1">MagCount</th><th class="p-1">Status</th
                      ></tr
                    >
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        {/snippet}
      </Card>
    {/if}

    <!-- SHAKEMAP -->
    {#if shakeMap}
      <Card className="show-pop-up pointer-events-auto">
        {#snippet title()}
          <div class="flex justify-between">
            <p class="font-bold text-glow-red text-sm">SHAKEMAP</p>
            <button
              onclick={() => {
                shakeMap = null;
              }}>X</button
            >
          </div>
        {/snippet}
        {#snippet children()}
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
        {/snippet}
      </Card>
    {/if}
  </div>

  <!-- MOBILE WARNING CARD -->
  {#if !loadingScreen && alertGempaBumi && GempaDirasakan}
    <div
      class="block md:hidden show-pop-up fixed bottom-10 left-0 card-warning right-0"
    >
      <Card>
        {#snippet title()}
          <div class="overflow-hidden">
            <div class="strip-wrapper">
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
              <div class="strip-bar loop-strip-reverse anim-duration-20"></div>
            </div>
            <div
              class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center"
            >
              <p class="p-1 bg-black font-bold text-xs text-glow">GEMPA BUMI</p>
            </div>
          </div>
        {/snippet}
        {#snippet children()}
          <div
            class="flex flex-col w-full justify-center items-center text-glow text-sm"
            style="font-size:10px"
          >
            <div class="w-full flex gap-2">
              <div>
                <div
                  id="internal"
                  class="label bordered flex mb-2 w-full lg:w-32"
                >
                  <div class="flex flex-col items-center p-1">
                    <div class="text -characters">
                      {GempaDirasakan.readableMag}
                    </div>
                    <div class="text">MAG</div>
                  </div>
                  <div class="decal -blink -striped"></div>
                </div>
                <p class="text-glow font-bold">
                  DEPTH : {GempaDirasakan.readableDepth} KM
                </p>
              </div>
              <div class="bordered p-2 w-full">
                <table class="w-full">
                  <tbody>
                    <tr
                      ><td class="text-left">TIME</td><td class="text-right"
                        >{GempaDirasakan.infoGempa.time} WIB</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">MAG</td><td class="text-right"
                        >{Number(GempaDirasakan.infoGempa.mag).toFixed(1)}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">DEPTH</td><td class="text-right"
                        >{GempaDirasakan.infoGempa.depth}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LAT</td><td class="text-right"
                        >{GempaDirasakan.infoGempa.lat}</td
                      ></tr
                    >
                    <tr
                      ><td class="text-left">LNG</td><td class="text-right"
                        >{GempaDirasakan.infoGempa.lng}</td
                      ></tr
                    >
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mt-2 bordered">
              <p class="text-glow p-2 break-words">
                {GempaDirasakan.infoGempa.message}
              </p>
            </div>
          </div>
        {/snippet}
      </Card>
    </div>
  {/if}

  <!-- GEMPA ALERT -->
  {#if !loadingScreen}
    {#each alertGempaBumis as v, i}
      <div>
        <GempaBumiAlert magnitudo={v.mag} kedalaman={v.depth} show={true} closeInSecond={6} />
      </div>
    {/each}
  {/if}

  <!-- FOOTER LINKS -->
  <div
    class="fixed bottom-2 md:bottom-1 m-auto right-0 md:right-72 left-0 md:left-auto flex justify-center items-center gap-2 w-36 md:w-auto pointer-events-none"
  >
    <a href="https://inatews.bmkg.go.id" class="flex gap-1 pointer-events-auto"
      ><div class="bmkg-icon"></div>
      <span>BMKG</span></a
    >
    <a
      href="https://github.com/bagusindrayana/ews-concept"
      class="flex gap-1 pointer-events-auto"
      ><div class="github-icon"></div>
      <span>Github</span></a
    >
  </div>

  <!-- TSUNAMI ALERT -->
  {#if !loadingScreen && alertTsunami}<TsunamiAlert {alertTsunami} />{/if}

  <!-- LOADING SCREEN -->
  <div
    class="fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center"
    id="loading-screen"
  >
    <span class="loader"></span>
    <p class="my-2 red-color p-2">
      INI MERUPAKAN DESAIN KONSEP - DATA GEMPA DARI BMKG
    </p>
  </div>
</div>
