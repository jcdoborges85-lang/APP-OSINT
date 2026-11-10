const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const biometriaHtml = `
        <button onclick="switchTab('biometria')" id="btn-biometria" class="tab-btn nav-btn bg-slate-800 text-slate-300 transition-all flex items-center gap-3 rounded-xl" style="animation-delay:0.46s">
            <span class="icon w-4 h-4 text-purple-500"><i class="fa-solid fa-face-viewfinder"></i></span><span>Biometria Facial</span>
            <span class="nav-chevron">›</span>
        </button>
        <div id="tab-biometria" class="tab-content accordion-panel space-y-6 hidden">
            <div class="glass-panel rounded-2xl p-6 shadow-xl space-y-6">
                <!-- Cabeçalho -->
                <div class="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <div class="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                        <i class="fa-solid fa-face-viewfinder text-xl"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-100">Perícia Biométrica (Comparação Facial 1:1)</h2>
                        <p class="text-xs text-slate-400">Análise de similaridade em porcentagem (100% offline)</p>
                    </div>
                </div>

                <!-- Área de Upload -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Imagem 1: Referência -->
                    <div class="space-y-2">
                        <label class="block text-xs font-medium text-slate-300">Imagem 1: Referência</label>
                        <div class="border-2 border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group h-40">
                            <i class="fa-regular fa-image text-3xl text-slate-500 group-hover:text-purple-400 transition-colors mb-3"></i>
                            <span class="text-sm text-slate-300">Arraste a imagem ou clique</span>
                            <span class="text-[10px] text-slate-500 mt-1">PNG, JPG ou WEBP (Max. 5MB)</span>
                        </div>
                    </div>

                    <!-- Imagem 2: Questionada -->
                    <div class="space-y-2">
                        <label class="block text-xs font-medium text-slate-300">Imagem 2: Questionada</label>
                        <div class="border-2 border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group h-40">
                            <i class="fa-regular fa-image text-3xl text-slate-500 group-hover:text-purple-400 transition-colors mb-3"></i>
                            <span class="text-sm text-slate-300">Arraste a imagem ou clique</span>
                            <span class="text-[10px] text-slate-500 mt-1">PNG, JPG ou WEBP (Max. 5MB)</span>
                        </div>
                    </div>
                </div>

                <!-- Botão de Ação -->
                <div class="flex justify-center pt-2">
                    <button class="w-full md:w-2/3 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-microchip"></i>
                        <span>Analisar Geometria Facial</span>
                    </button>
                </div>

                <!-- Painel de Resultados (Oculto por padrão) -->
                <div class="hidden bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                    <div class="text-center space-y-2">
                        <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Índice de Similaridade</h3>
                        <div class="flex items-center justify-center gap-3">
                            <span class="text-4xl font-black text-emerald-400">98.5%</span>
                            <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">Match Positivo</span>
                        </div>
                    </div>

                    <button class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-all">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copiar Resumo Forense</span>
                    </button>
                </div>

            </div>
        </div>
`;

// Insert the new html right before the final div of accordion-list.
// We know from line 1635:
// 1635-</div>
// 1636-        </div>
// 1637-        </div>
// 1638-    </div>
// Which matches:
// 1635 </div> (end of tab-oficios panel content)
// 1636 </div> (end of tab-oficios)
// 1637 </div> (end of accordion-list)
// 1638 </div> (end of app-shell accordion-shell)

// Let's accurately find the end of `tab-oficios` to place it right after `tab-oficios`.
const searchStr = `</div>\n        </div>\n        </div>\n    </div>\n\n    <footer`;
const replaceStr = `</div>\n        </div>\n${biometriaHtml}\n        </div>\n    </div>\n\n    <footer`;

if (html.includes(searchStr)) {
    html = html.replace(searchStr, replaceStr);
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('Successfully injected Biometria module.');
} else {
    console.log('Failed to find insertion point.');
}
