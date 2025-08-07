import io 
import csv 
import os
import json
import traceback
from datetime import datetime
from flask import Flask, render_template, request, jsonify, make_response
from flask_cors import CORS
from weasyprint import HTML
from logic.validador import validar_csv_conteudo, EXPECTED_HEADER, carregar_config


app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    """Renderiza a página principal da aplicação (index.html)."""
    return render_template('index.html')

@app.route('/get-expected-headers', methods=['GET'])
def get_expected_headers():
    """Fornece ao frontend a lista de cabeçalhos padrão do sistema."""
    return jsonify(EXPECTED_HEADER)

@app.route('/get-regras-mapeamento', methods=['GET'])
def get_regras_mapeamento():
    """Fornece ao frontend a lista de colunas obrigatórias do config.json."""
    try:
        config = carregar_config()
        regras = {
            "colunas_obrigatorias": config.get("COLUNAS_OBRIGATORIAS", [])
        }
        return jsonify(regras)
    except Exception:
        return jsonify({"colunas_obrigatorias": []})

@app.route('/validar', methods=['POST'])
def handle_validation():
    try:
        if 'arquivo_csv' not in request.files:
            return jsonify({"erro": "Nenhum arquivo CSV foi enviado."}), 400

        file = request.files['arquivo_csv']
        conteudo_csv = file.read().decode('utf-8-sig', errors='ignore')
        usar_api = request.form.get('usar_api', 'true').lower() == 'true'
        header_map = json.loads(request.form.get('header_map', '{}'))

        sucesso, avisos, erros, correcoes, dados_corrigidos, dados_originais = validar_csv_conteudo(
            conteudo_csv, header_map=header_map, usar_api=usar_api
        )

        response_data = {
            "status": "sucesso",
            "avisos": avisos,
            "erros": erros,
            "correcoes": correcoes,
            "dados_corrigidos": dados_corrigidos,
            "dados_originais": dados_originais
        }
        
        return jsonify(response_data)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"Ocorreu um erro interno no servidor ao validar o arquivo."}), 500

# --- ROTA DE GERAÇÃO DE RELATÓRIO ---

@app.route('/gerar-pdf', methods=['POST'])
def handle_pdf_report():
    """
    Recebe os resultados da validação e gera um relatório em PDF.
    """
    try:
        data = request.get_json()
        
        context = {
            "nome_arquivo_original": data.get("nomeArquivoOriginal", "N/A"),
            "data_relatorio": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "resultados": data.get("resultados", {})
        }
        
        html_string = render_template('relatorio_template.html', **context)
        
        # A base_url informa ao WeasyPrint como encontrar arquivos estáticos (ex: logo)
        pdf_bytes = HTML(string=html_string, base_url=request.base_url).write_pdf()

        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        nome_base = data.get("nomeArquivoOriginal", "arquivo").replace('.csv', '', 1)
        response.headers['Content-Disposition'] = f'attachment; filename=relatorio_{nome_base}.pdf'
        
        return response

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": "Ocorreu um erro ao gerar o relatório PDF."}), 500

""" Rota para corrigir arquivos CSV exportados do Correios Atende."""

@app.route('/corrigir-correios', methods=['POST'])
def handle_correios_fix():
    """
    Recebe um arquivo CSV 'quebrado' do Correios Atende e aplica uma correção dupla:
    1. Junta linhas quebradas por newlines.
    2. Funde colunas que foram divididas por um ';' extra em campos de nome longos.
    O resultado é um arquivo limpo com exatamente 22 colunas por linha.
    """
    if 'arquivo_csv' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado."}), 400

    file = request.files['arquivo_csv']
    
    try:
        lines = file.read().decode('latin-1', errors='ignore').splitlines()

        NUM_COLUNAS_ESPERADO = 22
        
        # Etapa 1: Juntar as linhas que foram quebradas por 'Enter'
        logical_lines = []
        temp_line = ""
        for line in lines:
            temp_line += line.strip()
            # Uma heurística simples: se a linha parece completa, processe.
            # A lógica de contagem de colunas posterior é mais robusta.
            # Esta junção lida com o caso de múltiplos 'Enter' dentro de um campo.
            # Assumimos que uma linha completa tem um número de colunas próximo do esperado.
            if temp_line.count(';') >= NUM_COLUNAS_ESPERADO - 1:
                 logical_lines.append(temp_line)
                 temp_line = ""
        if temp_line: # Adiciona o que sobrou no buffer
            logical_lines.append(temp_line)

        # Etapa 2: Corrigir as linhas que têm colunas extras devido a ';' no texto
        corrected_rows = []
        for line in logical_lines:
            fields = line.split(';')
            
            # Loop de fusão: enquanto a linha tiver mais colunas que o esperado...
            while len(fields) > NUM_COLUNAS_ESPERADO:
                # O padrão mais comum é a quebra no 12º campo (NOME_DESTINATARIO)
                # ou no 13º (NOME_REMETENTE). A fusão a partir do 12º campo é mais segura.
                # Índices em lista começam em 0, então o 12º campo é o índice 11.
                if len(fields) > 12:
                    fields[11] = fields[11] + fields[12] # Funde o campo 12 no campo 11
                    del fields[12] # Deleta o campo 12, que agora é redundante
                else:
                    # Se a quebra ocorrer antes, pare para evitar erros.
                    break 
            
            # Garante que a linha tenha exatamente o número de colunas esperado, preenchendo se faltar
            while len(fields) < NUM_COLUNAS_ESPERADO:
                fields.append('')

            corrected_rows.append(fields[:NUM_COLUNAS_ESPERADO])

        # Etapa 3: Gerar o arquivo de saída
        output_stream = io.StringIO(newline='')
        writer = csv.writer(output_stream, delimiter=';', quoting=csv.QUOTE_NONE, lineterminator='\r\n')
        writer.writerows(corrected_rows)

        output_stream.seek(0)
        final_content = output_stream.getvalue().encode('latin-1')

        response = make_response(final_content)
        response.headers['Content-Type'] = 'text/csv; charset=latin-1'
        nome_base = file.filename.replace('.csv', '', 1) if file.filename else "arquivo"
        response.headers['Content-Disposition'] = f'attachment; filename={nome_base}_corrigido.csv'
        
        return response

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"Ocorreu um erro interno ao corrigir o arquivo."}), 500

# --- EXECUÇÃO DO APP ---

if __name__ == '__main__':
    app.run(debug=True)