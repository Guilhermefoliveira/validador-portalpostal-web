import csv
import re
import os
import requests
import json
import traceback
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import date, datetime
from io import StringIO

def normalizar_cabecalho(texto):
    if not isinstance(texto, str):
        return ""
    nfkd_form = unicodedata.normalize('NFD', texto)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)]).upper()

def carregar_config():
    defaults = {
        "COLUNAS_OBRIGATORIAS": ["NOME", "CEP", "ENDERECO", "NUMERO", "BAIRRO", "CIDADE", "UF", "CONTEUDO", "CHAVE_NFE", "CHAVE_NOTA_FISCAL"],
        "API_TIMEOUT": 15,
        "MAX_CONCURRENT_REQUESTS": 2,
        "API_PROVIDERS": [{"name": "ViaCEP", "url": "https://viacep.com.br/ws/{}/json/", "parser_name": "_parse_viacep"}]
    }
    try:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        for key in defaults:
            if key not in config: config[key] = defaults[key]
        return config
    except (FileNotFoundError, json.JSONDecodeError):
        return defaults

def _parse_viacep(r): return {"logradouro":r.get("logradouro"),"bairro":r.get("bairro"),"cidade":r.get("localidade"),"uf":r.get("uf")}, None if not r.get("erro") else "CEP não encontrado"
def _parse_brasilapi(r): return {"logradouro":r.get("street"),"bairro":r.get("neighborhood"),"cidade":r.get("city"),"uf":r.get("state")}, None
def _parse_opencep(r): return {"logradouro":r.get("logradouro"),"bairro":r.get("bairro"),"cidade":r.get("localidade"),"uf":r.get("uf")}, None if not r.get("erro") else "CEP não encontrado"
def _parse_postmon(r): return {"logradouro":r.get("logradouro"),"bairro":r.get("bairro"),"cidade":r.get("cidade"),"uf":r.get("estado")}, None

PARSER_FUNCTIONS = {"_parse_viacep": _parse_viacep, "_parse_brasilapi": _parse_brasilapi, "_parse_opencep": _parse_opencep, "_parse_postmon": _parse_postmon}
CONFIG = carregar_config()
CACHE_FILE = 'cep_cache.json'
EXPECTED_HEADER = ["NOME", "EMPRESA", "CPF", "CEP", "ENDERECO", "NUMERO", "COMPLEMENTO", "BAIRRO", "CIDADE", "UF", "AOS_CUIDADOS", "NOTA_FISCAL", "CHAVE_NFE", "SERVICO", "SERV_ADICIONAIS", "VALOR_DECLARADO", "OBSERVAÇÕES", "CONTEUDO", "DDD", "TELEFONE", "E-MAIL", "IDENTIFICADOR_CLIENTE", "PESO", "ALTURA", "LARGURA", "COMPRIMENTO", "ENTREGA_VIZINHO", "RFID"]
COLUNAS_OBRIGATORIAS = set(CONFIG.get("COLUNAS_OBRIGATORIAS"))
API_TIMEOUT = CONFIG.get("API_TIMEOUT")
MAX_CONCURRENT_REQUESTS = CONFIG.get("MAX_CONCURRENT_REQUESTS")
API_PROVIDERS = [pc for pc in CONFIG.get("API_PROVIDERS") if PARSER_FUNCTIONS.get(pc.get("parser_name")) and pc.get("url") and pc.get("name")]
for provider in API_PROVIDERS:
    provider["parser"] = PARSER_FUNCTIONS[provider["parser_name"]]

REQUEST_HEADERS = {'User-Agent': 'Mozilla/5.0'}
REGEX_CEP = r"^\d{5}-\d{3}$"; REGEX_TELEFONE = r"^\d{10,11}$"
REGEX_CPF = r"^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$"; REGEX_CNPJ = r"^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$|^\d{14}$"
REGEX_EMAIL = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"; REGEX_CHAVE_NFE = r"^\d{44}$"

