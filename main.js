async function calcularHashBuffer(buffer, algoritmo) {
            const hashBuffer = await crypto.subtle.digest(algoritmo, buffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

function parseExifFromArrayBuffer(buffer) {
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

const UTM_A = 6378137.0;
const UTM_F = 1 / 298.257223563;
const UTM_E2 = UTM_F * (2 - UTM_F);
const UTM_EP2 = UTM_E2 / (1 - UTM_E2);
const UTM_K0 = 0.9996;

function bandaMgrs(latDeg) {
            const letras = 'CDEFGHJKLMNPQRSTUVWX';
            if (latDeg < -80 || latDeg > 84) return '-';
            if (latDeg >= 72) return 'X';
            const idx = Math.floor((latDeg + 80) / 8);
            return letras[idx];
        }

function ddParaUtm(latDeg, lonDeg) {
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

function utmParaDd(zone, easting, northing, southern) {
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


        let arquivoHashGlobal = null;

        // ===================== CADEIA DE CUSTÓDIA: IDENTIFICAÇÃO DO PERITO =====================
        let peritoInfo = { nome: '', matricula: '', orgao: '' };

        function atualizarIdentificacaoPerito() {
            peritoInfo.nome = document.getElementById('peritoNome').value.trim();
            peritoInfo.matricula = document.getElementById('peritoMatricula').value.trim();
            peritoInfo.orgao = document.getElementById('peritoOrgao').value.trim();

            const badge = document.getElementById('peritoStatusBadge');
            const completo = peritoInfo.nome && peritoInfo.matricula;
            badge.innerText = completo ? 'IDENTIFICADO' : 'NÃO IDENTIFICADO';
            badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full ml-auto ' + (completo ? 'badge-ok' : 'badge-warn');
        }

        function assinaturaPerito() {
            if (peritoInfo.nome || peritoInfo.matricula || peritoInfo.orgao) {
                const partes = [];
                if (peritoInfo.nome) partes.push(peritoInfo.nome);
                if (peritoInfo.matricula) partes.push('Matrícula: ' + peritoInfo.matricula);
                if (peritoInfo.orgao) partes.push(peritoInfo.orgao);
                return partes.join(' — ');
            }
            return '[IDENTIFICAÇÃO DO PERITO NÃO PREENCHIDA]';
        }

        // ===================== LOG DE AUDITORIA DA SESSÃO =====================
        let logAuditoria = [];

        function registrarLogAuditoria(descricao) {
            const agora = new Date();
            const carimbo = agora.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            logAuditoria.push({ carimbo, descricao });

            const container = document.getElementById('logAuditoriaLista');
            if (container) {
                const vazio = document.getElementById('logAuditoriaVazio');
                if (vazio) vazio.remove();
                const linha = document.createElement('div');
                linha.className = 'log-entry';
                linha.innerText = `[${carimbo}] ${descricao}`;
                container.appendChild(linha);
                container.scrollTop = container.scrollHeight;
            }
        }

        function baixarLogAuditoria() {
            if (logAuditoria.length === 0) {
                showToast('O log de auditoria está vazio.');
                return;
            }
            const cabecalho = `=== LOG DE AUDITORIA DA SESSÃO ===\nAgente/Perito: ${assinaturaPerito()}\nGerado em: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC\n\n`;
            const corpo = logAuditoria.map(l => `[${l.carimbo}] ${l.descricao}`).join('\n');
            const blob = new Blob([cabecalho + corpo], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Log_Auditoria_Sessao.txt';
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Log de auditoria baixado!');
        }

        function showToast(msg) {
            const toast = document.getElementById('toastNotification');
            document.getElementById('toastMsg').innerText = msg;
            toast.classList.remove('opacity-0', 'translate-y-20');
            toast.classList.add('opacity-100', 'translate-y-0');
            setTimeout(() => {
                toast.classList.remove('opacity-100', 'translate-y-0');
                toast.classList.add('opacity-0', 'translate-y-20');
            }, 2500);
        }

        function switchTab(tabId) {
            const targetTab = document.getElementById('tab-' + tabId);
            const activeBtn = document.getElementById('btn-' + tabId);
            if (!targetTab || !activeBtn) return;

            const jaEstavaAberta = !targetTab.classList.contains('hidden');

            // Fecha todos os paineis e desmarca todos os botoes
            document.querySelectorAll('.accordion-panel').forEach(tab => tab.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('bg-[#2563eb]', 'text-white', 'shadow-md');
                btn.classList.add('bg-slate-800', 'text-slate-300');
                const chevron = btn.querySelector('.nav-chevron');
                if (chevron) chevron.classList.remove('open');
            });

            // Se o painel clicado ja estava aberto, apenas o recolhe (comportamento de accordion).
            // Caso contrario, abre o painel clicado logo abaixo do proprio botao.
            if (!jaEstavaAberta) {
                targetTab.classList.remove('hidden');
                activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
                activeBtn.classList.add('bg-[#2563eb]', 'text-white', 'shadow-md');
                const chevron = activeBtn.querySelector('.nav-chevron');
                if (chevron) chevron.classList.add('open');
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function copiarTexto(elementId, msg = 'Conteúdo copiado!') {
            const el = document.getElementById(elementId);
            if (!el) return;
            const text = el.innerText || el.value;
            navigator.clipboard.writeText(text).then(() => showToast(msg));
        }

        function copiarDirect(text) {
            navigator.clipboard.writeText(text).then(() => showToast('Copiado: ' + text));
        }

        function baixarArquivo(elementId, filename) {
            const text = document.getElementById(elementId).innerText;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Download concluído!');
        }

        // ===================== GERADOR DE PDF (via jsPDF) =====================

        function baixarComoPDF(elementId, filename, tituloDocumento) {
            const texto = document.getElementById(elementId).innerText;
            if (!texto || texto.trim().length === 0) {
                showToast('Nada para exportar ainda.');
                return;
            }
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                // Setup dimensions and fonts
                const margin = 15;
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                let cursorY = margin;

                // Header Background
                doc.setFillColor(37, 99, 235); // Blue (#2563eb)
                doc.rect(0, 0, pageWidth, 25, 'F');

                // Add a simple logo placeholder (white circle with 'OSINT' text)
                doc.setFillColor(255, 255, 255);
                doc.circle(margin + 5, 12.5, 7, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.setFontSize(10);
                // "OSINT" centered in the circle roughly
                doc.text("HUB", margin + 1.5, 14);

                // Header Text
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(14);
                doc.text(tituloDocumento, margin + 18, 14.5);

                cursorY = 35; // Start writing text below header
                doc.setTextColor(30, 41, 59); // Slate-800

                const paragraphs = texto.split('\n');

                paragraphs.forEach(paragraph => {
                    const text = paragraph.trim();
                    if (!text) {
                        cursorY += 5; // Spacing for empty lines
                        return;
                    }

                    // Helper to check and add page if needed
                    const checkPageBreak = (neededHeight) => {
                        if (cursorY + neededHeight > pageHeight - margin - 10) {
                            doc.addPage();
                            cursorY = margin + 10;
                        }
                    };

                    // Parse formatting patterns
                    if (text.startsWith('===')) {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(14);
                        const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
                        lines.forEach(line => {
                            checkPageBreak(7);
                            doc.text(line, margin, cursorY);
                            cursorY += 7;
                        });
                        cursorY += 2;
                    } else if (/^\d+\./.test(text)) { // Section Headers (1., 2. etc)
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
                        lines.forEach(line => {
                            checkPageBreak(6);
                            doc.text(line, margin, cursorY);
                            cursorY += 6;
                        });
                        cursorY += 2;
                    } else if (text.startsWith('•')) { // Bullet points
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);

                        // Bold labels ending with colon
                        const colonIndex = text.indexOf(':');
                        if (colonIndex > 0 && colonIndex < 40) {
                            const label = text.substring(0, colonIndex + 1);
                            const value = text.substring(colonIndex + 1);

                            doc.setFont('helvetica', 'bold');
                            const labelWidth = doc.getTextWidth(label + " ");

                            doc.setFont('helvetica', 'normal');
                            const lines = doc.splitTextToSize(value, pageWidth - margin * 2 - 5 - labelWidth);

                            lines.forEach((line, index) => {
                                checkPageBreak(5);
                                if (index === 0) {
                                    doc.setFont('helvetica', 'bold');
                                    doc.text(label, margin + 5, cursorY);
                                    doc.setFont('helvetica', 'normal');
                                    doc.text(line, margin + 5 + labelWidth, cursorY);
                                } else {
                                    doc.text(line, margin + 5 + labelWidth, cursorY);
                                }
                                cursorY += 5;
                            });
                            cursorY += 1;
                        } else {
                            const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 5);
                            lines.forEach(line => {
                                checkPageBreak(5);
                                doc.text(line, margin + 5, cursorY);
                                cursorY += 5;
                            });
                            cursorY += 1;
                        }
                    } else { // Regular text
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
                        lines.forEach(line => {
                            checkPageBreak(5);
                            doc.text(line, margin, cursorY);
                            cursorY += 5;
                        });
                        cursorY += 1;
                    }
                });

                // Footer (Page numbers)
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139); // Slate-500
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 20, pageHeight - margin + 5);
                }

                doc.save(filename);
                registrarLogAuditoria(`Documento exportado em PDF (jsPDF): ${filename}`);
                showToast('PDF gerado e baixado!');
            } catch (err) {
                console.error("PDF Generation error:", err);
                showToast('Erro ao gerar PDF: ' + err.message);
            }
        }

        function filtrarConteudoGlobal() {
            const query = document.getElementById('globalSearch').value.toLowerCase().trim();
            document.querySelectorAll('.search-item').forEach(item => {
                item.style.display = item.innerText.toLowerCase().includes(query) ? 'flex' : 'none';
            });
        }

        // ===================== FORENSE: HASH DE ARQUIVO =====================


        async function processarHashArquivo(event) {
            const file = event.target.files[0];
            if (!file) return;

            arquivoHashGlobal = file;
            document.getElementById('fileNameDisplay').innerText = file.name;
            document.getElementById('fileSizeDisplay').innerText = (file.size / 1024).toFixed(2) + " KB";
            document.getElementById('fileTypeDisplay').innerText = file.type || 'Desconhecido';
            document.getElementById('hashResult').innerText = "Calculando Hash SHA-256...";
            document.getElementById('hashResultSha1').innerText = "Calculando Hash SHA-1...";
            document.getElementById('hashVerificarResultado').classList.add('hidden');

            try {
                const buffer = await file.arrayBuffer();
                const [hashSha256, hashSha1] = await Promise.all([
                    calcularHashBuffer(buffer, 'SHA-256'),
                    calcularHashBuffer(buffer, 'SHA-1')
                ]);

                document.getElementById('hashResult').innerText = hashSha256;
                document.getElementById('hashResultSha1').innerText = hashSha1;
                registrarLogAuditoria(`Hash calculado para o arquivo "${file.name}" (SHA-256: ${hashSha256.substring(0, 16)}...)`);
                showToast('Hash SHA-256 e SHA-1 calculados do arquivo!');
            } catch (err) {
                document.getElementById('hashResult').innerText = "Erro ao calcular hash: " + err.message;
                document.getElementById('hashResultSha1').innerText = "Erro ao calcular hash.";
            }
        }

        function verificarIntegridadeHash() {
            const esperado = document.getElementById('hashVerificarInput').value.trim().toLowerCase();
            const calculado = document.getElementById('hashResult').innerText.trim().toLowerCase();
            const resultEl = document.getElementById('hashVerificarResultado');

            resultEl.classList.remove('hidden', 'badge-ok', 'badge-err', 'badge-warn');

            if (!esperado) {
                resultEl.innerText = 'Informe um hash de referência para comparar.';
                resultEl.classList.add('badge-warn');
                return;
            }
            if (!calculado || calculado === 'aguardando arquivo...' || calculado.startsWith('erro')) {
                resultEl.innerText = 'Nenhum hash calculado ainda — carregue um arquivo primeiro.';
                resultEl.classList.add('badge-warn');
                return;
            }

            if (esperado === calculado) {
                resultEl.innerText = '✔ ÍNTEGRO: o hash informado confere exatamente com o hash calculado do arquivo.';
                resultEl.classList.add('badge-ok');
                registrarLogAuditoria('Verificação de integridade: hash CONFERE (arquivo íntegro).');
            } else {
                resultEl.innerText = '✘ DIVERGENTE: o hash informado NÃO confere com o arquivo carregado — possível alteração ou arquivo diferente.';
                resultEl.classList.add('badge-err');
                registrarLogAuditoria('Verificação de integridade: hash DIVERGENTE (possível alteração).');
            }
        }

        // ===================== PRESERVAÇÃO DE CONTEÚDO WEB =====================
        let preservacaoArquivoGlobal = null;
        let preservacaoHashGlobal = '';

        async function processarPreservacaoArquivo(event) {
            const file = event.target.files[0];
            if (!file) return;

            preservacaoArquivoGlobal = file;
            document.getElementById('preservFileNameDisplay').innerText = file.name;
            document.getElementById('preservHashDisplay').innerText = 'Calculando...';

            try {
                const buffer = await file.arrayBuffer();
                preservacaoHashGlobal = await calcularHashBuffer(buffer, 'SHA-256');
                document.getElementById('preservHashDisplay').innerText = preservacaoHashGlobal;
                registrarLogAuditoria(`Captura de página web anexada: "${file.name}" (hash calculado).`);
                atualizarTermoPreservacao();
                showToast('Hash da captura calculado!');
            } catch (err) {
                document.getElementById('preservHashDisplay').innerText = 'Erro ao calcular hash.';
            }
        }

        function atualizarTermoPreservacao() {
            const url = document.getElementById('preservUrl').value.trim();
            const descricao = document.getElementById('preservDescricao').value.trim();
            const agora = new Date();
            const carimbo = agora.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

            if (!url) {
                document.getElementById('preservTermoTexto').innerText = 'Preencha a URL para gerar o termo...';
                return;
            }

            const nomeArquivo = preservacaoArquivoGlobal ? preservacaoArquivoGlobal.name : '[NENHUMA CAPTURA ANEXADA — recomenda-se anexar print/screenshot]';
            const hash = preservacaoHashGlobal || '[SEM HASH — anexe a captura de tela para gerar]';

            const texto = `=== TERMO DE PRESERVAÇÃO DE CONTEÚDO WEB ===
Data/Hora da Preservação: ${carimbo}
Agente/Perito Responsável: ${assinaturaPerito()}

1. IDENTIFICAÇÃO DO CONTEÚDO:
• URL/Endereço: ${url}
• Descrição: ${descricao || '[não informada]'}

2. EVIDÊNCIA DA CAPTURA:
• Arquivo de captura: ${nomeArquivo}
• Hash SHA-256 da captura: ${hash}

3. OBSERVAÇÃO METODOLÓGICA:
Este termo certifica que o conteúdo acima, disponível na URL informada, foi capturado e preservado na data/hora indicada, antes de eventual remoção, edição ou indisponibilização pelo autor ou pela plataforma. Recomenda-se complementar esta preservação com ofício à plataforma (Art. 15, Lei 12.965/2014) para confirmação da autenticidade e dos metadados de publicação original.

_______________________________________________
${assinaturaPerito()}`;

            document.getElementById('preservTermoTexto').innerText = texto;
        }

        function enviarPreservacaoParaOficio() {
            const url = document.getElementById('preservUrl').value.trim();
            if (!url) {
                showToast('Informe a URL antes de exportar.');
                return;
            }
            document.getElementById('oficioAlvo').value = `Conteúdo Web Preservado: ${url} (hash da captura: ${preservacaoHashGlobal || 'não calculado'})`;
            document.getElementById('oficioDestinatario').value = 'Plataforma hospedeira do conteúdo — Setor Legal/Compliance';
            atualizarMinutaOficio();
            switchTab('oficios');
            registrarLogAuditoria(`Termo de preservação web exportado para minuta de ofício: ${url}`);
            showToast('Preservação exportada para o ofício!');
        }

        function gerarAutoConstatacao() {
            const inquerito = document.getElementById('oficioInquerito').value || '[INQUÉRITO]';
            const alvo = document.getElementById('oficioAlvo').value || '[ALVO TÉCNICO]';
            const hash256 = document.getElementById('hashResult').innerText;
            const hash1 = document.getElementById('hashResultSha1').innerText;
            const nomeArquivo = arquivoHashGlobal ? arquivoHashGlobal.name : 'Nenhum arquivo físico carregado (Evidência textual)';
            const tamanhoArquivo = arquivoHashGlobal ? (arquivoHashGlobal.size / 1024).toFixed(2) + ' KB' : 'N/A';
            const tipoArquivo = arquivoHashGlobal ? (arquivoHashGlobal.type || 'Desconhecido') : 'N/A';

            const autoText = `=== AUTO DE CONSTATAÇÃO DE EVIDÊNCIA DIGITAL ===
Procedimento Originário: ${inquerito}
Data da Coleta/Análise: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
Agente/Perito Responsável: ${assinaturaPerito()}

CERTIFICO e DOU FÉ que, no âmbito das diligências de inteligência cibernética e perícia digital, procedeu-se à preservação e cálculo de integridade do seguinte elemento de prova, o qual deve ser manuseado exclusivamente em cópia, preservando-se o original nos termos do Art. 158-B do CPP:

1. IDENTIFICAÇÃO DO ARQUIVO / EVIDÊNCIA:
• Arquivo Original: ${nomeArquivo}
• Tamanho: ${tamanhoArquivo}
• Tipo MIME: ${tipoArquivo}
• Alvo/Contexto Técnico: ${alvo}

2. ASSINATURA DIGITAL DE INTEGRIDADE (HASHES REDUNDANTES):
• SHA-256: ${hash256}
• SHA-1: ${hash1}

3. GARANTIA DA CADEIA DE CUSTÓDIA (Art. 158-A e ss. do CPP):
As assinaturas criptográficas acima garantem a imutabilidade do arquivo preservado, permitindo futura auditoria e verificação de autenticidade judicial. Qualquer alteração, ainda que de um único bit, resultará em hashes completamente distintos dos aqui registrados.

_______________________________________________
${assinaturaPerito()}
AGENTE DE INTELIGÊNCIA / PERITO RESPONSÁVEL`;

            document.getElementById('outAutoConstatacao').innerText = autoText;
            registrarLogAuditoria(`Auto de Constatação gerado para "${nomeArquivo}" por ${assinaturaPerito()}.`);
            showToast('Auto de Constatação gerado com Hash duplo impresso!');
        }

        // ===================== EXIF (parser proprio, sem dependencia externa) =====================
        // Le os bytes de um arquivo JPEG e extrai as tags EXIF basicas (Make, Model,
        // DateTimeOriginal, Orientation e coordenadas GPS) diretamente do segmento APP1/TIFF.


        function analisarExif(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById('exifPreviewImg');
                img.src = e.target.result;
                document.getElementById('exifImagePreviewContainer').classList.remove('hidden');
                img.onload = () => {
                    document.getElementById('exifDimensions').innerText = `${img.naturalWidth} x ${img.naturalHeight} px`;
                };
            };
            reader.readAsDataURL(file);

            file.arrayBuffer().then(buffer => {
                let data = null;
                try {
                    data = parseExifFromArrayBuffer(buffer);
                } catch (err) {
                    data = null;
                }

                if (!data) {
                    document.getElementById('exifMakeModel').innerText = "Sem metadados EXIF nesta imagem";
                    document.getElementById('exifDateTime').innerText = "-";
                    document.getElementById('exifOrientation').innerText = "-";
                    document.getElementById('exifGpsCoords').innerText = "Sem dados GPS na imagem";
                    document.getElementById('exifGpsBtnContainer').classList.add('hidden');
                    registrarLogAuditoria(`Análise EXIF em "${file.name}": nenhum metadado EXIF encontrado (arquivo pode não ser JPEG original ou teve metadados removidos).`);
                    showToast('Imagem sem metadados EXIF legíveis.');
                    return;
                }

                document.getElementById('exifMakeModel').innerText = (data.make + " " + data.model).trim() || "Câmera não identificada / metadados removidos";
                document.getElementById('exifDateTime').innerText = data.dateTime || "Não disponível";
                document.getElementById('exifOrientation').innerText = data.orientation ? `Código ${data.orientation}` : "Não disponível";

                if (data.gps && Array.isArray(data.gps.lat) && Array.isArray(data.gps.lon)) {
                    const lat = data.gps.lat, lon = data.gps.lon;
                    const latDec = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (data.gps.latRef === "S" ? -1 : 1);
                    const lonDec = (lon[0] + lon[1] / 60 + lon[2] / 3600) * (data.gps.lonRef === "W" ? -1 : 1);
                    const coordsStr = `${latDec.toFixed(6)}, ${lonDec.toFixed(6)}`;

                    document.getElementById('exifGpsCoords').innerText = coordsStr;
                    document.getElementById('exifGpsMapLink').href = `https://www.google.com/maps?q=${latDec},${lonDec}`;
                    document.getElementById('exifGpsBtnContainer').classList.remove('hidden');
                    registrarLogAuditoria(`Análise EXIF em "${file.name}": GPS extraído (${coordsStr}).`);
                } else {
                    document.getElementById('exifGpsCoords').innerText = "Sem dados GPS na imagem";
                    document.getElementById('exifGpsBtnContainer').classList.add('hidden');
                    registrarLogAuditoria(`Análise EXIF em "${file.name}": sem coordenadas GPS nos metadados (ausência de EXIF não implica ausência de localização real — plataformas costumam removê-lo no upload).`);
                }
                showToast('EXIF processado!');
            });
        }

        // ===================== GOOGLE DORKS =====================
        function gerarDork() {
            const site = document.getElementById('dorkSite').value.trim();
            const termo = document.getElementById('dorkTermo').value.trim();
            const intext = document.getElementById('dorkIntext').value.trim();
            const intitle = document.getElementById('dorkIntitle').value.trim();
            const excluir = document.getElementById('dorkExcluir').value.trim();
            const filetype = document.getElementById('dorkFiletype').value;

            let parts = [];
            if (site) parts.push(`site:${site}`);
            if (termo) parts.push(`"${termo}"`);
            if (intext) parts.push(`intext:"${intext}"`);
            if (intitle) parts.push(`intitle:"${intitle}"`);
            if (filetype) parts.push(`filetype:${filetype}`);
            if (excluir) parts.push(`-${excluir}`);

            const query = parts.join(' ');
            document.getElementById('dorkOutputText').innerText = query || "Preencha os campos ao lado para gerar a Dork";
        }

        function aplicarPresetDork(tipo) {
            document.getElementById('dorkTermo').value = '';
            document.getElementById('dorkIntext').value = '';
            document.getElementById('dorkIntitle').value = '';
            document.getElementById('dorkFiletype').value = '';
            document.getElementById('dorkExcluir').value = '';

            if (tipo === 'painel') {
                document.getElementById('dorkIntitle').value = 'login OR admin OR painel';
            } else if (tipo === 'planilha') {
                document.getElementById('dorkFiletype').value = 'xlsx';
                document.getElementById('dorkIntext').value = 'senha OR cpf OR confidencial';
            } else if (tipo === 'diretorio') {
                document.getElementById('dorkIntitle').value = 'index of';
            }
            gerarDork();
            showToast('Preset de Dork aplicado!');
        }

        function executarDork() {
            const q = document.getElementById('dorkOutputText').innerText;
            if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
        }

        // ===================== COORDENADAS =====================
        function converterDmsParaDd() {
            const g = parseFloat(document.getElementById('dmsGraus').value) || 0;
            const m = parseFloat(document.getElementById('dmsMinutos').value) || 0;
            const s = parseFloat(document.getElementById('dmsSegundos').value) || 0;
            const dir = document.getElementById('dmsDirecao').value;

            let dd = g + (m / 60) + (s / 3600);
            if (dir === 'S' || dir === 'W') dd = -dd;

            document.getElementById('ddResultText').innerText = dd.toFixed(6);
        }

        function converterDdParaDms() {
            const dd = parseFloat(document.getElementById('ddInput').value);
            if (isNaN(dd)) {
                document.getElementById('dmsResultText').innerText = '-';
                return;
            }
            const abs = Math.abs(dd);
            const graus = Math.floor(abs);
            const minutosFloat = (abs - graus) * 60;
            const minutos = Math.floor(minutosFloat);
            const segundos = ((minutosFloat - minutos) * 60).toFixed(2);
            document.getElementById('dmsResultText').innerText = `${graus}° ${minutos}' ${segundos}" (${dd >= 0 ? 'N/E' : 'S/W'})`;
        }

        function abrirCoordNoMapa() {
            const dd = document.getElementById('ddResultText').innerText;
            if (dd && dd !== '0.000000') {
                window.open(`https://www.google.com/maps?q=${dd}`, '_blank');
            } else {
                showToast('Informe uma coordenada válida primeiro.');
            }
        }

        // ===================== UTM (Universal Transverse Mercator, WGS84) =====================
        // Formulas de Snyder (1987), validadas por round-trip (ida-e-volta) com erro sub-milimetrico.







        function converterDdParaUtm() {
            const lat = parseFloat(document.getElementById('utmLatInput').value);
            const lon = parseFloat(document.getElementById('utmLonInput').value);
            const resultEl = document.getElementById('utmResultText');

            if (isNaN(lat) || isNaN(lon) || lat < -80 || lat > 84) {
                resultEl.innerText = isNaN(lat) || isNaN(lon) ? '-' : 'Latitude fora do alcance do UTM padrão (-80° a 84°) — use DD/DMS normal para regiões polares.';
                return;
            }

            const r = ddParaUtm(lat, lon);
            resultEl.innerText = `Zona ${r.zone}${r.banda}  ${r.easting.toFixed(2)}mE  ${r.northing.toFixed(2)}mN  (${r.southern ? 'Hemisfério Sul' : 'Hemisfério Norte'})`;
        }

        function converterUtmParaDd() {
            const zona = parseInt(document.getElementById('utmZonaInput').value);
            const hemisferio = document.getElementById('utmHemisferioInput').value;
            const easting = parseFloat(document.getElementById('utmEastingInput').value);
            const northing = parseFloat(document.getElementById('utmNorthingInput').value);
            const resultEl = document.getElementById('utmParaDdResultText');

            if (isNaN(zona) || isNaN(easting) || isNaN(northing) || zona < 1 || zona > 60) {
                resultEl.innerText = '-';
                return;
            }

            const r = utmParaDd(zona, easting, northing, hemisferio === 'S');
            resultEl.innerText = `${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}`;
        }

        function abrirUtmNoMapa() {
            const dd = document.getElementById('utmParaDdResultText').innerText;
            if (dd && dd !== '-') {
                window.open(`https://www.google.com/maps?q=${dd}`, '_blank');
            } else {
                showToast('Converta um UTM válido primeiro.');
            }
        }

        // ===================== WHOIS DE DOMÍNIO =====================
        function validarFormatoDominio(dominio) {
            // Aceita letras/numeros/hifen em rotulos separados por ponto, com TLD de pelo menos 2 letras
            const regex = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/;
            return regex.test(dominio);
        }

        function atualizarWhoisDominio() {
            const dominio = document.getElementById('whoisDominioInput').value.trim().toLowerCase();
            const statusEl = document.getElementById('whoisDominioStatus');
            if (!dominio) {
                statusEl.innerText = 'Digite um domínio para habilitar as consultas.';
                return;
            }
            statusEl.innerText = validarFormatoDominio(dominio)
                ? `Pronto para consultar: ${dominio}`
                : 'Formato de domínio inválido (ex esperado: exemplo.com.br).';
        }

        function abrirWhoisEm(servico) {
            const dominio = document.getElementById('whoisDominioInput').value.trim().toLowerCase();
            if (!dominio || !validarFormatoDominio(dominio)) {
                showToast('Informe um domínio válido primeiro (ex: exemplo.com.br).');
                return;
            }
            const urls = {
                whois: `https://who.is/whois/${dominio}`,
                rdap: `https://rdap.org/domain/${dominio}`,
                crt: `https://crt.sh/?q=${dominio}`
            };
            window.open(urls[servico], '_blank');
            registrarLogAuditoria(`WHOIS consultado (${servico}) para o domínio: ${dominio}`);
        }

        // ===================== TELEFONE BR: DDD/ESTADO, OPERADORA, WHATSAPP =====================
        // Tabela de DDD -> Estado (Fonte: Anatel / Plano Geral de Codigos Nacionais - PGCN)
        const DDD_ESTADOS = {
            '11':'São Paulo (SP)','12':'São Paulo (SP)','13':'São Paulo (SP)','14':'São Paulo (SP)',
            '15':'São Paulo (SP)','16':'São Paulo (SP)','17':'São Paulo (SP)','18':'São Paulo (SP)','19':'São Paulo (SP)',
            '21':'Rio de Janeiro (RJ)','22':'Rio de Janeiro (RJ)','24':'Rio de Janeiro (RJ)',
            '27':'Espírito Santo (ES)','28':'Espírito Santo (ES)',
            '31':'Minas Gerais (MG)','32':'Minas Gerais (MG)','33':'Minas Gerais (MG)','34':'Minas Gerais (MG)',
            '35':'Minas Gerais (MG)','37':'Minas Gerais (MG)','38':'Minas Gerais (MG)',
            '41':'Paraná (PR)','42':'Paraná (PR)','43':'Paraná (PR)','44':'Paraná (PR)','45':'Paraná (PR)','46':'Paraná (PR)',
            '47':'Santa Catarina (SC)','48':'Santa Catarina (SC)','49':'Santa Catarina (SC)',
            '51':'Rio Grande do Sul (RS)','53':'Rio Grande do Sul (RS)','54':'Rio Grande do Sul (RS)','55':'Rio Grande do Sul (RS)',
            '61':'Distrito Federal (DF)',
            '62':'Goiás (GO)','64':'Goiás (GO)',
            '63':'Tocantins (TO)',
            '65':'Mato Grosso (MT)','66':'Mato Grosso (MT)',
            '67':'Mato Grosso do Sul (MS)',
            '68':'Acre (AC)',
            '69':'Rondônia (RO)',
            '71':'Bahia (BA)','73':'Bahia (BA)','74':'Bahia (BA)','75':'Bahia (BA)','77':'Bahia (BA)',
            '79':'Sergipe (SE)',
            '81':'Pernambuco (PE)','87':'Pernambuco (PE)',
            '82':'Alagoas (AL)',
            '83':'Paraíba (PB)',
            '84':'Rio Grande do Norte (RN)',
            '85':'Ceará (CE)','88':'Ceará (CE)',
            '86':'Piauí (PI)','89':'Piauí (PI)',
            '91':'Pará (PA)','93':'Pará (PA)','94':'Pará (PA)',
            '92':'Amazonas (AM)','97':'Amazonas (AM)',
            '96':'Amapá (AP)',
            '95':'Roraima (RR)',
            '98':'Maranhão (MA)','99':'Maranhão (MA)'
        };

        function atualizarTelefoneBr() {
            const digitos = document.getElementById('telBrInput').value.replace(/\D/g, '').slice(0, 11);
            document.getElementById('telBrInput').value = digitos;

            const badge = document.getElementById('telBrFormatoBadge');
            const estadoEl = document.getElementById('telBrEstadoText');
            const tipoEl = document.getElementById('telBrTipoText');

            if (digitos.length < 10) {
                badge.innerText = `INCOMPLETO (${digitos.length}/10-11)`;
                badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-warn';
                estadoEl.innerText = '-';
                tipoEl.innerText = '-';
                return;
            }

            const ddd = digitos.slice(0, 2);
            const numero = digitos.slice(2);
            const estado = DDD_ESTADOS[ddd];

            if (!estado) {
                badge.innerText = 'DDD INEXISTENTE';
                badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-err';
                estadoEl.innerText = 'DDD ' + ddd + ' não é atribuído pela Anatel — desconfie do número.';
                tipoEl.innerText = '-';
                return;
            }

            const valido = numero.length === 8 || numero.length === 9;
            badge.innerText = valido ? 'FORMATO VÁLIDO' : 'QUANTIDADE DE DÍGITOS INVÁLIDA';
            badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full ' + (valido ? 'badge-ok' : 'badge-err');
            estadoEl.innerText = `DDD ${ddd} — ${estado}`;
            tipoEl.innerText = numero.length === 9 ? 'Celular (9 dígitos)' : (numero.length === 8 ? 'Fixo ou celular antigo (8 dígitos)' : '-');
        }

        function abrirAbrTelecom() {
            const digitos = document.getElementById('telBrInput').value;
            if (digitos.length < 10) {
                showToast('Informe um número com DDD válido primeiro.');
                return;
            }
            window.open('https://consultanumero.abrtelecom.com.br', '_blank');
            showToast('Cole o número na página da ABR Telecom (captcha exige preenchimento manual).');
            registrarLogAuditoria(`Consulta de operadora (ABR Telecom) aberta para o número: ${digitos}`);
        }

        function abrirWhatsappCheck() {
            const digitos = document.getElementById('telBrInput').value;
            if (digitos.length < 10) {
                showToast('Informe um número com DDD válido primeiro.');
                return;
            }
            window.open(`https://wa.me/55${digitos}`, '_blank');
            registrarLogAuditoria(`Verificação de WhatsApp (click-to-chat) para o número: 55${digitos}`);
        }

        function enviarTelefoneParaOficio() {
            const digitos = document.getElementById('telBrInput').value;
            const estado = document.getElementById('telBrEstadoText').innerText;
            if (digitos.length < 10) {
                showToast('Informe um número com DDD válido primeiro.');
                return;
            }
            document.getElementById('oficioAlvo').value = `Linha Telefônica: ${digitos} (${estado})`;
            document.getElementById('oficioDestinatario').value = 'Operadoras de Telecomunicações (VIVO / CLARO / TIM) — Identificação de titularidade';
            atualizarMinutaOficio();
            switchTab('oficios');
            registrarLogAuditoria(`Telefone exportado para minuta de ofício (identificação de titularidade): ${digitos}`);
            showToast('Telefone exportado para o ofício!');
        }

        // ===================== IP / CGNAT (com validação real) =====================
        function isCGNAT(ip) {
            const parts = ip.split('.');
            if (parts.length !== 4) return false;
            const p1 = parseInt(parts[0], 10);
            const p2 = parseInt(parts[1], 10);
            return p1 === 100 && p2 >= 64 && p2 <= 127;
        }

        function isValidIPv4(ip) {
            const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
            const m = ip.match(regex);
            if (!m) return false;
            return m.slice(1).every(octeto => Number(octeto) >= 0 && Number(octeto) <= 255);
        }

        function isValidIPv6(ip) {
            // Validação simplificada, cobre a maioria dos formatos padrão e abreviados (::)
            const regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
            return ip.includes(':') && regex.test(ip);
        }

        function analisarIP() {
            const ip = document.getElementById('ipInput').value.trim();
            const porta = document.getElementById('portaInput').value.trim();
            const fuso = document.getElementById('fusoInput').value;
            const provedor = document.getElementById('provedorInput').value.trim();
            const fonte = document.getElementById('fonteInput').value;
            const badge = document.getElementById('ipValidBadge');
            const warningEl = document.getElementById('ipWarningText');

            const isV4 = isValidIPv4(ip);
            const isV6 = isValidIPv6(ip);

            warningEl.classList.add('hidden');
            warningEl.innerText = ''; // Reset on every analysis

            if (isV4) {
                badge.innerText = 'IP VÁLIDO (IPv4)';
                badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-ok';
            } else if (isV6) {
                badge.innerText = 'IP VÁLIDO (IPv6)';
                badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-ok';
            } else {
                badge.innerText = 'FORMATO INVÁLIDO';
                badge.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-err';
                warningEl.innerText = 'Atenção: o endereço informado não corresponde a um IPv4 ou IPv6 válido. Revise antes de usar no ofício.';
                warningEl.classList.remove('hidden');
            }

            const portaValida = porta && Number(porta) >= 1 && Number(porta) <= 65535;
            let warnings = [];

            if (porta && !portaValida) {
                warnings.push('Porta lógica fora do intervalo válido (1–65535).');
            }

            if (isV4 && isCGNAT(ip)) {
                warnings.push('Atenção: IP de CGNAT (Rede Móvel ou Compartilhada). A porta lógica de origem é obrigatória para identificação do usuário.');
            }

            if (warnings.length > 0) {
                warningEl.innerText = warnings.join(' ');
                warningEl.classList.remove('hidden');
            }

            document.getElementById('ipFormattedString').innerText =
                `IP: ${ip}${!isV6 && porta ? ' : Porta Lógica ' + porta : ''} (Horário ${fuso}) - Provedor: ${provedor} - Fonte: ${fonte}`;

            const linksContainer = document.getElementById('ipDynamicLinks');
            if (isV4 || isV6) {
                linksContainer.innerHTML = `
                    <a href="https://www.abuseipdb.com/check/${encodeURIComponent(ip)}" target="_blank" class="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold text-center transition-all">AbuseIPDB</a>
                    <a href="https://ipinfo.io/${encodeURIComponent(ip)}" target="_blank" class="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold text-center transition-all">IPinfo</a>
                `;
            } else {
                linksContainer.innerHTML = '';
            }
        }

        function enviarIpParaOficio() {
            document.getElementById('oficioAlvo').value = document.getElementById('ipFormattedString').innerText;
            document.getElementById('oficioDestinatario').value = document.getElementById('provedorInput').value + " - Setor Legal/Compliance";
            atualizarMinutaOficio();
            switchTab('oficios');
            registrarLogAuditoria(`IP exportado para minuta de ofício: ${document.getElementById('ipFormattedString').innerText}`);
            showToast('IP exportado para a minuta!');
        }

        // ===================== IMEI (Luhn real) =====================
        function calcularLuhn(numStr) {
            // Aplica o algoritmo de Luhn considerando os 15 dígitos do IMEI
            let soma = 0;
            let dobrar = false;
            for (let i = numStr.length - 1; i >= 0; i--) {
                let digito = parseInt(numStr[i], 10);
                if (dobrar) {
                    digito *= 2;
                    if (digito > 9) digito -= 9;
                }
                soma += digito;
                dobrar = !dobrar;
            }
            return soma % 10 === 0;
        }

        function validarIMEI() {
            let imei = document.getElementById('imeiInput').value.replace(/\D/g, '').slice(0, 15);
            document.getElementById('imeiInput').value = imei;

            const statusEl = document.getElementById('imeiStatusText');
            const tacEl = document.getElementById('imeiTacText');
            const snrEl = document.getElementById('imeiSnrText');
            const cdEl = document.getElementById('imeiCdText');

            if (imei.length < 15) {
                statusEl.innerText = `INCOMPLETO (${imei.length}/15)`;
                statusEl.className = 'text-[10px] font-bold px-2 py-1 rounded-full badge-warn';
                tacEl.innerText = imei.substring(0, 8) || '-';
                snrEl.innerText = imei.length > 8 ? imei.substring(8) : '-';
                cdEl.innerText = '-';
                return;
            }

            const valido = calcularLuhn(imei);
            statusEl.innerText = valido ? 'IMEI VÁLIDO (Luhn OK)' : 'IMEI INVÁLIDO (Falha no dígito verificador)';
            statusEl.className = 'text-[10px] font-bold px-2 py-1 rounded-full ' + (valido ? 'badge-ok' : 'badge-err');

            tacEl.innerText = imei.substring(0, 8);
            snrEl.innerText = imei.substring(8, 14);
            cdEl.innerText = imei.substring(14, 15);

            const linksContainer = document.getElementById('imeiDynamicLink');
            if (valido) {
                linksContainer.innerHTML = `
                    <a href="https://www.imei.info/" target="_blank" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all">
                        <span class="icon w-3.5 h-3.5">↗️</span><span>Consultar Modelo (imei.info)</span>
                    </a>
                `;
            } else {
                linksContainer.innerHTML = '';
            }
        }

        function enviarImeiParaOficio() {
            document.getElementById('oficioAlvo').value = "Aparelho Celular - IMEI: " + document.getElementById('imeiInput').value;
            document.getElementById('oficioDestinatario').value = "Operadoras de Telecomunicações (VIVO / CLARO / TIM)";
            atualizarMinutaOficio();
            switchTab('oficios');
            registrarLogAuditoria(`IMEI exportado para minuta de ofício: ${document.getElementById('imeiInput').value}`);
            showToast('IMEI exportado!');
        }

        // ===================== PIX (classificação real) =====================
        function validarCPF(cpf) {
            cpf = cpf.replace(/\D/g, '');
            if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
            let soma = 0;
            for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
            let resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            if (resto !== parseInt(cpf[9])) return false;
            soma = 0;
            for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
            resto = (soma * 10) % 11;
            if (resto === 10 || resto === 11) resto = 0;
            return resto === parseInt(cpf[10]);
        }

        function validarCNPJ(cnpj) {
            cnpj = cnpj.replace(/\D/g, '');
            if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
            let tamanho = cnpj.length - 2;
            let numeros = cnpj.substring(0, tamanho);
            const digitos = cnpj.substring(tamanho);
            let soma = 0;
            let pos = tamanho - 7;
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
            if (resultado != digitos.charAt(0)) return false;
            tamanho++;
            numeros = cnpj.substring(0, tamanho);
            soma = 0;
            pos = tamanho - 7;
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
            return resultado == digitos.charAt(1);
        }

        // Testa se uma sequencia de 10 ou 11 digitos "parece" um telefone BR (sem DDI):
        // DDD precisa ser um codigo realmente atribuido pela Anatel, e celular (11 digitos)
        // precisa ter o "9" na 3a posicao (padrao obrigatorio desde a unificacao do 9o digito).
        function pareceTelefoneBr(digitos) {
            if (digitos.length !== 10 && digitos.length !== 11) return false;
            const ddd = digitos.slice(0, 2);
            if (!DDD_ESTADOS[ddd]) return false;
            if (digitos.length === 11) return digitos.charAt(2) === '9';
            return true; // 10 digitos: fixo, sem exigencia do 9
        }

        function parsePixEMVCo(payload) {
            let offset = 0;
            const result = {};
            while (offset < payload.length) {
                if (offset + 4 > payload.length) break;
                const tag = payload.substring(offset, offset + 2);
                const lengthStr = payload.substring(offset + 2, offset + 4);
                const length = parseInt(lengthStr, 10);
                if (isNaN(length)) break;
                offset += 4;
                if (offset + length > payload.length) break;
                const value = payload.substring(offset, offset + length);
                result[tag] = value;
                offset += length;
            }
            return result;
        }

        function analisarPix() {
            const val = document.getElementById('pixInput').value.trim();
            const tipoEl = document.getElementById('pixTipoTexto');
            const cleanEl = document.getElementById('pixCleanTexto');
            const validEl = document.getElementById('pixValidText');

            const soDigitos = val.replace(/\D/g, '');
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            let tipo = 'INDEFINIDO';
            let badgeClass = 'badge-warn';
            let clean = val;
            let validText = 'Não foi possível classificar automaticamente.';

            if (val.length > 50) {
                tipo = 'COPIA E COLA (EMVCo)';
                badgeClass = 'badge-ok';
                clean = val.length > 30 ? val.substring(0, 30) + '...' : val;

                let resultData = {};
                let i = 0;
                try {
                    while (i < val.length) {
                        let id = val.substring(i, i + 2);
                        let len = parseInt(val.substring(i + 2, i + 4), 10);
                        if (isNaN(len) || len <= 0) break; // Trava de segurança anti-loop infinito
                        let tagVal = val.substring(i + 4, i + 4 + len);
                        resultData[id] = tagVal;
                        i += 4 + len;
                    }
                } catch (e) {
                    console.error('Erro na depuração do parser PIX:', e);
                }

                const container = document.createElement('div');
                container.appendChild(document.createTextNode('Código EMVCo detectado e parseado.'));
                container.appendChild(document.createElement('br'));

                const recStrong = document.createElement('strong');
                recStrong.className = 'text-slate-400';
                recStrong.textContent = 'Recebedor (Tag 59): ';
                container.appendChild(recStrong);

                const nomeRecebedor = resultData['59'] || 'Não identificado (Tag 59 ausente)';
                const recSpan = document.createElement('span');
                recSpan.className = 'text-white';
                recSpan.textContent = nomeRecebedor;
                container.appendChild(recSpan);

                container.appendChild(document.createElement('br'));

                const cityStrong = document.createElement('strong');
                cityStrong.className = 'text-slate-400';
                cityStrong.textContent = 'Cidade (Tag 60): ';
                container.appendChild(cityStrong);

                const nomeCidade = resultData['60'] || 'Não identificada (Tag 60 ausente)';
                const citySpan = document.createElement('span');
                citySpan.className = 'text-white';
                citySpan.textContent = nomeCidade;
                container.appendChild(citySpan);

                container.appendChild(document.createElement('br'));
                container.appendChild(document.createElement('br'));

                const copyBtn = document.createElement('button');
                copyBtn.className = 'w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-2 transition-all mt-2';
                copyBtn.onclick = function() {
                    copiarDirect('[OSINT] PIX Recebedor: ' + nomeRecebedor + ' | Cidade: ' + nomeCidade);
                };

                const iconSpan = document.createElement('span');
                iconSpan.className = 'icon w-4 h-4';
                iconSpan.textContent = '📋';
                copyBtn.appendChild(iconSpan);

                const textSpan = document.createElement('span');
                textSpan.textContent = 'Copiar Resumo OSINT';
                copyBtn.appendChild(textSpan);

                container.appendChild(copyBtn);

                validText = container;
            } else if (uuidRegex.test(val)) {
                tipo = 'CHAVE ALEATÓRIA (UUID)';
                badgeClass = 'badge-ok';
                clean = val.toLowerCase();
                validText = 'Formato UUID v4 padrão do Bacen.';
            } else if (emailRegex.test(val)) {
                tipo = 'E-MAIL';
                badgeClass = 'badge-ok';
                clean = val.toLowerCase();
                validText = 'Formato de e-mail válido.';
            } else if (soDigitos.length === 14) {
                tipo = 'CNPJ';
                clean = soDigitos;
                const ok = validarCNPJ(soDigitos);
                badgeClass = ok ? 'badge-ok' : 'badge-err';
                validText = ok ? 'Dígitos verificadores OK.' : 'Dígitos verificadores INVÁLIDOS — confira a chave.';
            } else if (soDigitos.length >= 12 && soDigitos.length <= 13 && (val.includes('+') || soDigitos.startsWith('55'))) {
                tipo = 'TELEFONE CELULAR';
                badgeClass = 'badge-ok';
                clean = '+' + soDigitos.replace(/^\+?/, '');
                validText = 'Formato de telefone com DDI reconhecido.';
            } else if (soDigitos.length === 11 && pareceTelefoneBr(soDigitos)) {
                // 11 digitos com "cara" de celular (DDD valido + 9 na 3a posicao) tem prioridade
                // sobre CPF, que tambem possui 11 digitos mas nunca segue esse padrao posicional.
                const ddd = soDigitos.slice(0, 2);
                tipo = 'TELEFONE CELULAR (sem DDI)';
                badgeClass = 'badge-ok';
                clean = soDigitos;
                validText = `DDD ${ddd} (${DDD_ESTADOS[ddd]}) reconhecido. Considere confirmar o DDI (+55) antes de enviar ao Bacen.`;
            } else if (soDigitos.length === 11) {
                tipo = 'CPF';
                clean = soDigitos;
                const ok = validarCPF(soDigitos);
                badgeClass = ok ? 'badge-ok' : 'badge-err';
                validText = ok ? 'Dígitos verificadores OK.' : 'Dígitos verificadores INVÁLIDOS — confira a chave.';
            } else if (soDigitos.length === 10 && pareceTelefoneBr(soDigitos)) {
                const ddd = soDigitos.slice(0, 2);
                tipo = 'TELEFONE FIXO (sem DDI)';
                badgeClass = 'badge-ok';
                clean = soDigitos;
                validText = `DDD ${ddd} (${DDD_ESTADOS[ddd]}) reconhecido. Considere confirmar o DDI (+55) antes de enviar ao Bacen.`;
            } else if (soDigitos.length === 10) {
                tipo = 'TELEFONE (sem DDI)';
                badgeClass = 'badge-warn';
                clean = soDigitos;
                validText = 'DDD não reconhecido pela Anatel — confira o número. Considere confirmar o DDI (+55) antes de enviar ao Bacen.';
            }

            tipoEl.innerText = tipo;
            tipoEl.className = 'text-[10px] font-bold px-2 py-1 rounded-full ' + badgeClass;
            cleanEl.innerText = clean || val;

            if (typeof validText === 'string') {
                validEl.innerText = validText;
            } else {
                validEl.innerHTML = '';
                validEl.appendChild(validText);
            }
        }

        function enviarPixParaOficio() {
            const tipo = document.getElementById('pixTipoTexto').innerText;
            document.getElementById('oficioAlvo').value = `Chave PIX (${tipo}): ` + document.getElementById('pixCleanTexto').innerText;
            document.getElementById('oficioDestinatario').value = "Banco Central do Brasil / Instituição Financeira";
            atualizarMinutaOficio();
            switchTab('oficios');
            registrarLogAuditoria(`Chave PIX exportada para minuta de ofício (${tipo}): ${document.getElementById('pixCleanTexto').innerText}`);
            showToast('PIX exportado!');
        }

        // ===================== TEMPO / UTC =====================
        function converterFuso() {
            const localVal = document.getElementById('timeLocalInput').value;
            if (!localVal) return;
            const dt = new Date(localVal);

            if (isNaN(dt.getTime())) {
                document.getElementById('timeUtcResult').innerText = 'Data/hora inválida';
                document.getElementById('timeUnixResult').innerText = '-';
                return;
            }

            // Formata a data/hora em UTC no padrão brasileiro (dia da semana, data e hora por extenso em português)
            const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            const diaSemana = diasSemana[dt.getUTCDay()];
            const dia = String(dt.getUTCDate()).padStart(2, '0');
            const mes = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const ano = dt.getUTCFullYear();
            const hora = String(dt.getUTCHours()).padStart(2, '0');
            const minuto = String(dt.getUTCMinutes()).padStart(2, '0');
            const segundo = String(dt.getUTCSeconds()).padStart(2, '0');

            const utcFormatado = `${diaSemana}, ${dia}/${mes}/${ano} às ${hora}:${minuto}:${segundo} (UTC)`;

            document.getElementById('timeUtcResult').innerText = utcFormatado;
            document.getElementById('timeUnixResult').innerText = Math.floor(dt.getTime() / 1000);
        }

        // ===================== OFÍCIO =====================
        function atualizarMinutaOficio() {
            const inquerito = document.getElementById('oficioInquerito').value || '[PROCEDIMENTO]';
            const autoridade = document.getElementById('oficioAutoridade').value || '[AUTORIDADE REQUISITANTE]';
            const destinatario = document.getElementById('oficioDestinatario').value || '[DESTINATÁRIO]';
            const alvo = document.getElementById('oficioAlvo').value || '[ALVO]';
            const fundamentacao = document.getElementById('oficioFundamentacao').value;
            const prazo = document.getElementById('oficioPrazo').value;

            document.getElementById('oficioPreviewText').innerText = `REQUISIÇÃO CAUTELAR DE DADOS DIGITAIS

Autoridade Requisitante: ${autoridade}
Ao(À) Responsável pelo Setor Legal/Compliance: ${destinatario}
Referência: ${inquerito}

Com fulcro no(a) ${fundamentacao}, REQUER-SE o fornecimento dos registros abaixo:

1. ALVO TÉCNICO:
${alvo}

2. ESPECIFICAÇÃO:
Registros de conexão/acesso (IP, porta lógica de origem, horário UTC) e dados cadastrais vinculados.

3. PRAZO: ${prazo}.

Data: ${new Date().toLocaleDateString('pt-BR')}.`;
        }

        function baixarOficioTxt() {
            const text = document.getElementById('oficioPreviewText').innerText;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Minuta_Oficio_OSINT.txt';
            link.click();
            registrarLogAuditoria('Minuta de ofício baixada (Minuta_Oficio_OSINT.txt).');
            showToast('Ofício baixado!');
        }

        function limparDadosFormulario() {
            if (confirm("Resetar o aplicativo?")) location.reload();
        }

        // ===================== SESSÃO: EXPORTAR / IMPORTAR (continuidade entre plantões) =====================
        const SESSAO_CAMPOS_IDS = [
            'peritoNome', 'peritoMatricula', 'peritoOrgao',
            'ipInput', 'portaInput', 'fusoInput', 'provedorInput', 'fonteInput',
            'imeiInput', 'pixInput',
            'preservUrl', 'preservDescricao',
            'dorkSite', 'dorkTermo', 'dorkIntext', 'dorkIntitle', 'dorkExcluir', 'dorkFiletype',
            'dmsGraus', 'dmsMinutos', 'dmsSegundos', 'dmsDirecao', 'ddInput',
            'oficioInquerito', 'oficioAutoridade', 'oficioDestinatario', 'oficioAlvo', 'oficioFundamentacao', 'oficioPrazo'
        ];

        function exportarSessao() {
            const campos = {};
            SESSAO_CAMPOS_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) campos[id] = el.value;
            });

            const referenciasArquivos = {
                hashResult: document.getElementById('hashResult') ? document.getElementById('hashResult').innerText : '',
                hashResultSha1: document.getElementById('hashResultSha1') ? document.getElementById('hashResultSha1').innerText : '',
                fileNameDisplay: document.getElementById('fileNameDisplay') ? document.getElementById('fileNameDisplay').innerText : '',
                preservHashDisplay: document.getElementById('preservHashDisplay') ? document.getElementById('preservHashDisplay').innerText : '',
                preservFileNameDisplay: document.getElementById('preservFileNameDisplay') ? document.getElementById('preservFileNameDisplay').innerText : ''
            };

            const sessao = {
                versaoApp: '4.1',
                exportadoEm: new Date().toISOString(),
                peritoInfo: peritoInfo,
                campos: campos,
                referenciasArquivos: referenciasArquivos,
                logAuditoria: logAuditoria
            };

            const blob = new Blob([JSON.stringify(sessao, null, 2)], { type: 'application/json;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const carimbo = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            link.download = `Sessao_OSINT_${carimbo}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            registrarLogAuditoria('Sessão de trabalho exportada para arquivo JSON.');
            showToast('Sessão exportada! Guarde o arquivo para continuar depois.');
        }

        function importarSessao(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                let sessao;
                try {
                    sessao = JSON.parse(e.target.result);
                } catch (err) {
                    showToast('Arquivo de sessão inválido (JSON malformado).');
                    return;
                }

                if (sessao.campos) {
                    Object.keys(sessao.campos).forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = sessao.campos[id];
                    });
                }

                if (sessao.peritoInfo) {
                    if (document.getElementById('peritoNome')) document.getElementById('peritoNome').value = sessao.peritoInfo.nome || '';
                    if (document.getElementById('peritoMatricula')) document.getElementById('peritoMatricula').value = sessao.peritoInfo.matricula || '';
                    if (document.getElementById('peritoOrgao')) document.getElementById('peritoOrgao').value = sessao.peritoInfo.orgao || '';
                }

                if (Array.isArray(sessao.logAuditoria)) {
                    logAuditoria = sessao.logAuditoria.slice();
                    const container = document.getElementById('logAuditoriaLista');
                    if (container) {
                        container.innerHTML = '';
                        if (logAuditoria.length === 0) {
                            container.innerHTML = '<span id="logAuditoriaVazio" class="text-slate-600">Nenhuma ação registrada ainda.</span>';
                        } else {
                            logAuditoria.forEach(l => {
                                const linha = document.createElement('div');
                                linha.className = 'log-entry';
                                linha.innerText = `[${l.carimbo}] ${l.descricao}`;
                                container.appendChild(linha);
                            });
                        }
                    }
                }

                // Recalcula todos os campos derivados com os valores importados
                atualizarIdentificacaoPerito();
                analisarIP();
                validarIMEI();
                analisarPix();
                gerarDork();
                converterDmsParaDd();
                atualizarMinutaOficio();
                atualizarTermoPreservacao();

                registrarLogAuditoria(`Sessão importada de arquivo (exportada originalmente em ${sessao.exportadoEm || 'data desconhecida'}).`);
                showToast('Sessão importada com sucesso!');
            };
            reader.readAsText(file);
        }


        window.onload = function () {

            analisarIP();
            validarIMEI();
            analisarPix();
            gerarDork();
            atualizarMinutaOficio();
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('timeLocalInput').value = now.toISOString().slice(0, 16);
            converterFuso();
        };


