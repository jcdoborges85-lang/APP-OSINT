export function parseExifFromArrayBuffer(buffer) {
            const view = new DataView(buffer);
            if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null; // nao e JPEG

            let offset = 2;
            let tiffOffset = null;
            while (offset < view.byteLength) {
                if (view.getUint16(offset) === 0xFFE1) {
                    const exifId = view.getUint32(offset + 4);
                    if (exifId === 0x45786966) { // "Exif"
                        tiffOffset = offset + 10;
                        break;
                    }
                }
                if ((view.getUint16(offset) & 0xFF00) !== 0xFF00) break;
                offset += 2 + view.getUint16(offset + 2);
            }
            if (tiffOffset === null) return null;

            const little = view.getUint16(tiffOffset) === 0x4949;
            const getU16 = (o) => view.getUint16(o, little);
            const getU32 = (o) => view.getUint32(o, little);
            const getS32 = (o) => view.getInt32(o, little);

            function readIFD(ifdOffset) {
                const entries = {};
                const count = getU16(ifdOffset);
                for (let i = 0; i < count; i++) {
                    const entryOffset = ifdOffset + 2 + i * 12;
                    const tag = getU16(entryOffset);
                    const type = getU16(entryOffset + 2);
                    const numValues = getU32(entryOffset + 4);
                    const valueOffsetField = entryOffset + 8;
                    const typeSizes = { 1:1, 2:1, 3:2, 4:4, 5:8, 9:4, 10:8 };
                    const size = (typeSizes[type] || 1) * numValues;
                    const dataPos = size > 4 ? tiffOffset + getU32(valueOffsetField) : valueOffsetField;

                    let value;
                    if (type === 2) { // ASCII string
                        let str = '';
                        for (let j = 0; j < numValues - 1; j++) str += String.fromCharCode(view.getUint8(dataPos + j));
                        value = str;
                    } else if (type === 3) { // SHORT
                        value = numValues === 1 ? getU16(dataPos) : Array.from({length:numValues}, (_,j)=>getU16(dataPos + j*2));
                    } else if (type === 4) { // LONG
                        value = numValues === 1 ? getU32(dataPos) : Array.from({length:numValues}, (_,j)=>getU32(dataPos + j*4));
                    } else if (type === 5) { // RATIONAL
                        const readRational = (p) => { const n = getU32(p); const d = getU32(p+4); return d === 0 ? 0 : n / d; };
                        value = numValues === 1 ? readRational(dataPos) : Array.from({length:numValues}, (_,j)=>readRational(dataPos + j*8));
                    } else if (type === 9) {
                        value = getS32(dataPos);
                    } else {
                        value = null;
                    }
                    entries[tag] = value;
                }
                const nextIfdOffset = getU32(ifdOffset + 2 + count * 12);
                return { entries, nextIfdOffset };
            }

            const ifd0Offset = tiffOffset + getU32(tiffOffset + 4);
            const ifd0 = readIFD(ifd0Offset);
            const tags = ifd0.entries;

            const result = {
                make: tags[0x010F] || '',
                model: tags[0x0110] || '',
                orientation: tags[0x0112] || null,
                dateTime: null,
                gps: null
            };

            // Sub-IFD EXIF (0x8769) para DateTimeOriginal
            if (tags[0x8769]) {
                const exifIfd = readIFD(tiffOffset + tags[0x8769]);
                if (exifIfd.entries[0x9003]) result.dateTime = exifIfd.entries[0x9003];
                else if (exifIfd.entries[0x0132]) result.dateTime = exifIfd.entries[0x0132];
            }
            if (!result.dateTime && tags[0x0132]) result.dateTime = tags[0x0132];

            // GPS IFD (0x8825)
            if (tags[0x8825]) {
                const gpsIfd = readIFD(tiffOffset + tags[0x8825]);
                const g = gpsIfd.entries;
                if (g[0x0002] && g[0x0004]) {
                    result.gps = {
                        lat: g[0x0002], latRef: g[0x0001] || 'N',
                        lon: g[0x0004], lonRef: g[0x0003] || 'E'
                    };
                }
            }
            return result;
        }
