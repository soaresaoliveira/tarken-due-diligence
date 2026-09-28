# TARKEN --- CASE DE DUE DILIGENCE DE FORNECEDORES

## MASTER PLAN v0.4

**Status:** Em execução\
**Última atualização:** 28/09/2026\
**Responsável:** Gabriel\
**Objetivo:** Construir o case técnico solicitado pela Tarken, com
escopo enxuto, foco em integração de fontes públicas, consolidação de
dados, classificação de risco e geração de CSV/PDF.

------------------------------------------------------------------------

# 1. REGRA DE GOVERNANÇA DO PROJETO

Este documento é a **fonte de verdade do projeto**.

## 1.1 Versionamento

Todo planejamento deve possuir uma versão.

Formato:

`vMAJOR.MINOR`

Exemplos:

-   `v0.1` --- baseline inicial
-   `v0.2` --- pequena alteração de escopo/processo
-   `v1.0` --- planejamento final aprovado para implementação

## 1.2 Regra de alteração

O planejamento **não deve ser alterado silenciosamente**.

Qualquer alteração deverá registrar:

-   versão anterior;
-   nova versão;
-   data;
-   motivo;
-   impacto;
-   decisão.

Exemplo:

``` text
HISTÓRICO DE ALTERAÇÃO

Versão: v0.1 → v0.2
Data: 28/09/2026
Motivo: [descrever]
Alteração: [descrever]
Impacto: [baixo/médio/alto]
Decisão: [aprovado/rejeitado]
```

## 1.3 Regra de execução

Uma etapa somente será considerada concluída quando:

-   implementação realizada;
-   teste executado;
-   resultado validado;
-   critério de aceite atendido;
-   status atualizado neste documento.

Não avançar deliberadamente deixando uma etapa crítica incompleta.

## 1.4 Mudanças durante o desenvolvimento

Se a IA de desenvolvimento sugerir algo fora do plano:

1.  não aceitar automaticamente;
2.  registrar a sugestão;
3.  avaliar necessidade;
4.  decidir se entra no escopo;
5.  caso entre, atualizar a versão do Master Plan;
6.  registrar a justificativa.

------------------------------------------------------------------------

# 2. OBJETIVO DO CASE

Construir uma pequena aplicação web que receba uma lista de CNPJs,
consulte três fontes públicas, consolide os dados, classifique cada
fornecedor em:

-   APROVAR
-   REVISAR
-   RECUSAR

e permita:

-   visualizar os resultados;
-   baixar CSV;
-   gerar PDF.

O foco da avaliação é demonstrar:

-   entendimento das fontes;
-   integração;
-   normalização;
-   merge;
-   tratamento de erros;
-   diferença entre NÃO e NA;
-   redundância das fontes do IBAMA;
-   regra de decisão;
-   capacidade de transformar dados em relatório útil.

------------------------------------------------------------------------

# 3. ESCOPO

## 3.1 Obrigatório

-   Entrada de múltiplos CNPJs.
-   Normalização dos CNPJs.
-   Validação do dígito verificador.
-   Consulta à BrasilAPI.
-   Consulta ao IBAMA --- Autos de Infração.
-   Consulta ao IBAMA --- Áreas/Termos Embargados.
-   Normalização das respostas.
-   Merge por CNPJ.
-   Classificação de risco.
-   Motivo da classificação.
-   Visualização dos resultados.
-   Exportação CSV.
-   Geração PDF.
-   Tratamento de erros.
-   Registro do status das fontes.
-   README.
-   Testes dos principais cenários.

## 3.2 Fora do escopo do MVP

-   Banco de dados.
-   Login.
-   Autenticação.
-   Usuários.
-   Permissões.
-   Histórico persistido.
-   Pagamentos.
-   Microsserviços.
-   Filas complexas.
-   Kubernetes.
-   IA generativa dentro do produto.
-   Quarta fonte de dados.
-   Dashboard analítico complexo.
-   Infraestrutura de produção.