// Attach functions to window object for inline HTML handlers
window.enviarTelefoneParaOficio = enviarTelefoneParaOficio;
window.atualizarTermoPreservacao = atualizarTermoPreservacao;
window.baixarComoPDF = baixarComoPDF;
window.aplicarPresetDork = aplicarPresetDork;
window.analisarExif = analisarExif;
window.converterDmsParaDd = converterDmsParaDd;
window.gerarAutoConstatacao = gerarAutoConstatacao;
window.converterDdParaDms = converterDdParaDms;
window.validarCNPJ = validarCNPJ;
window.atualizarWhoisDominio = atualizarWhoisDominio;
window.executarDork = executarDork;
window.analisarPix = analisarPix;
window.converterFuso = converterFuso;
window.copiarDirect = copiarDirect;
window.verificarIntegridadeHash = verificarIntegridadeHash;
window.abrirUtmNoMapa = abrirUtmNoMapa;
window.assinaturaPerito = assinaturaPerito;
window.copiarTexto = copiarTexto;
window.abrirAbrTelecom = abrirAbrTelecom;
window.enviarImeiParaOficio = enviarImeiParaOficio;
window.processarPreservacaoArquivo = processarPreservacaoArquivo;
window.processarHashArquivo = processarHashArquivo;
window.isValidIPv4 = isValidIPv4;
window.converterDdParaUtm = converterDdParaUtm;
window.isValidIPv6 = isValidIPv6;
window.switchTab = switchTab;
window.baixarOficioTxt = baixarOficioTxt;
window.limparDadosFormulario = limparDadosFormulario;
window.abrirWhatsappCheck = abrirWhatsappCheck;
window.baixarLogAuditoria = baixarLogAuditoria;
window.calcularLuhn = calcularLuhn;
window.validarIMEI = validarIMEI;
window.validarFormatoDominio = validarFormatoDominio;
window.converterUtmParaDd = converterUtmParaDd;
window.exportarSessao = exportarSessao;
window.importarSessao = importarSessao;
window.abrirCoordNoMapa = abrirCoordNoMapa;
window.enviarIpParaOficio = enviarIpParaOficio;
window.validarCPF = validarCPF;
window.analisarIP = analisarIP;
window.abrirWhoisEm = abrirWhoisEm;
window.atualizarTelefoneBr = atualizarTelefoneBr;
window.showToast = showToast;
window.gerarDork = gerarDork;
window.atualizarMinutaOficio = atualizarMinutaOficio;
window.enviarPixParaOficio = enviarPixParaOficio;
window.registrarLogAuditoria = registrarLogAuditoria;
window.filtrarConteudoGlobal = filtrarConteudoGlobal;
window.enviarPreservacaoParaOficio = enviarPreservacaoParaOficio;
window.baixarArquivo = baixarArquivo;
window.atualizarIdentificacaoPerito = atualizarIdentificacaoPerito;