def tentar_corrigir_cep(v): d = re.sub(r'\D', '', str(v)); d = d.zfill(8) if 1 <= len(d) < 8 else d; return f"{d[:5]}-{d[5:]}" if len(d) == 8 else v
def tentar_corrigir_cpf_cnpj(v): d = re.sub(r'\D', '', str(v)); d_len = len(d); return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}" if d_len == 11 else (f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}" if d_len == 14 else v)
def corrigir_telefone(v): return re.sub(r'\D', '', str(v))
def corrigir_chave_nfe(v): return re.sub(r'\D', '', str(v))
def corrigir_numero(v):
    val = str(v).strip().replace(',', '.', 1)
    if not val: return ""
    parts = val.split('.')
    return parts[0] + '.' + ''.join(parts[1:]) if len(parts) > 1 else parts[0]

def is_float(v):
    if not v: return True
    try: float(re.sub(r'[^\d.]', '', v)); return True
    except (ValueError, TypeError): return False

VALIDATION_RULES = {"NOME": {"validacao": (lambda v: len(v) <= 100), "msg": "Excede 100 caracteres."}, "CEP": {"correcao": tentar_corrigir_cep, "validacao": (lambda v: re.match(REGEX_CEP, v)), "msg": "Formato inválido. Use NNNNN-NNN."}, "TELEFONE": {"correcao": corrigir_telefone, "validacao": (lambda v: re.match(REGEX_TELEFONE, v)), "msg": "Deve ter 10 ou 11 dígitos."}, "CPF": {"correcao": tentar_corrigir_cpf_cnpj, "validacao": (lambda v: re.match(REGEX_CPF, v) or re.match(REGEX_CNPJ, v)), "msg": "Formato de CPF/CNPJ inválido."}, "E-MAIL": {"validacao": (lambda v: re.match(REGEX_EMAIL, v) if v else True), "msg": "Formato de e-mail inválido."}, "CHAVE_NFE": {"correcao": corrigir_chave_nfe, "validacao": (lambda v: re.match(REGEX_CHAVE_NFE, v) if v else True), "msg": "Deve conter 44 dígitos numéricos."}, "VALOR_DECLARADO": {"correcao": corrigir_numero, "validacao": is_float, "msg": "Deve ser um número válido (ex: 10.25)."}, "PESO": {"correcao": corrigir_numero, "validacao": is_float, "msg": "Deve ser um número válido."}, "ALTURA": {"correcao": corrigir_numero, "validacao": is_float, "msg": "Deve ser um número válido."}, "LARGURA": {"correcao": corrigir_numero, "validacao": is_float, "msg": "Deve ser um número válido."}, "COMPRIMENTO": {"correcao": corrigir_numero, "validacao": is_float, "msg": "Deve ser um número válido."}}

def carregar_cache_cep():
    try:
        cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', CACHE_FILE)
        with open(cache_path, 'r', encoding='utf-8') as f: cache = json.load(f)
        return cache.get("data", {})
    except (FileNotFoundError, json.JSONDecodeError): return {}

def salvar_cache_cep(cache_data):
    try:
        cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', CACHE_FILE)
        full_cache_obj = {"last_updated": str(date.today()), "data": cache_data}
        with open(cache_path, 'w', encoding='utf-8') as f: json.dump(full_cache_obj, f, indent=4)
    except Exception as e: print(f"Erro ao salvar o cache de CEP: {e}")

def consultar_apis_cep(session, cep_numeros):
    if not str(cep_numeros).isdigit() or len(cep_numeros) != 8: return None, "Formato de CEP inválido para API."
    errors = []; not_found_count = 0
    for provider in API_PROVIDERS:
        try:
            response = session.get(provider["url"].format(cep_numeros), timeout=API_TIMEOUT, headers=REQUEST_HEADERS)
            response.raise_for_status()
            data, err = provider["parser"](response.json())
            if err:
                if "não encontrado" in err.lower(): not_found_count += 1
                else: errors.append(f"({provider['name']}: Resposta com erro)")
                continue
            return data, None
        except requests.exceptions.RequestException: errors.append(f"({provider['name']}: Sem resposta)")
        except json.JSONDecodeError: errors.append(f"({provider['name']}: Resposta inválida)")
    if not_found_count > 0: return None, "CEP não encontrado."
    return None, "Falha na consulta do CEP. APIs externas podem estar instáveis."