------------------------------------------------------------------------

# 4. FONTES

## 4.1 Receita Federal / BrasilAPI

Endpoint:

`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`

Dados esperados, quando disponíveis:

-   CNPJ;
-   razão social;
-   situação cadastral;
-   data de abertura;
-   CNAE;
-   endereço;
-   telefone.

A integração deve tratar:

-   CNPJ inválido;
-   CNPJ não encontrado;
-   erro HTTP;
-   timeout;
-   resposta incompleta;
-   indisponibilidade.

------------------------------------------------------------------------

## 4.2 IBAMA --- Autos de Infração

Fonte indicada no briefing:

`https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SIFISC/auto_infracao/auto_infracao/auto_infracao_csv.zip`

Objetivo:

-   identificar registros relacionados ao CNPJ;
-   normalizar o identificador;
-   registrar status da fonte;
-   não interpretar falha como ausência de ocorrência.

------------------------------------------------------------------------

## 4.3 IBAMA --- Áreas Embargadas

Fonte indicada no briefing:

`https://servicos.ibama.gov.br/ctf/publico/areasembargadas/arquivos/areas_embargadas.csv`

Objetivo:

-   identificar registros de embargo relacionados ao CNPJ;
-   utilizar como fonte complementar;
-   permitir redundância em relação à fonte de Autos de Infração.

------------------------------------------------------------------------

# 5. REGRA FUNDAMENTAL DE DADOS

## SIM

A fonte foi consultada com sucesso e foi encontrada evidência.

## NÃO

A fonte foi consultada com sucesso e não foi encontrada evidência.

## NA

Não foi possível determinar o resultado.

Exemplos:

-   timeout;
-   HTTP error;
-   arquivo indisponível;
-   erro de parsing;
-   falha de processamento.

### Regra

Nunca transformar:

`ERROR → NÃO`

------------------------------------------------------------------------

# 6. CONSOLIDAÇÃO DO IBAMA

As duas fontes do IBAMA serão tratadas como evidências complementares.

Exemplo:

``` text
Autos = ERROR
Embargos = NÃO
Resultado ambiental = NÃO
```

desde que a fonte disponível permita concluir a dimensão avaliada.

Outro exemplo:

``` text
Autos = ERROR
Embargos = ERROR
Resultado ambiental = NA
```

A implementação deve registrar os estados individuais das fontes, mesmo
quando houver um resultado consolidado.

------------------------------------------------------------------------

# 7. REGRAS DE CLASSIFICAÇÃO

## RECUSAR

Quando:

-   CNPJ inválido;
-   CNPJ não encontrado na Receita;
-   situação cadastral INAPTA;
-   situação cadastral BAIXADA.

## REVISAR

Quando:

-   empresa ATIVA possui embargo;
-   informação crítica necessária para aprovação não pôde ser
    confirmada;
-   existir indicador definido no escopo que exija análise manual.

## APROVAR

Quando:

-   CNPJ válido;
-   empresa encontrada;
-   situação ATIVA;
-   nenhuma evidência de embargo;
-   fontes críticas consultadas com sucesso;
-   nenhum bloqueio definido pela regra.

Toda classificação deve possuir:

`motivo_classificacao`

------------------------------------------------------------------------

# 8. ARQUITETURA

Arquitetura simples, sem banco.

``` text
CNPJs
  ↓
Frontend
  ↓
Backend/API
  ↓
┌───────────────┬─────────────────┬──────────────────┐
│ BrasilAPI     │ IBAMA Autos     │ IBAMA Embargos   │
└───────────────┴─────────────────┴──────────────────┘
  ↓
Normalização
  ↓
Merge por CNPJ
  ↓
Risk Engine
  ↓
Resultado
  ├── Tela
  ├── CSV
  └── PDF
```

Stack sugerida:

### Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   componentes simples

