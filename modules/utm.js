const UTM_A = 6378137.0;
const UTM_F = 1 / 298.257223563;
const UTM_E2 = UTM_F * (2 - UTM_F);
const UTM_EP2 = UTM_E2 / (1 - UTM_E2);
const UTM_K0 = 0.9996;

export function bandaMgrs(latDeg) {
            const letras = 'CDEFGHJKLMNPQRSTUVWX';
            if (latDeg < -80 || latDeg > 84) return '-';
            if (latDeg >= 72) return 'X';
            const idx = Math.floor((latDeg + 80) / 8);
            return letras[idx];
        }

export function ddParaUtm(latDeg, lonDeg) {
            const lat = latDeg * Math.PI / 180;
            const lon = lonDeg * Math.PI / 180;
            const zone = Math.floor((lonDeg + 180) / 6) + 1;
            const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

            const N = UTM_A / Math.sqrt(1 - UTM_E2 * Math.sin(lat) ** 2);
            const T = Math.tan(lat) ** 2;
            const C = UTM_EP2 * Math.cos(lat) ** 2;
            const Aa = Math.cos(lat) * (lon - lon0);

            const M = UTM_A * ((1 - UTM_E2 / 4 - 3 * UTM_E2 ** 2 / 64 - 5 * UTM_E2 ** 3 / 256) * lat
                - (3 * UTM_E2 / 8 + 3 * UTM_E2 ** 2 / 32 + 45 * UTM_E2 ** 3 / 1024) * Math.sin(2 * lat)
                + (15 * UTM_E2 ** 2 / 256 + 45 * UTM_E2 ** 3 / 1024) * Math.sin(4 * lat)
                - (35 * UTM_E2 ** 3 / 3072) * Math.sin(6 * lat));

            let easting = UTM_K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * UTM_EP2) * Aa ** 5 / 120) + 500000;
            let northing = UTM_K0 * (M + N * Math.tan(lat) * (Aa ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * Aa ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * UTM_EP2) * Aa ** 6 / 720));

            const southern = latDeg < 0;
            if (southern) northing += 10000000;

            return { zone, easting, northing, southern, banda: bandaMgrs(latDeg) };
        }

export function utmParaDd(zone, easting, northing, southern) {
            const e1 = (1 - Math.sqrt(1 - UTM_E2)) / (1 + Math.sqrt(1 - UTM_E2));
            const x = easting - 500000;
            const y = northing - (southern ? 10000000 : 0);

            const M = y / UTM_K0;
            const mu = M / (UTM_A * (1 - UTM_E2 / 4 - 3 * UTM_E2 ** 2 / 64 - 5 * UTM_E2 ** 3 / 256));

            const phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
                + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
                + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
                + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu));

            const N1 = UTM_A / Math.sqrt(1 - UTM_E2 * Math.sin(phi1) ** 2);
            const T1 = Math.tan(phi1) ** 2;
            const C1 = UTM_EP2 * Math.cos(phi1) ** 2;
            const R1 = UTM_A * (1 - UTM_E2) / Math.pow(1 - UTM_E2 * Math.sin(phi1) ** 2, 1.5);
            const D = x / (N1 * UTM_K0);

            const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * UTM_EP2) * D ** 4 / 24
                + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * UTM_EP2 - 3 * C1 ** 2) * D ** 6 / 720);
            const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
            const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * UTM_EP2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(phi1);

            return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
        }
