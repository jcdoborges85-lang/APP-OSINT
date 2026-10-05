const WIN_ANSI_MAP_PDF = {
    '\u2013': 0x96, '\u2014': 0x97, '\u2018': 0x91, '\u2019': 0x92,
    '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2026': 0x85, '\u00A0': 0x20
};

export function escapePdfText(str) {
            return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        }

export function toLatin1Pdf(str) {
            let out = '';
            for (const ch of str) {
                const code = ch.codePointAt(0);
                if (code <= 255) out += ch;
                else if (WIN_ANSI_MAP_PDF[ch] !== undefined) out += String.fromCharCode(WIN_ANSI_MAP_PDF[ch]);
                else out += '?';
            }
            return out;
        }

export function quebrarLinhasPdf(texto, maxChars) {
            const linhasFinal = [];
            const paragrafos = texto.split('\n');
            for (const paragrafo of paragrafos) {
                if (paragrafo.length === 0) { linhasFinal.push(''); continue; }
                const palavras = paragrafo.split(' ');
                let atual = '';
                for (const palavra of palavras) {
                    const candidato = atual ? atual + ' ' + palavra : palavra;
                    if (candidato.length > maxChars) {
                        if (atual) linhasFinal.push(atual);
                        let resto = palavra;
                        while (resto.length > maxChars) {
                            linhasFinal.push(resto.slice(0, maxChars));
                            resto = resto.slice(maxChars);
                        }
                        atual = resto;
                    } else {
                        atual = candidato;
                    }
                }
                if (atual) linhasFinal.push(atual);
            }
            return linhasFinal;
        }

export function construirPDFBytes(titulo, corpoTexto) {
            const PAGE_W = 595, PAGE_H = 842, MARGIN = 40, FONT_SIZE = 9;
            const CHAR_W = FONT_SIZE * 0.6;
            const LINE_H = 12.5;
            const maxChars = Math.floor((PAGE_W - MARGIN * 2) / CHAR_W);
            const linesPerFirstPage = Math.floor((PAGE_H - MARGIN * 2 - 30) / LINE_H);
            const linesPerOtherPage = Math.floor((PAGE_H - MARGIN * 2) / LINE_H);

            const tituloLatin1 = toLatin1Pdf(titulo);
            const todasLinhas = quebrarLinhasPdf(toLatin1Pdf(corpoTexto), maxChars);

            const paginasLinhas = [];
            let idx = 0, primeira = true;
            while (idx < todasLinhas.length || paginasLinhas.length === 0) {
                const limite = primeira ? linesPerFirstPage : linesPerOtherPage;
                paginasLinhas.push(todasLinhas.slice(idx, idx + limite));
                idx += limite;
                primeira = false;
                if (idx >= todasLinhas.length) break;
            }

            const totalPaginas = paginasLinhas.length;
            const catalogId = 1, pagesId = 2, fontRegularId = 3, fontBoldId = 4;
            let nextId = 5;
            const pageIds = [], contentIds = [];
            for (let p = 0; p < totalPaginas; p++) pageIds.push(nextId++);
            for (let p = 0; p < totalPaginas; p++) contentIds.push(nextId++);

            const objects = [];
            objects.push({ id: catalogId, body: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });
            objects.push({ id: pagesId, body: `<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${totalPaginas} >>` });
            objects.push({ id: fontRegularId, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>` });
            objects.push({ id: fontBoldId, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>` });

            for (let p = 0; p < totalPaginas; p++) {
                objects.push({
                    id: pageIds[p],
                    body: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[p]} 0 R >>`
                });
            }

            for (let p = 0; p < totalPaginas; p++) {
                const linhas = paginasLinhas[p];
                let stream = '';
                let startY = PAGE_H - MARGIN;

                if (p === 0) {
                    stream += `BT /F2 12 Tf ${MARGIN} ${startY} Td (${escapePdfText(tituloLatin1)}) Tj ET\n`;
                    startY -= 30;
                }

                stream += `BT /F1 ${FONT_SIZE} Tf ${LINE_H} TL ${MARGIN} ${startY} Td\n`;
                linhas.forEach((linha, i) => {
                    const op = i === 0 ? 'Tj' : "'";
                    stream += `(${escapePdfText(linha)}) ${op}\n`;
                });
                stream += `ET\nBT /F1 7 Tf ${PAGE_W - MARGIN - 60} ${MARGIN - 15} Td (Pagina ${p + 1} de ${totalPaginas}) Tj ET\n`;

                objects.push({ id: contentIds[p], body: `<< /Length ${stream.length} >>\nstream\n${stream}endstream` });
            }

            objects.sort((a, b) => a.id - b.id);

            let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
            const offsets = [];
            for (const obj of objects) {
                offsets[obj.id] = pdf.length;
                pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
            }

            const xrefStart = pdf.length;
            const maxId = objects[objects.length - 1].id;
            pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
            for (let i = 1; i <= maxId; i++) {
                const off = offsets[i] !== undefined ? offsets[i] : 0;
                pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
            }
            pdf += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

            const bytes = new Uint8Array(pdf.length);
            for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xFF;
            return bytes;
        }