// --- NOVO MODULO: Extrator Automático & Correlacionador ---

// Lógica de Upload de Arquivos
async function processarArquivoExtrator(event) {
    const file = event.target.files[0];
    if (!file) return;

    const textarea = document.getElementById('extratorInput');
    const nomeOriginal = file.name;

    showToast('Lendo arquivo...');

    if (nomeOriginal.endsWith('.pdf')) {
        try {
            const arrayBuffer = await file.arrayBuffer();

            // Usar pdf.js para ler
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageStrings = textContent.items.map(item => item.str);
                fullText += pageStrings.join(' ') + '\n';
            }

            textarea.value = fullText;
            showToast('PDF extraído com sucesso!');
        } catch (error) {
            console.error('Erro ao ler PDF:', error);
            alert('Erro ao ler PDF. O arquivo pode estar corrompido ou protegido por senha.');
        }
    } else {
        // TXT ou CSV
        const reader = new FileReader();
        reader.onload = function(e) {
            textarea.value = e.target.result;
            showToast('Arquivo carregado com sucesso!');
        };
        reader.readAsText(file);
    }

    // Reseta o input de arquivo
    event.target.value = '';
}

// Lógica de Extração e Deduplicação
const extratorRegexes = {
    'IPv4 / IPv6': /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}/g,
    'E-mails': /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    'Telefones BR': /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g,
    'CPFs': /(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\b\d{11}\b)/g,
    'CNPJs': /(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{14}\b)/g,
    'Hashes (MD5/SHA1/SHA256)': /\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b/g,
    'Usernames / Handles': /(?<=^|\s)@[a-zA-Z0-9_.-]+/g
};