### Backend

-   Node.js
-   TypeScript
-   API HTTP simples

------------------------------------------------------------------------

# 9. ETAPAS DO PROJETO

------------------------------------------------------------------------

## ETAPA 0 --- Preparação e baseline

### Objetivo

Preparar repositório e ambiente de desenvolvimento.

### Atividades

-   Criar repositório GitHub.
-   Criar Codespace ou ambiente equivalente.
-   Criar projeto.
-   Criar README.
-   Registrar stack.
-   Registrar Master Plan.
-   Criar primeiro commit.

### Critério de aceite

-   Repositório acessível.
-   README presente.
-   Master Plan versionado.
-   Commit inicial realizado.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 1 --- Estrutura inicial e interface

### Objetivo

Ter a aplicação rodando com a estrutura visual inicial.

### Atividades

-   Criar frontend.
-   Criar backend.
-   Criar estrutura de pastas.
-   Criar tela inicial.
-   Criar campo para múltiplos CNPJs.
-   Criar botão de consulta.
-   Criar área de resultados vazia/mockada apenas para validar layout.

### Critério de aceite

-   Projeto abre no navegador.
-   Interface está utilizável.
-   CNPJs podem ser inseridos.
-   Nenhuma integração externa é necessária ainda.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 2 --- Entrada e validação de CNPJ

### Objetivo

Garantir que os CNPJs recebidos estejam normalizados e validados.

### Atividades

-   Aceitar CNPJ com máscara.
-   Aceitar CNPJ sem máscara.
-   Remover caracteres não numéricos.
-   Separar linhas.
-   Remover duplicados.
-   Validar quantidade de dígitos.
-   Validar dígito verificador.
-   Marcar CNPJ inválido.
-   Não consultar fontes externas para CNPJ obviamente inválido.

### Critério de aceite

Testar:

-   CNPJ válido com máscara.
-   CNPJ válido sem máscara.
-   CNPJ inválido.
-   Duplicado.
-   Linha vazia.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 3 --- Integração Receita / BrasilAPI

### Objetivo

Consultar e normalizar os dados cadastrais.

### Atividades

-   Implementar chamada.
-   Timeout.
-   Retry limitado.
-   Tratamento HTTP.
-   Tratamento de resposta inválida.
-   Normalização dos campos.
-   Status da consulta.
-   Tratamento de CNPJ não encontrado.

### Critério de aceite

Demonstrar:

-   empresa encontrada;
-   situação cadastral;
-   dados básicos;
-   erro tratado;
-   CNPJ inválido sem chamada desnecessária.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 4 --- Integração IBAMA

### Objetivo

Consultar e consolidar as duas fontes ambientais.

### Atividades

-   Baixar/consultar dataset de Autos.
-   Inspecionar estrutura real.
-   Identificar coluna de CNPJ.
-   Identificar encoding/separador/formato.
-   Normalizar CNPJ.
-   Fazer matching.
-   Implementar fonte de Embargos.
-   Fazer matching.
-   Registrar status individual das fontes.
-   Consolidar SIM/NÃO/NA.

### Critério de aceite

Demonstrar:

-   fornecedor sem registro;
-   fornecedor com registro;
-   erro de fonte;
-   redundância;
-   resultado SIM/NÃO/NA.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 5 --- Merge e Risk Engine

### Objetivo

Transformar dados de várias fontes em um resultado único por fornecedor.

### Atividades

-   Criar modelo consolidado.
-   Fazer merge por CNPJ.
-   Aplicar regras de classificação.
-   Gerar motivo.
-   Preservar evidências/status das fontes.

### Critério de aceite

Testar pelo menos:

-   ATIVA + sem embargo → APROVAR;
-   ATIVA + embargo → REVISAR;
-   INAPTA → RECUSAR;
-   BAIXADA → RECUSAR;
-   CNPJ inválido → RECUSAR;
-   fonte crítica indisponível → tratamento documentado.