def detectar_delimitador_e_encoding(caminho_arquivo):
    try:
        caminho_arquivo.seek(0); sample = caminho_arquivo.read(4096)
        if not sample: return None, None, None, "Arquivo está vazio."
        caminho_arquivo.seek(0)
        delimiter = csv.Sniffer().sniff(sample, delimiters=';,').delimiter
        caminho_arquivo.seek(0)
        header = next(csv.reader(StringIO(sample), delimiter=delimiter))
        caminho_arquivo.seek(0)
        return header, delimiter, 'utf-8', f"Lido com delimitador '{delimiter}'."
    except Exception:
        return None, None, None, "Não foi possível determinar o formato do arquivo."

def validar_csv(caminho_arquivo, header_map=None, usar_api=True):
    cep_cache = carregar_cache_cep()
    cabecalho_original, delimitador, encoding, msg = detectar_delimitador_e_encoding(caminho_arquivo)
    
    if not cabecalho_original:
        return [msg or "Erro desconhecido"], [], [], [], [], []
    
    avisos = [msg] if msg else []
    
    try:
        caminho_arquivo.seek(0)
        linhas_originais = list(csv.DictReader(caminho_arquivo, delimiter=delimitador))
    except (AttributeError, TypeError):
        return ["Erro ao ler o conteúdo do arquivo."], [], [], [], [], []

    dados_originais = [cabecalho_original]
    for linha in linhas_originais:
        valores_linha = list(linha.values())
        if len(valores_linha) < len(cabecalho_original):
            valores_linha.extend([''] * (len(cabecalho_original) - len(valores_linha)))
        dados_originais.append(valores_linha[:len(cabecalho_original)])

    ceps_gerais = set()
    if usar_api:
        mapa_reverso = {v: k for k, v in header_map.items()} if header_map else {}
        nome_coluna_cep_original = next((h for h in cabecalho_original if normalizar_cabecalho(h) == "CEP"), None)
        if header_map:
             nome_coluna_cep_original = mapa_reverso.get("CEP", nome_coluna_cep_original)
        
        if nome_coluna_cep_original and nome_coluna_cep_original in cabecalho_original:
            ceps_para_consulta_raw = {str(linha.get(nome_coluna_cep_original, '')).strip() for linha in linhas_originais if linha}
            ceps_validos = {re.sub(r'\D', '', cep).zfill(8) for cep in ceps_para_consulta_raw if len(re.sub(r'\D', '', cep)) >= 7}
            ceps_a_consultar = {cep for cep in ceps_validos if cep not in cep_cache}
            if ceps_a_consultar:
                with requests.Session() as session:
                    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS) as executor:
                        future_to_cep = {executor.submit(consultar_apis_cep, session, cep): cep for cep in ceps_a_consultar}
                        for future in as_completed(future_to_cep):
                            cep_cache[future_to_cep[future]] = future.result()
            
            for cep, resultado in cep_cache.items():
                dados_api, _ = resultado
                if dados_api and not dados_api.get("logradouro"):
                    ceps_gerais.add(cep)
        else:
            avisos.append("Coluna de CEP não encontrada no arquivo. Validação por API ignorada.")

    erros_totais, correcoes_totais, dados_com_api = [], [], []

    # --- LÓGICA DE CABEÇALHO CORRIGIDA ---
    # Define o cabeçalho final com base no mapeamento do usuário
    cabecalho_final_mapeado = [ (header_map.get(h, normalizar_cabecalho(h))) for h in cabecalho_original ]
    cabecalho_final = [h for h in cabecalho_final_mapeado if h in EXPECTED_HEADER]
    # Remove duplicados mantendo a ordem
    cabecalho_final = sorted(list(set(cabecalho_final)), key=cabecalho_final.index)

    for i, linha_dict in enumerate(linhas_originais, start=2):
        if not linha_dict or not any(linha_dict.values()): continue
        
        try:
            if None in linha_dict:
                erros_totais.append({"linha": i, "coluna": "Geral", "mensagem": "A linha contém mais colunas que o cabeçalho."})
                continue

            valores_proc = { (header_map or {}).get(col_orig, normalizar_cabecalho(col_orig)): val or "" for col_orig, val in linha_dict.items() if col_orig}
            
            valores_sanitizados = {col: re.sub(r'\s+', ' ', str(val).replace('"', '').replace(';', ' ')).strip() for col, val in valores_proc.items()}
            
            valores_com_tudo = deepcopy(valores_sanitizados)
            
            if usar_api and valores_com_tudo.get("CEP"):
                cep_num = re.sub(r'\D', '', valores_com_tudo["CEP"])
                if cep_num in ceps_gerais:
                    avisos.append(f"Linha {i}: O CEP {valores_com_tudo.get('CEP')} é geral da cidade. Verifique o endereço manualmente.")
                elif cep_num in cep_cache:
                    dados_api_linha, erro_api = cep_cache.get(cep_num, (None, None))
                    if erro_api:
                        avisos.append(f"Linha {i}: Falha ao consultar CEP {valores_com_tudo.get('CEP')} ({erro_api}).")
                    elif dados_api_linha:
                        for api_key, csv_key in {"logradouro":"ENDERECO", "bairro":"BAIRRO", "cidade":"CIDADE", "uf":"UF"}.items():
                            v_api, v_csv = dados_api_linha.get(api_key,"").strip(), valores_com_tudo.get(csv_key, "").strip()
                            if v_api and v_api.upper() != v_csv.upper():
                                correcoes_totais.append({"linha": i, "coluna": csv_key, "original": v_csv, "corrigido": v_api, "fonte": "API"})
                                valores_com_tudo[csv_key] = v_api

            for col, regra in VALIDATION_RULES.items():
                if col not in valores_com_tudo: continue
                original = valores_com_tudo.get(col)
                corrigido = original
                if "correcao" in regra:
                    corrigido = regra["correcao"](original)
                if original != corrigido:
                    correcao_api_existente = next((c for c in correcoes_totais if c['linha'] == i and c['coluna'] == col), None)
                    if correcao_api_existente:
                        correcao_api_existente['corrigido'] = corrigido
                    else:
                        correcoes_totais.append({"linha": i, "coluna": col, "original": valores_sanitizados[col], "corrigido": corrigido, "fonte": "Formato"})
                valores_com_tudo[col] = corrigido

            for col in cabecalho_final:
                val = valores_com_tudo.get(col)
                if col in COLUNAS_OBRIGATORIAS and not val:
                    erros_totais.append({"linha": i, "coluna": col, "mensagem": "Campo obrigatório está vazio."})
                elif val and col in VALIDATION_RULES and "validacao" in (regra := VALIDATION_RULES[col]):
                    if not regra["validacao"](val):
                        erros_totais.append({"linha": i, "coluna": col, "mensagem": regra.get("msg", "Inválido")})
            
            if valores_com_tudo.get("NOTA_FISCAL") and not valores_com_tudo.get("CHAVE_NFE"):
                erros_totais.append({"linha": i, "coluna": "CHAVE_NFE", "mensagem": "Campo obrigatório da Chave NF-e quando a Nota Fiscal é informada."})

            # --- LÓGICA DE CONSTRUÇÃO DE LINHA CORRIGIDA ---
            dados_com_api.append([valores_com_tudo.get(h, "") for h in cabecalho_final])
        
        except Exception as e:
            traceback.print_exc()
            erros_totais.append({"linha": i, "coluna": "Geral", "mensagem": f"Erro inesperado: {e}"})
            continue
    
    # --- LÓGICA DE INSERÇÃO DE CABEÇALHO CORRIGIDA ---
    dados_com_api.insert(0, cabecalho_final)
    if usar_api:
        salvar_cache_cep(cep_cache)
        
    return [], sorted(list(set(avisos))), erros_totais, correcoes_totais, dados_com_api, dados_originais

def validar_csv_completo(caminho_arquivo, header_map=None, usar_api=True):
    try:
        _, avisos, erros_totais, correcoes_totais, dados_com_api, dados_originais = validar_csv(caminho_arquivo, header_map, usar_api)
        return False, avisos, erros_totais, correcoes_totais, dados_com_api, dados_originais
    except Exception as e:
        traceback.print_exc()
        return False, [f"Erro inesperado no processamento do arquivo: {e}"], [], [], [], []

def validar_csv_conteudo(conteudo_csv, header_map=None, usar_api=True):
    if not conteudo_csv.strip(): return False, ["Conteúdo CSV vazio."], [], [], [], []
    return validar_csv_completo(StringIO(conteudo_csv), header_map, usar_api)