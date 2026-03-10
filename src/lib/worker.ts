import * as turf from '@turf/turf'

let allPolygon: any[] = [];
let allCoastline: any[] = [];

function checkIntersection(center: number[], size: number, id: string) {
    const coordinate = center;
    const radius = size;

    var buffer = turf.buffer(turf.point(coordinate), radius, { units: 'meters' });
    let highlightIntersectArea = [];
    for (let index = 0; index < allPolygon.length; index++) {
        const polygon = allPolygon[index];
        var intersection = turf.intersect(turf.featureCollection([polygon, buffer]));
        if (intersection) {
            highlightIntersectArea.push(intersection);
        }
    }

    self.postMessage({ id: id, type: "checkIntersection", area: highlightIntersectArea });
}

function checkHighlightArea(center: number[], size: number, id: string) {
    const coordinate = center;
    const radius = size;

    var buffer = turf.buffer(turf.point(coordinate), radius, { units: 'meters' });
    let highlightSelectedArea = [];
    for (let index = 0; index < allPolygon.length; index++) {
        const polygon = allPolygon[index];
        var intersection = turf.booleanIntersects(polygon, buffer);
        if (intersection) {
            highlightSelectedArea.push(polygon);
        }
    }

    self.postMessage({ id: id, type: "checkHighlightArea", area: highlightSelectedArea });
}

function checkMultiHighlightArea(titikGempa: any[], id: string) {
    let highlightSelectedArea: any[] = [];
    let highlightLine: any[] = [];

    for (let index = 0; index < allCoastline.length; index++) {
        const coastline = allCoastline[index];
        for (let it = 0; it < titikGempa.length; it++) {
            const tg = titikGempa[it];

            const coordinate = tg.center;
            const radius = tg.pWaveRadius;
            if (radius > 0) {
                var buffer = turf.buffer(turf.point(coordinate), radius, { units: 'meters' });
                var intersection = turf.booleanIntersects(coastline, buffer);
                coastline.properties.color = "orange";
                coastline.properties.hit = false;
                if (intersection) {
                    highlightLine.push(coastline);
                }
            }

            const sRadius = tg.sWaveRadius;

            if (sRadius > 0) {
                var buffer = turf.buffer(turf.point(coordinate), sRadius, { units: 'meters' });
                var intersection = turf.booleanIntersects(coastline, buffer);
                if (intersection) {
                    const item = highlightLine.find((e: any) => e.properties.mhid === coastline.properties.mhid);
                    if (item) {
                        item.properties.color = "red";
                        item.properties.hit = true;
                    }
                    const at = tg.areaTerdampak.find((e: any) => e.mhid === coastline.properties.mhid);
                    if (at) {
                        at.distance = turf.distance(turf.point(at.center), turf.point(coordinate));
                        at.color = "red";
                        at.hit = true;
                    }
                }
            }
        }
    }

    for (let index = 0; index < allPolygon.length; index++) {
        const polygon = allPolygon[index];

        for (let it = 0; it < titikGempa.length; it++) {
            const tg = titikGempa[it];

            const coordinate = tg.center;
            const radius = tg.pWaveRadius;
            if (radius > 0) {
                var buffer = turf.buffer(turf.point(coordinate), radius, { units: 'meters' });

                polygon.properties.color = "orange";
                polygon.properties.hit = false;
                polygon.properties.center = turf.centroid(polygon).geometry.coordinates;
                polygon.properties.titik_id = tg.id;

                var intersection = turf.booleanIntersects(polygon, buffer);
                if (intersection) {
                    highlightSelectedArea.push(polygon);
                    titikGempa[it].areaTerdampak.push(polygon.properties);
                }
            }
        }

        for (let it = 0; it < titikGempa.length; it++) {
            const tg = titikGempa[it];

            const coordinate = tg.center;
            const radius = tg.sWaveRadius;

            if (radius > 0) {
                var buffer = turf.buffer(turf.point(coordinate), radius, { units: 'meters' });

                var intersection = turf.booleanIntersects(polygon, buffer);
                if (intersection) {
                    const item = highlightSelectedArea.find((e: any) => e.properties.mhid === polygon.properties.mhid);
                    if (item) {
                        item.properties.color = "red";
                        item.properties.hit = true;
                    }
                    const at = tg.areaTerdampak.find((e: any) => e.mhid === polygon.properties.mhid);
                    if (at) {
                        at.distance = turf.distance(turf.point(at.center), turf.point(coordinate));
                        at.color = "red";
                        at.hit = true;
                    }
                }
            }
        }
    }

    self.postMessage({ id: id, type: "checkMultiHighlightArea", area: highlightSelectedArea, line: highlightLine, titikGempa: titikGempa });
}

self.addEventListener('message', function (ev: any) {

    var data = ev.data;
    if (data.type == "checkIntersection") {
        checkIntersection(data.center, data.size, data.id);
    }

    if (data.type == "checkHighlightArea") {
        checkHighlightArea(data.center, data.size, data.id);
    }

    if (data.type == "checkMultiHighlightArea") {
        checkMultiHighlightArea(data.titikGempa, data.id);
    }

    if (data.type == "geoJsonData") {
        const geoJson = data.data;
        for (let index = 0; index < geoJson.features.length; index++) {
            const feature = geoJson.features[index];
            if (!feature.geometry) {
                continue;
            }
            if (feature.geometry.type == 'Polygon') {
                allPolygon.push(turf.polygon(feature.geometry.coordinates, feature.properties));
            } else if (feature.geometry.type == 'MultiPolygon') {
                allPolygon.push(turf.multiPolygon(feature.geometry.coordinates, feature.properties));
            }
        }

        if (data.coastline) {
            const coastline = data.coastline;
            for (let index = 0; index < coastline.features.length; index++) {
                const feature = coastline.features[index];
                if (!feature.geometry) {
                    continue;
                }
                if (feature.geometry.type == 'LineString') {
                    allCoastline.push(turf.lineString(feature.geometry.coordinates, feature.properties));
                } else if (feature.geometry.type == 'MultiLineString') {
                    allCoastline.push(turf.multiLineString(feature.geometry.coordinates, feature.properties));
                }
            }
        }
    }
});
