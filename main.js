import { calcularHashBuffer } from './modules/hash.js';
import { parseExifFromArrayBuffer } from './modules/exif.js';
import { bandaMgrs, ddParaUtm, utmParaDd } from './modules/utm.js';


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
            if (porta && !portaValida) {
                warningEl.innerText = (warningEl.innerText ? warningEl.innerText + ' ' : '') + 'Porta lógica fora do intervalo válido (1–65535).';
                warningEl.classList.remove('hidden');
            }

            document.getElementById('ipFormattedString').innerText =
                `IP: ${ip}${!isV6 && porta ? ' : Porta Lógica ' + porta : ''} (Horário ${fuso}) - Provedor: ${provedor} - Fonte: ${fonte}`;
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

            if (uuidRegex.test(val)) {
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
            validEl.innerText = validText;
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