let entidadesExtratorGlobais = {};

function analisarDadosExtrator() {
    const rawText = document.getElementById('extratorInput').value;
    if (!rawText.trim()) {
        alert('Por favor, insira ou carregue algum texto antes de analisar.');
        return;
    }

    entidadesExtratorGlobais = {}; // Reset

    Object.entries(extratorRegexes).forEach(([categoria, regex]) => {
        const matches = rawText.match(regex) || [];
        // Deduplicação
        entidadesExtratorGlobais[categoria] = [...new Set(matches)];
    });

    renderizarCardsExtrator();
    document.getElementById('extratorResultados').classList.remove('hidden');
    showToast('Dados analisados com sucesso!');
}

function renderizarCardsExtrator() {
    const cardsContainer = document.getElementById('extratorCards');
    cardsContainer.innerHTML = '';

    Object.entries(entidadesExtratorGlobais).forEach(([categoria, entidades]) => {
        if (entidades.length === 0) return;

        const card = document.createElement('div');
        card.className = 'bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3';

        let botoesHtml = entidades.map(ent => `
            <button onclick="mostrarContextoCorrelacao('${ent.replace(/'/g, "\\'")}')" class="w-full text-left px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-300 break-all transition-colors">
                ${ent}
            </button>
        `).join('');

        card.innerHTML = `
            <div>
                <h4 class="text-xs font-bold text-slate-400 mb-1 flex justify-between">
                    <span>${categoria}</span>
                    <span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">${entidades.length}</span>
                </h4>
                <div class="space-y-1 max-h-40 overflow-y-auto pr-1">
                    ${botoesHtml}
                </div>
            </div>
            <button onclick="sanitizarECopiarExtrator('${categoria}')" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-2 mt-2">
                <span class="icon w-3 h-3">✂️</span> Sanitizar & Copiar
            </button>
        `;
        cardsContainer.appendChild(card);
    });

    if (cardsContainer.innerHTML === '') {
        cardsContainer.innerHTML = '<p class="text-sm text-slate-500 col-span-full text-center py-4">Nenhuma entidade identificada no texto.</p>';
    }
}