### Status

`🟢 CONCLUÍDA`

------------------------------------------------------------------------

# ETAPA 6 --- Interface de resultados

### Objetivo

Apresentar o resultado de forma clara para o usuário.

### Atividades

-   Cards de resumo.
-   Total analisado.
-   Aprovar.
-   Revisar.
-   Recusar.
-   Tabela.
-   Filtros.
-   Badges.
-   Motivo.
-   Evidências/status das fontes.
-   Progresso durante consulta.
-   Mensagens de erro.

### Critério de aceite

Usuário consegue:

1.  inserir CNPJs;
2.  iniciar análise;
3.  acompanhar processamento;
4.  visualizar resultado;
5.  entender por que cada fornecedor recebeu sua classificação.

### Status

`⬜ PENDENTE`

------------------------------------------------------------------------

# ETAPA 7 --- CSV

### Objetivo

Entregar o arquivo operacional completo.

### Campos mínimos

-   cnpj
-   razao_social
-   situacao_cadastral
-   data_abertura
-   cnae
-   telefone
-   ibama_auto_infracao
-   ibama_embargo
-   tem_embargo_ibama
-   status_receita
-   status_ibama_auto
-   status_ibama_embargo
-   classificacao_risco
-   motivo_classificacao
-   data_consulta

### Critério de aceite

-   uma linha por CNPJ;
-   encoding correto;
-   dados completos;
-   download funcionando;
-   CNPJ inválido também representado com seu status.

### Status

`⬜ PENDENTE`

------------------------------------------------------------------------

# ETAPA 8 --- PDF

### Objetivo

Produzir versão curada para leitura humana.

### Estrutura

1.  Cabeçalho.
2.  Título.
3.  Data.
4.  Resumo.
5.  Indicadores.
6.  Tabela consolidada.
7.  Metodologia.
8.  Fontes.
9.  Observação sobre NA.

### Critério de aceite

-   PDF abre corretamente.
-   PDF é legível.
-   Tabela não fica cortada.
-   Paginação funciona.
-   Resumo bate com o CSV.
-   Classificações batem com a tela.

### Status

`⬜ PENDENTE`

------------------------------------------------------------------------

# ETAPA 9 --- Testes e estabilidade

### Objetivo

Garantir que o case possa ser demonstrado sem surpresas.

### Cenários obrigatórios

1.  Empresa ATIVA sem embargo.
2.  Empresa ATIVA com embargo.
3.  Empresa INAPTA.
4.  Empresa BAIXADA, se disponível no conjunto.
5.  CNPJ inválido.
6.  CNPJ não encontrado.
7.  Timeout.
8.  Erro HTTP.
9.  Dataset IBAMA indisponível.
10. Uma fonte IBAMA falha e outra funciona.
11. Ambas as fontes ambientais falham.
12. Múltiplos CNPJs.
13. CNPJ duplicado.
14. CNPJ com máscara.
15. Exportação CSV.
16. Geração PDF.

### Critério de aceite

Nenhum cenário crítico pode causar:

-   tela quebrada;
-   classificação silenciosamente incorreta;
-   erro escondido;
-   `ERROR` transformado em `NÃO`.

### Status

`⬜ PENDENTE`

------------------------------------------------------------------------

# ETAPA 10 --- Acabamento e entrega

### Objetivo

Preparar a apresentação e os arquivos finais.

### Atividades

-   Revisar UI.
-   Revisar mensagens.
-   Revisar PDF.
-   Revisar CSV.
-   Revisar README.
-   Remover código/testes temporários desnecessários.
-   Garantir build.
-   Garantir execução limpa.
-   Criar commit final.
-   Conferir repositório.
-   Conferir arquivos entregáveis.

### Entregáveis

-   URL do GitHub.
-   CSV consolidado.
-   PDF consolidado.
-   Código-fonte.

### Status

`⬜ PENDENTE`

