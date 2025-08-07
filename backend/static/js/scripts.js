document.addEventListener('DOMContentLoaded', async () => {
    // --- FUNÇÃO DE NORMALIZAÇÃO ---
    function normalizarTexto(texto) { if (!texto) return ""; return texto.toUpperCase().normalize("NFD").replace(/[\u00c0-\u017f]/g, ""); }

    // --- CONFIGURAÇÕES GLOBAIS ---
    const dataTablePortuguese = { "sEmptyTable": "Nenhum registro encontrado", "sInfo": "Mostrando de _START_ até _END_ de _TOTAL_ registros", "sInfoEmpty": "Mostrando 0 até 0 de 0 registros", "sInfoFiltered": "(Filtrados de _MAX_ registros no total)", "sInfoPostFix": "", "sInfoThousands": ".", "sLengthMenu": "_MENU_ resultados por página", "sLoadingRecords": "Carregando...", "sProcessing": "Processando...", "sZeroRecords": "Nenhum registro encontrado", "sSearch": "Pesquisar", "oPaginate": { "sNext": "Próximo", "sPrevious": "Anterior", "sFirst": "Primeiro", "sLast": "Último" }, "oAria": { "sSortAscending": ": Ordenar colunas de forma ascendente", "sSortDescending": ": Ordenar colunas de forma descendente" } };
    const API_BASE_URL = '';

    // --- SELEÇÃO DE ELEMENTOS ---
    const mainContainer = document.querySelector('.container');
    const csvFileInput = document.getElementById('csv-file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    const mappingSection = document.getElementById('mapping-section');
    const validateBtn = document.getElementById('validate-btn');
    const loader = document.getElementById('loader');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const errosCountBadge = document.getElementById('erros-count');
    const correcoesCountBadge = document.getElementById('correcoes-count');
    const visualizadorHead = document.getElementById('visualizador-head');
    const visualizadorBody = document.getElementById('visualizador-body');
    const errosBody = document.getElementById('erros-body');
    const correcoesBody = document.getElementById('correcoes-body');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const apiCheckbox = document.getElementById('api-checkbox');
    const termsOverlay = document.getElementById('terms-overlay');
    const termsTextContainer = document.getElementById('terms-text');
    const termsCheckbox = document.getElementById('terms-checkbox');
    const acceptTermsBtn = document.getElementById('accept-terms-btn');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const clearBtnStep2 = document.getElementById('clear-btn-step2');
    const clearBtnStep3 = document.getElementById('clear-btn-step3');

    // #### NOVOS ELEMENTOS SELECIONADOS PARA A INTERFACE ####
    const mainValidatorSection = document.getElementById('main-validator-section');
    const showCorreiosFixBtn = document.getElementById('show-correios-fix-btn');
    const correiosFixSection = document.getElementById('correios-fix-section');
    const correiosCsvInput = document.getElementById('correios-csv-input');
    const browseCorreiosBtn = document.getElementById('browse-correios-btn');
    const correiosFileName = document.getElementById('correios-file-name');
    const fixAndDownloadBtn = document.getElementById('fix-and-download-btn');
    const correiosLoader = document.getElementById('correios-loader');
    const backToValidatorBtn = document.getElementById('back-to-validator-btn');

    // --- VARIÁVEIS DE ESTADO ---
    let visualizadorDataTable, errosDataTable, correcoesDataTable;
    let dadosCorrigidosParaDownload = [], dadosOriginaisParaVisualizar = [], resultadosParaRelatorio = {};
    let expectedHeaders = [], regrasMapeamento = { colunas_obrigatorias: [] };
    let arquivoCarregado = { nome: null, file: null };
    let unselectedRowIndexes = new Set(), colunasVisiveisGlobal = [], headerMapGlobal = {};

    // --- LÓGICA DE TERMOS DE USO E INICIALIZAÇÃO ---
    const termosDeUsoHTML = `<h4>Termos e Condições de Uso da Ferramenta de Validação</h4><p><strong>Última atualização:</strong> ${new Date().toLocaleDateString('pt-BR')}</p><p>Bem-vindo à Ferramenta de Validação de CSV do Portal Postal ("Ferramenta"). Ao utilizar nossos serviços, você concorda com estes termos. Por favor, leia-os com atenção.</p><p><strong>1. Propósito da Ferramenta</strong><br>A Ferramenta foi projetada para validar, corrigir e padronizar arquivos CSV para garantir a conformidade com os requisitos do sistema Portal Postal. As correções são sugestões baseadas em lógica de programação e dados de fontes externas.</p><p><strong>2. Uso de APIs Públicas</strong><br>Para a validação e correção de endereços, esta Ferramenta consulta APIs públicas e de terceiros (como ViaCEP, BrasilAPI, etc.). A disponibilidade e a precisão dos dados retornados por essas APIs não são de responsabilidade do Portal Postal. A ferramenta realiza múltiplas consultas para aumentar a confiabilidade, mas a veracidade final do endereço é de responsabilidade do usuário.</p><p><strong>3. Privacidade e Segurança dos Dados</strong><ul><li><strong>Processamento em Memória:</strong> O conteúdo do seu arquivo CSV é processado inteiramente na memória do servidor durante a sua sessão.</li><li><strong>Não Armazenamento:</strong> Nenhum dado sensível do seu arquivo (nomes, documentos, endereços, etc.) é armazenado em nosso banco de dados ou em qualquer outro meio persistente. O arquivo é descartado da memória assim que a validação é concluída e os resultados são enviados a você.</li><li><strong>Cache de CEP:</strong> Apenas o número do CEP (sem associação a nenhum dado pessoal) e o resultado da consulta de endereço são armazenados temporariamente em um arquivo de cache para melhorar o desempenho da ferramenta.</li></ul></p><p><strong>4. Responsabilidade do Usuário</strong><br>É sua responsabilidade revisar os dados apresentados no "Visualizador de Dados" e no arquivo corrigido gerado antes de utilizá-los para qualquer finalidade. O Portal Postal não se responsabiliza por quaisquer perdas ou danos resultantes de informações incorretas ou mal interpretadas pela Ferramenta.</p><p><strong>5. Limitação de Responsabilidade</strong><br>A Ferramenta é fornecida "como está", sem garantias de qualquer tipo. Em nenhuma circunstância o Portal Postal será responsável por quaisquer danos diretos ou indiretos decorrentes do uso ou da incapacidade de usar este serviço.</p><p>Ao marcar a caixa de seleção e clicar em "Aceitar", você confirma que leu, compreendeu e concordou com estes Termos e Condições de Uso.</p>`;
    if(termsTextContainer) termsTextContainer.innerHTML = termosDeUsoHTML;
    if (sessionStorage.getItem('termosAceitos') !== 'true' && termsOverlay) {
        if(mainContainer) {
            mainContainer.style.filter = 'blur(5px)';
            mainContainer.style.pointerEvents = 'none';
        }
        termsOverlay.classList.remove('hidden');
    }
    if(termsCheckbox) {
        termsCheckbox.addEventListener('change', () => { 
            if(acceptTermsBtn) acceptTermsBtn.disabled = !termsCheckbox.checked; 
        });
    }
    if(acceptTermsBtn) {
        acceptTermsBtn.addEventListener('click', () => {
            sessionStorage.setItem('termosAceitos', 'true');
            if(termsOverlay) termsOverlay.classList.add('hidden');
            if(mainContainer) {
                mainContainer.style.filter = 'none';
                mainContainer.style.pointerEvents = 'auto';
            }
        });
    }

    try {
        const responseHeaders = await fetch(`${API_BASE_URL}/get-expected-headers`);
        expectedHeaders = await responseHeaders.json();
        const responseRegras = await fetch(`${API_BASE_URL}/get-regras-mapeamento`);
        regrasMapeamento = await responseRegras.json();
    } catch (error) { showErrorToast('Não foi possível carregar as configurações do servidor.'); }
    
    // --- FUNÇÕES DE CONTROLE DE UI ---
    function goToStep(stepNumber) {
        [step1, step2, step3].forEach(s => s && s.classList.remove('active'));
        const currentStep = document.getElementById(`step-${stepNumber}`);
        if (currentStep) currentStep.classList.add('active');
        window.scrollTo(0, 0);
    }

    // --- LÓGICA DE INTERAÇÃO (Validador Principal) ---
    if (browseBtn) browseBtn.addEventListener('click', () => csvFileInput.click());
    if (clearBtnStep2) clearBtnStep2.addEventListener('click', resetarInterfaceCompleta);
    if (clearBtnStep3) clearBtnStep3.addEventListener('click', resetarInterfaceCompleta);
    
    if(csvFileInput) {
        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) { resetarInterfaceCompleta(); return; }
            arquivoCarregado = { nome: file.name, file: file };
            if(fileNameDisplay) fileNameDisplay.textContent = file.name;
            limparResultados(false);
            if(validateBtn) validateBtn.disabled = true;
            const reader = new FileReader();
            reader.onload = (e) => {
                Papa.parse(e.target.result, {
                    preview: 2,
                    complete: (results) => {
                        if (results.data && results.data.length >= 2 && results.data[0].length > 0) {
                            criarInterfaceDeMapeamento(results.data[0], results.data[1]);
                            if(validateBtn) validateBtn.disabled = false;
                            goToStep(2);
                        } else { showErrorToast("Arquivo CSV inválido ou com menos de duas linhas."); }
                    },
                    error: (err) => { showErrorToast("Erro ao processar o arquivo CSV: " + err.message); }
                });
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    if(tabBtns) {
        tabBtns.forEach(btn => btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabContent = document.getElementById(btn.dataset.tab);
            if(tabContent) tabContent.classList.add('active');
        }));
    }

    if(validateBtn) {
        validateBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!arquivoCarregado.file) { showErrorToast("Nenhum arquivo carregado."); return; }
            
            if(loader) loader.classList.remove('hidden');
            [validateBtn, browseBtn, clearBtnStep2, clearBtnStep3].forEach(b => b && (b.disabled = true));

            const headerMap = {};
            document.querySelectorAll('#mapping-table tbody tr').forEach(row => {
                const fileHeader = row.cells[0].textContent;
                const selectElement = row.cells[2].querySelector('select');
                if (selectElement && selectElement.value) { headerMap[fileHeader] = selectElement.value; }
            });
            headerMapGlobal = headerMap;

            const formData = new FormData();
            formData.append('arquivo_csv', arquivoCarregado.file, arquivoCarregado.nome);
            formData.append('usar_api', apiCheckbox.checked);
            formData.append('header_map', JSON.stringify(headerMap));

            try {
                const response = await fetch(`${API_BASE_URL}/validar`, { method: 'POST', body: formData });
                const data = await response.json();
                if (!response.ok) throw new Error(data.erro || 'Ocorreu um erro na validação.');
                
                dadosCorrigidosParaDownload = data.dados_corrigidos || [];
                dadosOriginaisParaVisualizar = data.dados_originais || [];
                resultadosParaRelatorio = { erros: data.erros || [], avisos: data.avisos || [], correcoes: data.correcoes || [] };

                limparResultados(true);
                popularTabelas(resultadosParaRelatorio.erros, resultadosParaRelatorio.avisos, resultadosParaRelatorio.correcoes, dadosOriginaisParaVisualizar);
                
                if (downloadCsvBtn && dadosCorrigidosParaDownload.length > 1) downloadCsvBtn.classList.remove('hidden');
                const temResultados = (resultadosParaRelatorio.erros.length > 0) || (resultadosParaRelatorio.avisos.length > 0) || (resultadosParaRelatorio.correcoes.length > 0);
                if (temResultados && downloadReportBtn) downloadReportBtn.classList.remove('hidden');
                
                showToast("Validação concluída!");
                goToStep(3);
            } catch (error) {
                showErrorToast(`Erro ao validar o arquivo: ${error.message}`);
                goToStep(2);
            } finally {
                if(loader) loader.classList.add('hidden');
                [validateBtn, browseBtn, clearBtnStep2, clearBtnStep3].forEach(b => b && (b.disabled = false));
            }
        });
    }

    if(downloadReportBtn) downloadReportBtn.addEventListener('click', () => baixarRelatorio(resultadosParaRelatorio, arquivoCarregado.nome));
    if(downloadCsvBtn) downloadCsvBtn.addEventListener('click', baixarCSV);
    
    if(correcoesBody) {
        correcoesBody.addEventListener('click', (event) => {
            const linhaClicada = event.target.closest('tr.linha-correcao-clicavel');
            if (!linhaClicada) return;
            const numeroLinha = parseInt(linhaClicada.dataset.linha, 10);
            if (isNaN(numeroLinha) || !visualizadorDataTable) return;
            
            const pageInfo = visualizadorDataTable.page.info();
            const rowIndex = numeroLinha - 2;
            const targetPageIndex = Math.floor(rowIndex / pageInfo.length);

            const visualizadorTabBtn = document.querySelector('.tab-btn[data-tab="visualizador"]');
            if(visualizadorTabBtn) visualizadorTabBtn.click();
            
            $('#visualizador-table').one('draw.dt', function () {
                const noDaLinha = visualizadorDataTable.row(rowIndex).node();
                if (noDaLinha) {
                    const tr = $(noDaLinha);
                    const tdControl = tr.find('td.dt-control');
                    noDaLinha.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    tr.addClass('linha-destacada-temp');
                    setTimeout(() => { tr.removeClass('linha-destacada-temp'); }, 2500);
                    if (!tr.hasClass('dt-hasChild') && tdControl.length > 0) {
                        setTimeout(() => { tdControl.click(); }, 500);
                    }
                }
            });
            visualizadorDataTable.page(targetPageIndex).draw('page');
        });
    }
    
    // #### NOVO BLOCO DE CÓDIGO PARA A FERRAMENTA DOS CORREIOS ####
    if (showCorreiosFixBtn) {
        showCorreiosFixBtn.addEventListener('click', () => {
            if (mainValidatorSection) mainValidatorSection.classList.add('hidden');
            if (correiosFixSection) correiosFixSection.classList.remove('hidden');
        });
    }

    if (backToValidatorBtn) {
        backToValidatorBtn.addEventListener('click', () => {
            if (correiosFixSection) correiosFixSection.classList.add('hidden');
            if (mainValidatorSection) mainValidatorSection.classList.remove('hidden');
            resetarInterfaceCompleta(); 
        });
    }

    if (browseCorreiosBtn) {
        browseCorreiosBtn.addEventListener('click', () => correiosCsvInput.click());
    }

    if (correiosCsvInput) {
        correiosCsvInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if(correiosFileName) correiosFileName.textContent = file.name;
                if(fixAndDownloadBtn) fixAndDownloadBtn.disabled = false;
            } else {
                if(correiosFileName) correiosFileName.textContent = 'Nenhum arquivo selecionado';
                if(fixAndDownloadBtn) fixAndDownloadBtn.disabled = true;
            }
        });
    }

    if (fixAndDownloadBtn) {
        fixAndDownloadBtn.addEventListener('click', async () => {
            const file = correiosCsvInput.files[0];
            if (!file) {
                showErrorToast("Por favor, selecione um arquivo primeiro.");
                return;
            }

            if(fixAndDownloadBtn) fixAndDownloadBtn.disabled = true;
            if(correiosLoader) correiosLoader.classList.remove('hidden');

            const formData = new FormData();
            formData.append('arquivo_csv', file);

            try {
                const response = await fetch(`${API_BASE_URL}/corrigir-correios`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    let errorMsg = "Falha ao corrigir o arquivo.";
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.erro || errorMsg;
                    } catch(e) {
                        errorMsg = await response.text();
                    }
                    throw new Error(errorMsg);
                }

                const disposition = response.headers.get('Content-Disposition');
                let filename = "arquivo_corrigido.csv";
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                showToast("Arquivo corrigido e baixado com sucesso!");

            } catch (error) {
                showErrorToast(`Erro: ${error.message}`);
            } finally {
                if(fixAndDownloadBtn) fixAndDownloadBtn.disabled = false;
                if(correiosLoader) correiosLoader.classList.add('hidden');
            }
        });
    }
    // #### FIM DO NOVO BLOCO ####

    if(visualizadorBody) {
        $('#visualizador-body').on('dblclick', '.cell-content', function() {
            const contentDiv = $(this);
            const cell = contentDiv.closest('td');
            if (contentDiv.find('.cell-editor').length > 0 || cell.hasClass('dt-control') || cell.hasClass('coluna-linha') || cell.hasClass('coluna-checkbox')) return;
            
            const originalValue = contentDiv.text();
            const rowIndex = parseInt(contentDiv.data('row'), 10);
            const originalColIndex = parseInt(contentDiv.data('col-original-index'), 10);
            const input = $('<input type="text" class="form-control form-control-sm cell-editor">').val(originalValue);
            contentDiv.html(input);
            input.focus();
            const salvarEdicao = () => {
                const newValue = input.val();
                if (newValue !== originalValue) {
                    contentDiv.empty().text(newValue).addClass('cell-edited');
                    const nomeColunaOriginal = dadosOriginaisParaVisualizar[0][originalColIndex];
                    const nomeColunaSistema = headerMapGlobal[nomeColunaOriginal] || nomeColunaOriginal;
                    const nomeColunaNormalizado = normalizarTexto(nomeColunaSistema);
                    if (dadosOriginaisParaVisualizar[rowIndex + 1]) {
                        dadosOriginaisParaVisualizar[rowIndex + 1][originalColIndex] = newValue;
                    }
                    if (dadosCorrigidosParaDownload.length > 1) {
                        const headerCorrigido = dadosCorrigidosParaDownload[0].map(h => normalizarTexto(h));
                        const correctedColIndex = headerCorrigido.indexOf(nomeColunaNormalizado);
                        if (dadosCorrigidosParaDownload[rowIndex + 1] && correctedColIndex !== -1) {
                            dadosCorrigidosParaDownload[rowIndex + 1][correctedColIndex] = newValue;
                        }
                    }
                    const linhaReal = rowIndex + 2;
                    resultadosParaRelatorio.correcoes = resultadosParaRelatorio.correcoes.filter(c => !(c.linha === linhaReal && normalizarTexto(c.coluna) === nomeColunaNormalizado));
                    resultadosParaRelatorio.correcoes.push({
                        linha: linhaReal,
                        coluna: nomeColunaSistema,
                        original: originalValue,
                        corrigido: newValue,
                        fonte: "Manual"
                    });
                    popularTabelaCorrecoes(resultadosParaRelatorio.correcoes);
                } else {
                    contentDiv.empty().text(originalValue);
                }
            };
            input.on('blur', salvarEdicao).on('keydown', function(e) {
                if (e.key === 'Enter') { salvarEdicao(); } else if (e.key === 'Escape') { contentDiv.empty().text(originalValue); }
            });
        });
    }