// Lógica de Sanitização e Contexto
function sanitizarECopiarExtrator(categoria) {
    const entidades = entidadesExtratorGlobais[categoria];
    if (!entidades || entidades.length === 0) return;

    const textoSanitizado = entidades.map(ent => {
        return ent.replace(/\./g, '[.]').replace(/@/g, '[@]');
    }).join('\n');

    navigator.clipboard.writeText(textoSanitizado).then(() => {
        showToast(`${categoria} copiados com sanitização!`);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Falha ao copiar para a área de transferência.');
    });
}

function mostrarContextoCorrelacao(entidade) {
    const rawText = document.getElementById('extratorInput').value;
    const linhas = rawText.split('\n');

    // Filtrar linhas que contêm a entidade
    const linhasComContexto = linhas.filter(linha => linha.includes(entidade));

    const contextoPanel = document.getElementById('extratorContexto');
    const contextoTexto = document.getElementById('extratorContextoTexto');
    const contextoLabel = document.getElementById('extratorContextoLabel');

    contextoLabel.innerText = `Filtro: ${entidade}`;

    if (linhasComContexto.length > 0) {
        contextoTexto.innerText = linhasComContexto.join('\n\n');
    } else {
        contextoTexto.innerText = 'Nenhum contexto encontrado (linha exata).';
    }

    contextoPanel.classList.remove('hidden');
    // Scroll suave para o painel de contexto
    contextoPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limparDadosExtrator() {
    document.getElementById('extratorInput').value = '';
    document.getElementById('extratorResultados').classList.add('hidden');
    document.getElementById('extratorContexto').classList.add('hidden');
    document.getElementById('extratorCards').innerHTML = '';
    entidadesExtratorGlobais = {};
    showToast('Dados limpos.');
}

// ---------------------------------------------------
// MULTI-PESQUISA DE IDENTIDADES (ONE-CLICK OSINT)
// ---------------------------------------------------

const osintDictionary = {
    nome: [
        { name: "Jusbrasil", url: "https://www.jusbrasil.com.br/busca?q={q}", icon: "⚖️" },
        { name: "Escavador", url: "https://www.escavador.com/busca?q={q}", icon: "📄" },
        { name: "Transparência", url: "https://portaldatransparencia.gov.br/busca?termo={q}", icon: "🏛️" },
        { name: "Google Exato", url: 'https://www.google.com/search?q="{q}"', icon: "🔍" },
        { name: "CNA / OAB (Dork)", url: 'https://www.google.com/search?q=site:cna.oab.org.br+"{q}"', icon: "👨‍⚖️" }
    ],
    username: [
        { name: "WhatsMyName", url: "https://whatsmyname.app/?q={q}", icon: "🕵️" },
        { name: "Namechk", url: "https://namechk.com/?q={q}", icon: "✅" },
        { name: "Instagram", url: "https://www.instagram.com/{q}/", icon: "📸" },
        { name: "X/Twitter", url: "https://twitter.com/{q}", icon: "🐦" },
        { name: "TikTok", url: "https://www.tiktok.com/@{q}", icon: "🎵" }
    ],
    email: [
        { name: "HaveIBeenPwned", url: "https://haveibeenpwned.com/account/{q}", icon: "🛡️" },
        { name: "Epieos", url: "https://epieos.com/?q={q}", icon: "📧" },
        { name: "Google Leak Search", url: 'https://www.google.com/search?q="{q}"+intext:password', icon: "🔑" }
    ]
};

let currentMultipesquisaCategory = 'nome';

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('multipesquisa-input');
    const filterButtons = document.querySelectorAll('#multipesquisa-filters .filter-btn');

    if (inputField && filterButtons.length > 0) {
        inputField.addEventListener('input', renderMultipesquisaResults);

        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active button styling
                filterButtons.forEach(b => {
                    b.classList.remove('bg-[#2563eb]', 'text-white');
                    b.classList.add('bg-slate-800', 'text-slate-300');
                });
                e.target.classList.remove('bg-slate-800', 'text-slate-300');
                e.target.classList.add('bg-[#2563eb]', 'text-white');

                currentMultipesquisaCategory = e.target.getAttribute('data-category');
                renderMultipesquisaResults();
            });
        });
    }
});