------------------------------------------------------------------------

# 10. CONJUNTO DE TESTE

Usar inicialmente os mesmos CNPJs presentes no PDF de referência
fornecido pela Tarken.

O arquivo de referência contém exemplos de empresas ativas, empresas com
embargo, empresa inapta e CNPJ inválido.

Exemplos:

-   BUNGE ALIMENTOS S/A
-   CARGILL AGRICOLA S A
-   ADM DO BRASIL LTDA
-   AMAGGI EXPORTACAO E IMPORTACAO LTDA
-   BRF S.A.
-   JBS S/A
-   SLC AGRICOLA S.A.
-   ALCOPAN ALCOOL DO PANTANAL LTDA
-   MASTER AGROPECUARIA LTDA
-   CNPJ inválido `84046101000192`

A lista pode ser complementada para garantir cobertura dos cenários.

------------------------------------------------------------------------

# 11. ESTRUTURA DE DADOS CONSOLIDADA

Modelo conceitual:

``` json
{
  "cnpj": "",
  "razao_social": "",
  "situacao_cadastral": "",
  "data_abertura": "",
  "cnae": "",
  "telefone": "",
  "ibama_auto_infracao": "SIM|NÃO|NA",
  "ibama_embargo": "SIM|NÃO|NA",
  "tem_embargo_ibama": "SIM|NÃO|NA",
  "status_receita": "SUCCESS|ERROR|NOT_FOUND",
  "status_ibama_auto": "SUCCESS|ERROR",
  "status_ibama_embargo": "SUCCESS|ERROR",
  "classificacao_risco": "APROVAR|REVISAR|RECUSAR",
  "motivo_classificacao": "",
  "data_consulta": ""
}
```

A implementação pode ajustar nomes, desde que mantenha o significado.

------------------------------------------------------------------------

# 12. PRINCÍPIOS TÉCNICOS

1.  Simplicidade acima de complexidade.
2.  Fonte pública deve ser tratada como potencialmente indisponível.
3.  Erro não é ausência de ocorrência.
4.  Não esconder falha de consulta.
5.  Normalizar CNPJ antes de comparar.
6.  Não enviar datasets grandes ao browser.
7.  Não persistir dados sem necessidade.
8.  Manter rastreabilidade da origem.
9.  Regras de risco devem ser explícitas.
10. PDF e CSV devem representar o mesmo resultado consolidado.

------------------------------------------------------------------------

# 13. PRINCÍPIOS DE PRODUTO

1.  O usuário deve entender o resultado rapidamente.
2.  A classificação precisa ter explicação.
3.  Dados desconhecidos devem ser identificados.
4.  O relatório deve ser útil para uma pessoa de Compras.
5.  O PDF deve priorizar leitura humana.
6.  O CSV deve priorizar completude.
7.  A interface não deve esconder problemas das fontes.

------------------------------------------------------------------------

# 14. PERFUMARIA PERMITIDA

Somente depois do MVP estar funcionando.

Permitido:

-   cards de resumo;
-   badges;
-   ícones;
-   progresso;
-   seção de evidências;
-   pequena indicação de status das fontes;
-   visual profissional do PDF;
-   botão de nova análise.

Não permitido sem alteração formal do plano:

-   nova fonte;
-   banco;
-   login;
-   histórico;
-   autenticação;
-   novas regras de negócio significativas;
-   funcionalidades de produto não relacionadas ao case.

------------------------------------------------------------------------

# 15. CONTROLE DE ETAPAS

  Etapa               Status   Data conclusão   Evidência   Observação
  ------------------- -------- ---------------- ----------- ------------
  0 --- Preparação    🟢                                    
  1 --- Estrutura     🟢                                    
  2 --- CNPJ          🟢                                    
  3 --- Receita       🟢                                    
  4 --- IBAMA         🟢
  5 --- Merge/Risco   🟢
  6 --- Interface     ⬜                                    
  7 --- CSV           ⬜                                    
  8 --- PDF           ⬜                                    
  9 --- Testes        ⬜                                    
  10 --- Entrega      ⬜                                    

