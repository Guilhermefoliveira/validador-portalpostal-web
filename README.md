# Validador e Corretor de CSV - Portal Postal

## 📜 Descrição

Este é um aplicativo web desenvolvido para validar, corrigir e padronizar arquivos de planilha (`.csv`) antes de serem enviados para a plataforma Portal Postal. 
A ferramenta analisa os dados, corrige formatos inválidos de campos como CEP e CPF/CNPJ, valida endereços e ajuda a prevenir erros de importação.

O projeto foi construído com um backend em Python (usando Flask) e um frontend interativo com HTML, CSS e JavaScript.

---

## ✨ Funcionalidades Principais

* **Correção Automática:** Corrige automaticamente a formatação de campos como CEP, CPF/CNPJ, Telefone e Chave de NF-e.
* **Validação de Endereços:** Utiliza APIs externas para consultar CEPs, validando e corrigindo informações de endereço (Rua, Bairro, Cidade e UF).
* **Interface Interativa:** Permite a visualização dos dados originais, dos erros encontrados e das correções sugeridas em abas separadas.
* **Edição Manual:** Oferece a funcionalidade de duplo-clique para editar qualquer célula diretamente na tabela de visualização.
* **Exportação:** Gera um novo arquivo `.csv` contendo apenas as linhas selecionadas e já com todas as correções aplicadas.
* **Ferramenta Dedicada:** Inclui um corretor específico para arquivos de postagem do "Correios Atende" que possuem problemas estruturais.

---

## 🚀 Como Usar

1.  **Acesse a Aplicação:** Abra o site do validador no seu navegador.
2.  **Carregue o Arquivo:** Na tela principal, clique em "Procurar Arquivo..." e selecione o arquivo `.csv` que deseja validar.
3.  **Mapeie as Colunas:** Associe as colunas do seu arquivo com as colunas esperadas pelo sistema. A aplicação tentará fazer o mapeamento automático.
4.  **Valide:** Clique no botão "Validar Arquivo" para iniciar o processo.
5.  **Analise e Exporte:** Revise os resultados nas abas, faça edições manuais se necessário e clique em "Baixar CSV Corrigido" para obter o arquivo final.

---

*Este projeto foi desenvolvido com a assistência de IA Gemini.*