function renderMultipesquisaResults() {
    const inputField = document.getElementById('multipesquisa-input');
    const resultsArea = document.getElementById('multipesquisa-results');
    const target = inputField.value.trim();

    if (!target) {
        resultsArea.innerHTML = `
            <div class="col-span-full text-center py-8 text-slate-500 text-sm italic" id="multipesquisa-empty">
                Digite um alvo e selecione a categoria para carregar as ferramentas OSINT
            </div>
        `;
        return;
    }

    resultsArea.innerHTML = ''; // Clear previous results

    // Some targets need special encoding depending on context, but encodeURIComponent is safe for general use
    const encodedTarget = encodeURIComponent(target);

    const tools = osintDictionary[currentMultipesquisaCategory] || [];

    tools.forEach(tool => {
        let finalUrl = tool.url.replace(/{q}/g, encodedTarget);

        // For Google Exato and CNA/OAB where quotes are already in the URL template,
        // we might not want to URL encode the quotes themselves if they are part of the template.
        // The template has '{q}' so if we encode '{q}' as encodedTarget, the quotes stay intact.
        // Example: https://www.google.com/search?q="{q}" -> https://www.google.com/search?q="John%20Doe"
        // This is perfectly valid for modern browsers.

        const a = document.createElement('a');
        a.href = finalUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 transition-colors shadow-sm group';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon w-5 h-5 text-xl group-hover:scale-110 transition-transform';
        iconSpan.textContent = tool.icon;

        const textSpan = document.createElement('span');
        textSpan.className = 'text-sm font-medium text-slate-100';
        textSpan.textContent = tool.name;

        a.appendChild(iconSpan);
        a.appendChild(textSpan);

        resultsArea.appendChild(a);
    });
}