Status permitidos:

-   `⬜ PENDENTE`
-   `🟡 EM ANDAMENTO`
-   `🟢 CONCLUÍDA`
-   `🔴 BLOQUEADA`

------------------------------------------------------------------------

# 16. HISTÓRICO DE VERSÕES

## v0.4 --- 28/09/2026

### Fechamento formal da Etapa 5 e correção do enum de evidência

-   **Versão anterior:** v0.3
-   **Nova versão:** v0.4
-   **Data:** 28/09/2026
-   **Motivo:** registrar a conclusão da Etapa 5 e corrigir a grafia literal
  `NAO` para `NÃO` no modelo conceitual, conforme a representação canônica.
-   **Alteração:** status da Etapa 5 atualizado; checkpoint e evidências
  registrados; enum corrigido. Nenhum escopo futuro foi alterado.
-   **Impacto:** baixo; fechamento de etapa e correção documental, sem mudança
  das regras de negócio.
-   **Decisão:** aprovada.

## v0.3 --- 28/09/2026

### Fechamento formal da Etapa 4

-   **Versão anterior:** v0.2
-   **Nova versão:** v0.3
-   **Data:** 28/09/2026
-   **Motivo:** registrar a conclusão da Etapa 4 após validação técnica e
  atendimento do critério de aceite.
-   **Alteração:** atualização do status e registro das evidências da Etapa 4;
  nenhum escopo ou critério das etapas futuras foi alterado.
-   **Impacto:** baixo; atualização de andamento sem alteração de escopo.
-   **Decisão:** aprovada.

## v0.2 --- 28/09/2026

### Correção de consistência da Etapa 0

-   **Versão anterior:** v0.1
-   **Nova versão:** v0.2
-   **Data:** 28/09/2026
-   **Motivo:** alinhar o critério de aceite da Etapa 0 à sequência de
  implementação, pois ainda não existe aplicação nesta fase.
-   **Alteração:** removido o critério "Projeto abre no navegador" da Etapa 0;
  a abertura da aplicação permanece como critério da Etapa 1.
-   **Impacto:** baixo; correção de consistência, sem alteração de escopo.
-   **Decisão:** aprovada.

## v0.1 --- 28/09/2026

### Criação do Master Plan

Conteúdo inicial:

-   objetivo;
-   escopo;
-   fontes;
-   regras;
-   arquitetura;
-   etapas;
-   critérios de aceite;
-   controle de mudanças.

### Justificativa

Criar uma fonte de verdade para o desenvolvimento do case e impedir
expansão não controlada do escopo.

### Status

`APROVADA`

------------------------------------------------------------------------

# 17. REGISTRO DE DECISÕES

  ---------------------------------------------------------------------------
  ID             Data           Decisão        Justificativa   Impacto
  -------------- -------------- -------------- --------------- --------------
  DEC-001        28/09/2026     Não utilizar   O case não      Baixo
                                banco de dados exige           
                                no MVP         persistência;   
                                               reduz           
                                               complexidade    

  DEC-002        28/09/2026     Não adicionar  O briefing      Baixo
                                quarta fonte   exige três      
                                inicialmente   fontes; fonte   
                                               adicional será  
                                               apenas possível 
                                               melhoria futura 

  DEC-003        28/09/2026     Usar duas      O próprio       Médio
                                fontes do      briefing        
                                IBAMA como     recomenda       
                                redundância    redundância     

  DEC-004        28/09/2026     Separar NÃO de É um requisito  Alto
                                NA             explícito do    
                                               case            

  DEC-005        28/09/2026     Processar      Evita           Médio
                                datasets do    transferir      
                                IBAMA no       datasets        
                                backend        grandes para o  
                                               navegador       
  ---------------------------------------------------------------------------