// --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---
    function popularTabelas(erros, avisos, correcoes, dadosOriginais) {
        popularTabelaVisualizador(dadosOriginais, erros, correcoes);
        const avisosMapeados = (avisos || []).map(avisoMsg => {
            const match = avisoMsg.match(/^Linha (\d+):/);
            return match ? { linha: parseInt(match[1]), coluna: 'Aviso', mensagem: avisoMsg } : { linha: 'Global', coluna: 'Aviso', mensagem: avisoMsg };
        });
        const todosOsProblemas = [...avisosMapeados, ...(erros || [])].sort((a, b) => {
            if (a.linha === 'Global') return -1; if (b.linha === 'Global') return 1; return parseInt(a.linha) - parseInt(b.linha);
        });
        if (errosBody) {
            if (todosOsProblemas.length > 0) {
                errosBody.innerHTML = todosOsProblemas.map(e => `<tr><td>${e.linha}</td><td>${e.coluna}</td><td>${e.mensagem}</td></tr>`).join('');
                if (errosCountBadge) { errosCountBadge.textContent = todosOsProblemas.length; errosCountBadge.classList.remove('hidden'); }
            } else {
                errosBody.innerHTML = '';
                if (errosCountBadge) { errosCountBadge.textContent = 0; errosCountBadge.classList.add('hidden'); }
            }
        }
        popularTabelaCorrecoes(correcoes);
        if (errosDataTable) errosDataTable.destroy();
        if (errosBody) errosDataTable = new DataTable('#erros-table', { language: dataTablePortuguese, pageLength: 10, destroy: true });
    }
    
    function popularTabelaCorrecoes(correcoes) {
        if (correcoesDataTable) correcoesDataTable.destroy();
        if (correcoesBody) {
            correcoesBody.innerHTML = '';
            if (correcoes && correcoes.length > 0) {
                correcoesBody.innerHTML = correcoes.map(c => `<tr class="linha-correcao-clicavel" data-linha="${c.linha}"><td>${c.linha}</td><td>${c.coluna}</td><td>${c.original}</td><td>${c.corrigido}</td><td>${c.fonte}</td></tr>`).join('');
                if (correcoesCountBadge) { correcoesCountBadge.textContent = correcoes.length; correcoesCountBadge.classList.remove('hidden'); }
            } else {
                if (correcoesCountBadge) { correcoesCountBadge.textContent = 0; correcoesCountBadge.classList.add('hidden'); }
            }
            correcoesDataTable = new DataTable('#correcoes-table', { language: dataTablePortuguese, pageLength: 10, destroy: true });
        }
    }

    function popularTabelaVisualizador(dadosOriginais, erros, correcoes) {
        if (visualizadorDataTable) { visualizadorDataTable.destroy(); }
        if(visualizadorHead) visualizadorHead.innerHTML = '';
        if(visualizadorBody) visualizadorBody.innerHTML = '';

        if (!dadosOriginais || dadosOriginais.length < 2) {
            if(visualizadorBody) visualizadorBody.innerHTML = '<tr><td colspan="99">Nenhum dado para exibir.</td></tr>';
            return;
        }

        const headerCompleto = dadosOriginais[0];
        colunasVisiveisGlobal = headerCompleto.map((h, i) => ({ header: h, originalIndex: i })).filter(col => col.header && col.header.trim() !== '');
        const headerVisivel = colunasVisiveisGlobal.map(col => col.header);
        const dataSet = dadosOriginais.slice(1).map(row => colunasVisiveisGlobal.map(col => row[col.originalIndex]));

        const columns = [
            { className: 'dt-control', orderable: false, data: null, defaultContent: '' },
            { title: 'Linha', className: 'coluna-linha' },
            { title: '<input type="checkbox" id="select-all-checkbox" checked>', className: 'coluna-checkbox', orderable: false },
        ];
        headerVisivel.forEach((title, index) => {
            columns.push({ title: title, data: index,
                render: function(data, type, row, meta) {
                    if (type === 'display') {
                        const linhaReal = meta.row + 2;
                        const originalColIndex = colunasVisiveisGlobal[meta.col - 3].originalIndex;
                        const nomeColuna = dadosOriginais[0][originalColIndex];
                        const nomeColunaNormalizado = normalizarTexto(nomeColuna);
                        let classes = 'cell-content';
                        const correcao = correcoes.find(c => c.linha === linhaReal && normalizarTexto(c.coluna) === nomeColunaNormalizado);
                        if (regrasMapeamento.colunas_obrigatorias.includes(nomeColunaNormalizado) && (!data || String(data).trim() === '')) {
                            classes += ' cell-error';
                        } else if (correcao) {
                            classes += ' cell-has-correction';
                        }
                        return `<div class="${classes}" data-row="${meta.row}" data-col-original-index="${originalColIndex}">${data || 'vazio'}</div>`;
                    }
                    return data;
                }
            });
        });
        
        visualizadorDataTable = new DataTable('#visualizador-table', {
            destroy: true, data: dataSet, columns: columns, language: dataTablePortuguese, order: [[1, 'asc']],
            paging: true,
            columnDefs: [
                { targets: 1, render: (data, type, row, meta) => meta.row + 2 },
                { targets: 2, render: (data, type, row, meta) => `<input type="checkbox" class="row-checkbox" data-row-index="${meta.row}" checked>` }
            ],
            createdRow: function (row, data, dataIndex) {
                const linhaReal = dataIndex + 2;
                if (correcoes.some(c => c.linha === linhaReal)) {
                    $(row).find('td:first-child').addClass('dt-control');
                }
            }
        });
        
        $('#visualizador-table tbody').off('click', 'td.dt-control').on('click', 'td.dt-control', function () {
            const tr = $(this).closest('tr');
            const wasOpen = tr.hasClass('dt-hasChild');
            $('.linha-correcao-detalhe').remove();
            $('#visualizador-table tbody tr.dt-hasChild').removeClass('dt-hasChild');
            if (!wasOpen) {
                const row = visualizadorDataTable.row(tr);
                const linhaReal = row.index() + 2;
                const correcoesDaLinha = resultadosParaRelatorio.correcoes.filter(c => c.linha === linhaReal);
                const newRowHtml = formatarLinhaDeCorrecao(correcoesDaLinha, headerVisivel);
                tr.after(newRowHtml);
                tr.addClass('dt-hasChild');
            }
        });
        adicionarLogicaCheckboxes();
    }
    
    function formatarLinhaDeCorrecao(correcoesDaLinha, header) {
        if (!correcoesDaLinha.length) return '';
        let cellsHtml = '';
        header.forEach(nomeColuna => {
            const nomeColunaNormalizado = normalizarTexto(nomeColuna);
            const correcao = correcoesDaLinha.find(c => normalizarTexto(c.coluna) === nomeColunaNormalizado);
            if (correcao) {
                cellsHtml += `<td><div class="diff-adicionado">${correcao.corrigido || 'vazio'}</div></td>`;
            } else {
                cellsHtml += '<td></td>';
            }
        });
        return `<tr class="linha-correcao-detalhe"><td colspan="3" class="correcao-label"><strong>Correções:</strong></td>${cellsHtml}</tr>`;
    }

    function resetarInterfaceCompleta() {
        limparResultados(false);
        if (csvFileInput) csvFileInput.value = null;
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        if (validateBtn) validateBtn.disabled = true;
        arquivoCarregado = { nome: null, file: null };
        const visualizadorTabBtn = document.querySelector('.tab-btn[data-tab="visualizador"]');
        if (visualizadorTabBtn) visualizadorTabBtn.click();
        goToStep(1);
    }

    function limparResultados(manterMapeamento) {
        if (visualizadorDataTable) {
            $('#visualizador-table tbody tr.linha-correcao-detalhe').remove();
            visualizadorDataTable.destroy(); 
            visualizadorDataTable = null; 
        }
        if (errosDataTable) { errosDataTable.destroy(); errosDataTable = null; }
        if (correcoesDataTable) { correcoesDataTable.destroy(); correcoesDataTable = null; }
        
        if(visualizadorHead) visualizadorHead.innerHTML = ''; 
        if(visualizadorBody) visualizadorBody.innerHTML = '';
        if(errosBody) errosBody.innerHTML = ''; 
        if(correcoesBody) correcoesBody.innerHTML = '';
        
        if (errosCountBadge) { errosCountBadge.textContent = '0'; errosCountBadge.classList.add('hidden'); }
        if (correcoesCountBadge) { correcoesCountBadge.textContent = '0'; correcoesCountBadge.classList.add('hidden'); }
        if (downloadCsvBtn) downloadCsvBtn.classList.add('hidden'); 
        if (downloadReportBtn) downloadReportBtn.classList.add('hidden');
        unselectedRowIndexes.clear();
        if (!manterMapeamento && mappingSection) {
            mappingSection.innerHTML = '';
        }
    }

    function criarInterfaceDeMapeamento(fileHeaders, firstDataRow) {
        const safeExpectedHeaders = Array.isArray(expectedHeaders) ? expectedHeaders : [];
        const systemOptions = `<option value="">-- Ignorar --</option>` + safeExpectedHeaders.map(h => `<option value="${h}">${h}</option>`).join('');
        const rows = fileHeaders.map((header, index) => {
            if (!header || !header.trim()) return "";
            const bestMatch = safeExpectedHeaders.find(sysHeader => normalizarTexto(sysHeader) === normalizarTexto(header.trim()));
            const isObrigatorio = bestMatch && regrasMapeamento.colunas_obrigatorias.includes(bestMatch);
            const classeLinha = `linha-mapeamento ${isObrigatorio ? 'obrigatorio' : 'opcional'}`;
            const amostraDado = firstDataRow[index] || '';
            return `<tr class="${classeLinha}"><td><strong>${header}</strong></td><td><small class="amostra-dado">${amostraDado}</small></td><td><select class="form-select form-select-sm">${systemOptions}</select></td></tr>`;
        }).join('');
        if (mappingSection) {
            mappingSection.innerHTML = `<div class="mapping-container"><h4>Mapeamento de Colunas</h4><p>Associe as colunas do seu arquivo com as do sistema. <span class="indicador-obrigatorio">*</span> = Obrigatório</p><table id="mapping-table" class="table table-sm table-bordered"><thead class="table-light"><tr><th>Coluna do Seu Arquivo</th><th>Amostra de Dados</th><th>Coluna do Sistema</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            mappingSection.querySelectorAll('tr.linha-mapeamento').forEach((tr) => {
                const headerText = tr.querySelector('strong').innerText;
                const select = tr.querySelector('select');
                const bestMatch = safeExpectedHeaders.find(sysHeader => normalizarTexto(sysHeader) === normalizarTexto(headerText));
                if (bestMatch) { select.value = bestMatch; }
                select.addEventListener('change', () => {
                    atualizarStatusMapeamento();
                    atualizarOpcoesDropdowns();
                });
            });
            setTimeout(() => {
                atualizarStatusMapeamento();
                atualizarOpcoesDropdowns();
            }, 0);
        }
    }

    function atualizarStatusMapeamento() {
        document.querySelectorAll('#mapping-table select').forEach(select => {
            const linha = select.closest('tr');
            const nomeColunaSistema = select.value;
            linha.classList.remove('mapeamento-completo', 'mapeamento-faltando');
            if (linha.classList.contains('obrigatorio')) {
                if (nomeColunaSistema) { linha.classList.add('mapeamento-completo'); } else { linha.classList.add('mapeamento-faltando'); }
            }
        });
    }

    function atualizarOpcoesDropdowns() {
        const todosOsSelects = document.querySelectorAll('#mapping-table select');
        const valoresUsados = new Set();
        todosOsSelects.forEach(select => { if (select.value) { valoresUsados.add(select.value); } });
        todosOsSelects.forEach(select => {
            const valorAtual = select.value;
            select.querySelectorAll('option').forEach(option => {
                option.disabled = valoresUsados.has(option.value) && option.value !== valorAtual;
            });
        });
    }

    function adicionarLogicaCheckboxes() {
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if(selectAllCheckbox) {
            $(selectAllCheckbox).off('change').on('change', function() {
                const isChecked = this.checked;
                $('#visualizador-table .row-checkbox').prop('checked', isChecked);
                if (isChecked) {
                    unselectedRowIndexes.clear();
                } else {
                    const rowCount = visualizadorDataTable.rows().count();
                    for (let i = 0; i < rowCount; i++) { unselectedRowIndexes.add(i); }
                }
            });
        }
        $('#visualizador-table tbody').off('change', '.row-checkbox').on('change', '.row-checkbox', function() {
            const rowIndex = parseInt($(this).data('rowIndex'), 10);
            if (this.checked) {
                unselectedRowIndexes.delete(rowIndex);
            } else {
                unselectedRowIndexes.add(rowIndex);
            }
            if (!this.checked) {
                if(selectAllCheckbox) selectAllCheckbox.checked = false;
            } else if (unselectedRowIndexes.size === 0) {
                if(selectAllCheckbox) selectAllCheckbox.checked = true;
            }
        });
    }

    function baixarCSV() {
        const linhasSelecionadas = [];
        const totalRows = dadosCorrigidosParaDownload.length - 1;
        for (let i = 0; i < totalRows; i++) {
            if (!unselectedRowIndexes.has(i)) {
                linhasSelecionadas.push(dadosCorrigidosParaDownload[i + 1]);
            }
        }
        if (linhasSelecionadas.length === 0) { showErrorToast("Nenhuma linha selecionada para baixar."); return; }
        const dadosParaBaixar = [dadosCorrigidosParaDownload[0], ...linhasSelecionadas];
        const conteudoCSV = Papa.unparse(dadosParaBaixar, { delimiter: ';' });
        const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${(arquivoCarregado.nome || 'arquivo.csv').replace(/\.csv$/i, '')}_corrigido.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function baixarRelatorio(resultados, nomeArquivoOriginal) {
        showToast("Gerando relatório PDF...");
        fetch(`${API_BASE_URL}/gerar-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ resultados: resultados, nomeArquivoOriginal: nomeArquivoOriginal }),
        })
        .then(response => response.ok ? response.blob() : response.json().then(err => Promise.reject(err)))
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `relatorio_${nomeArquivoOriginal.replace(/\.csv$/i, '')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => showErrorToast(error.erro || 'Não foi possível gerar o relatório PDF.'));
    }

    function showToast(message) { Toastify({ text: message, duration: 3000, close: true, gravity: "bottom", position: "right", style: { background: "linear-gradient(to right, #00b09b, #96c93d)" } }).showToast(); }
    function showErrorToast(message) { Toastify({ text: message, duration: 5000, close: true, gravity: "bottom", position: "right", style: { background: "linear-gradient(to right, #ff5f6d, #ffc371)" } }).showToast(); }
    
    // Iniciar na etapa 1
    goToStep(1);
});