------------------------------------------------------------------------

# 18. REGISTRO DE MUDANÇAS FUTURAS

Nenhuma mudança deve ser incorporada diretamente ao Master Plan.

Use este formato:

``` text
CHANGE REQUEST

ID:
Data:
Solicitante:
Versão atual:
Alteração proposta:
Motivo:
Benefício:
Impacto:
Risco:
Decisão:
Nova versão:
```

------------------------------------------------------------------------

# 19. CHECKPOINTS

Ao terminar cada etapa:

1.  Executar testes.
2.  Confirmar critério de aceite.
3.  Registrar status.
4.  Registrar data.
5.  Registrar evidência.
6.  Fazer commit Git.
7.  Não iniciar a próxima etapa sem confirmar a anterior.

Formato:

``` text
CHECKPOINT — ETAPA X

Status: CONCLUÍDA
Data:
Commit:
Testes realizados:
Resultado:
Pendências:
Decisões:
```

CHECKPOINT — ETAPA 1

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: create initial due diligence interface
Evidência: execução no Chromium em desktop (1440x1000) e mobile (390x844),
com duas entradas e duas linhas mockadas; endpoint de saúde local respondeu ok.
Testes realizados: lint do frontend; build do frontend e backend; API local
com duas entradas; fluxo Chromium com inserção de dois CNPJs e exibição de
resultados mockados em desktop e mobile.
Resultado: testes aprovados; sem erros de runtime ou console, sem requisições
externas e sem overflow horizontal na viewport móvel.
Pendências: Etapa 2 não iniciada.
Decisões: manter resultados fictícios e não consultar fontes nesta etapa.

CHECKPOINT — ETAPA 2

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: validate and normalize cnpjs
Evidência: teste browser do exemplo literal (5 entradas, 3 inválidas, 2 duplicadas)
e de CNPJ válido com máscara/sem máscara (1 válido único, 1 duplicado); zero
requisições API/externas; viewport mobile 390x844 sem overflow.
Testes realizados: 11 testes unitários; lint frontend; build frontend e backend;
teste Chromium com entradas mistas, duplicidade e entradas somente inválidas.
Resultado: testes aprovados; motivos exibidos para tamanho incorreto, texto sem
dígitos e falha de cada dígito verificador; BrasilAPI/IBAMA não chamados.
Pendências: Etapa 3 não iniciada.
Decisões: normalização e validação determinísticas no frontend, sem serviços externos.

CHECKPOINT — ETAPA 3

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: integrate brasilapi cnpj data
Evidência: 27 testes automatizados aprovados; Chromium confirmou payload ao backend
somente com CNPJ válido normalizado e exibiu SUCCESS, NOT_FOUND e ERROR via stub.
Consulta real controlada de 00.000.000/0001-91 chegou à BrasilAPI e recebeu HTTP 403;
frontend exibiu ERROR, sem chamadas externas diretas do browser.
Testes realizados: 11 do validador CNPJ; 12 do serviço BrasilAPI e 4 da rota HTTP;
lint; builds frontend/backend; teste Chromium com inválidos, duplicados e estados.
Resultado: status de consulta preservados; inválidos/duplicados não consultados;
API real inacessível neste ambiente (HTTP 403), sem retry para esse bloqueio.
Pendências: Etapa 4 não iniciada.
Decisões: retry único somente para erros transitórios configurados; 403, 404 e 429
não são repetidos. Nenhuma alteração de escopo; Master Plan permanece v0.2.

CHECKPOINT — ETAPA 4

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: integrate ibama environmental data
Critério de aceite: testes automatizados cobrem evidência positiva e ausência
de registro, falha independente de fonte, redundância e consolidação SIM/NÃO/NA.
Evidência: consulta real ao endpoint IBAMA retornou HTTP 200; Autos de Infração
e Áreas Embargadas retornaram SUCCESS + NÃO para o CNPJ válido. O segundo CNPJ
foi rejeitado por dígito verificador inválido. Ambos os datasets foram carregados
com sucesso. A resposta repetida, com índices carregados, levou aproximadamente
7 ms; a primeira chamada excedeu o limite de 30 s do cliente curl, e a duração
total do primeiro carregamento não foi medida. Smoke test real no Playwright
com frontend e backend integrados processou 5 linhas: 1 válida, 1 duplicada e
3 inválidas; console errors=[] e page errors=[].
Testes realizados: `npm test` (49 testes); `npm run lint --workspace @tarken/web`;
`npm run build` para frontend e backend; smoke test Playwright com fontes reais.
Resultado: todos os testes, lint, builds e smoke test passaram. `/api/health`
retornou HTTP 200 e o POST IBAMA retornou HTTP 200.
Pendências: Etapa 5 não iniciada.
Decisões: SUCCESS representa o estado técnico da fonte; SIM/NÃO representam
evidência positiva/negativa e NA representa resultado indeterminado. O primeiro
carregamento e indexação são assíncronos e podem aumentar a latência da primeira
consulta; sua duração não foi medida. Nenhuma alteração de escopo; Etapa 5
permanece pendente.

CHECKPOINT — ETAPA 5

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: add merge and risk classification
Merge: resultados de Receita, Autos e Embargos associados pelo CNPJ; dados e
status individuais das fontes preservados. `tem_embargo_ibama` representa somente
o resultado de Embargos. O Risk Engine é separado do merge e aplica prioridade
RECUSAR → REVISAR → APROVAR.
Regras: CNPJ inválido, Receita NOT_FOUND, INAPTA e BAIXADA resultam em RECUSAR;
embargo confirmado ou informação crítica não confirmada resultam em REVISAR;
APROVAR exige Receita SUCCESS/ATIVA e Embargos SUCCESS/NÃO. Autos não é bloqueio
isolado para aprovação. ERROR nunca é convertido em NÃO.
Evidência integrada: frontend HTTP 200; backend ativo e `/api/health` HTTP 200;
Playwright confirmou 2 resultados válidos únicos, 1 duplicidade normalizada e 1
CNPJ inválido. A API retornou classificação e motivo ao consumidor; a exibição
visual desses campos fica para a Etapa 6. Viewport mobile 390x844 sem overflow
horizontal da página. Console errors=[] e page errors=[].
Fontes reais: BrasilAPI respondeu HTTP 403 no ambiente de validação; o resultado
foi preservado como status_receita ERROR e classificado REVISAR, sem ser tratado
como NOT_FOUND ou NÃO. Autos e Embargos retornaram SUCCESS + NÃO. O CNPJ inválido
foi recusado com motivo próprio. O HTTP 403 é comportamento observado no
ambiente de validação, não uma falha de código.
Testes realizados: 30/30 testes determinísticos de IBAMA, Merge e Risk Engine;
67/67 testes na suíte completa; lint e builds frontend/backend aprovados;
contratos das rotas Receita e IBAMA verificados.
Resultado: testes, lint, builds, diff check e validação integrada aprovados.
Pendências: Etapa 6 não iniciada.
Decisões: manter `SUCCESS`/`ERROR` distintos de `SIM`/`NÃO`/`NA`; cenário de
aprovação e combinação Autos ERROR + Embargos NÃO confirmados pelos testes
determinísticos quando não produzidos naturalmente pelos dados públicos. Etapa 6
permanece pendente.

------------------------------------------------------------------------

# 20. REGRA FINAL

O projeto deve continuar simples.

A pergunta que deve ser feita antes de adicionar qualquer coisa é:

> "Isso melhora diretamente a demonstração do case da Tarken?"

Se a resposta for não, não adicionar.

O objetivo final é uma solução pequena, funcional, explicável e bem
apresentada --- não uma aplicação de produção.
