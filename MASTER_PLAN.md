# TARKEN --- CASE DE DUE DILIGENCE DE FORNECEDORES

## MASTER PLAN v0.15

**Status:** Em execução\
**Última atualização:** 29/09/2026\
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

Autos de Infração e Áreas Embargadas são evidências complementares, mas têm
significados distintos. `tem_embargo_ibama` representa exclusivamente
embargo confirmado pela fonte de Áreas Embargadas. Autos de Infração não
confirmam nem descartam embargo e, isoladamente, não alteram a classificação.

| Autos de Infração | Áreas Embargadas | `tem_embargo_ibama` |
| --- | --- | --- |
| NÃO | NÃO | NÃO |
| SIM | NÃO | NÃO |
| ERROR | NÃO | NÃO |
| NÃO | ERROR | NA |
| ERROR | ERROR | NA |
| qualquer resultado | SIM | SIM |

O campo `resultado_ambiental`, quando apresentado, é uma consolidação geral
de evidências e não substitui `tem_embargo_ibama` na classificação. Assim,
Autos `NÃO` com Embargos `ERROR` pode resultar em `resultado_ambiental = NÃO`,
mas `tem_embargo_ibama` continua `NA` e a decisão é `REVISAR`.

O status individual de cada fonte deve ser preservado. Em particular,
Autos `ERROR` com Áreas Embargadas `NÃO` mantém o erro dos Autos, sem
transformá-lo em ausência. `ERROR` ou `NA` da fonte de Áreas Embargadas não
pode ser convertido em `NÃO`.

Exemplo de evidência complementar sem embargo confirmado:

``` text
Autos = SIM
Embargos = NÃO
tem_embargo_ibama = NÃO
```

Quando a fonte de Áreas Embargadas está indisponível, a ausência de Auto de
Infração não permite determinar se há embargo:

``` text
Autos = NÃO
Embargos = ERROR
tem_embargo_ibama = NA
```

Se ambas as fontes estiverem em `ERROR`, `tem_embargo_ibama` é `NA`. Se a
fonte de Áreas Embargadas confirmar embargo, `tem_embargo_ibama` é `SIM`,
independentemente do resultado de Autos.

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

-   há embargo confirmado pela fonte de Áreas Embargadas;
-   `tem_embargo_ibama` é `NA`;
-   informação crítica necessária para aprovação não pôde ser
    confirmada;
-   Receita retorna `ERROR` sem condição de `RECUSAR`;
-   existir indicador definido no escopo que exija análise manual.

## APROVAR

Quando:

-   CNPJ válido;
-   Receita consultada com `SUCCESS` e empresa encontrada;
-   situação ATIVA;
-   `tem_embargo_ibama` é `NÃO`;
-   nenhuma informação crítica necessária para a decisão está indeterminada;
-   nenhum bloqueio definido pela regra.

Toda classificação deve possuir:

`motivo_classificacao`

### Prioridade

Aplicar as condições nesta prioridade: `RECUSAR` > `REVISAR` > `APROVAR`.
Nunca converter `ERROR` ou `NA` em `NÃO`.

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

`🟢 CONCLUÍDA`

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

`🟢 CONCLUÍDA`

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

`🟢 CONCLUÍDA`

### CHECKPOINT — ETAPA 8

Status: CONCLUÍDA
Data: 29/09/2026
Commit: não realizado.
Implementação: PDF consolidado em A4 landscape, com uma tabela de seis colunas
(CNPJ, Razão Social, Situação Cadastral, Telefone, Embargo e Classificação de
Risco). A coluna Embargo usa exclusivamente `tem_embargo_ibama`; não há páginas
individuais por fornecedor.
Geração: PDFs curto e longo gerados pelo fluxo da aplicação. O curto tem 1
página. O longo usa os 48 CNPJs iniciais do App e tem 48 registros em 3 páginas.
O cenário contém 47 CNPJs válidos, 1 inválido e nenhuma duplicidade; foi usado
um fixture local de API para evitar consultas em lote. PDFs preservados em
`artifacts/etapa8-visual-review/`.
Consistência: a tela apresentou 48 fornecedores: 16 APROVAR, 16 REVISAR e
16 RECUSAR. O CSV contém 48 registros com as mesmas classificações. Com o
filtro REVISAR ativo, a tela mostrou 16 registros e as exportações mantiveram o
conjunto completo. O CSV foi exportado em memória para comparação; não houve
alteração do código ou do contrato CSV.
Casos representados: CNPJ inválido, situações INAPTA e BAIXADA e embargo
confirmado. Testes unitários confirmam a tabela única, seis colunas, ordem,
classificação recebida, mapeamento de `tem_embargo_ibama`, cabeçalho repetível e
rodapé paginado.
Testes realizados: `npm test` — 87/87 aprovados; E2E CSV/PDF — 7/7 aprovados em
12,0 s; lint frontend, builds frontend e backend e `git diff --check` aprovados.
Limitação visual: validação visual NÃO DISPONÍVEL. O ambiente não tinha
renderizador/visualizador PDF; o Chromium iniciou um download em vez de
renderizar. Nenhuma ferramenta foi instalada e não houve inspeção visual.
Legibilidade e ausência de cortes não foram visualmente comprovadas.
Observação do build: alerta de chunks acima de 500 kB associado aos bundles
PDF/fontes; não bloqueou o build.
Resultado: implementação automatizada aprovada; geração consolidada e
multipágina validada estruturalmente; consistência tela/CSV validada. A
limitação de validação visual permanece registrada, sem afirmar inspeção visual.

### Evidência de execução real ponta a ponta

Data: 29/09/2026
Execução: análise feita pela interface da aplicação, sem interceptação ou
fixtures; o frontend usou o backend real já ativo. As consultas foram feitas às
três fontes públicas para os CNPJs abaixo.

| CNPJ | Razão Social | BrasilAPI | IBAMA Autos | IBAMA Embargos | Classificação |
| --- | --- | --- | --- | --- | --- |
| 84046101000193 | BUNGE ALIMENTOS S/A | SUCCESS / ATIVA | SUCCESS / SIM | SUCCESS / NÃO | APROVAR |
| 60498706000157 | CARGILL AGRICOLA S A | SUCCESS / ATIVA | SUCCESS / SIM | SUCCESS / NÃO | APROVAR |
| 01838723000127 | BRF S.A. | SUCCESS / ATIVA | SUCCESS / SIM | SUCCESS / SIM | REVISAR |

Resultado na tela: 3 fornecedores; 2 APROVAR e 1 REVISAR. Todos os resultados
das consultas reais chegaram à resposta consolidada e à tela.
Downloads: CSV `due-diligence-fornecedores-2026-09-29.csv` e PDF
`due-diligence-fornecedores-2026-09-29.pdf` baixados pela interface. O CSV foi
lido e confirmou os três CNPJs e respectivos status/classificações. O PDF foi
lido e confirmou os três CNPJs, razões sociais, cabeçalhos, classificações e
Embargo Não/Não/Sim.
Arquivos: downloads salvos temporariamente em `/tmp`; não fazem parte da
entrega do repositório. Nenhum arquivo do projeto foi alterado durante essa
execução real.

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

O PDF de referência é material de referência para estrutura, dados e
validação, não uma regra normativa de classificação. Os dados do case não
precisam ser idênticos aos do PDF; divergências são aceitáveis quando seu
racional estiver explicado.

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
  6 --- Interface     🟢
  7 --- CSV           🟢
  8 --- PDF           🟢
  9 --- Testes        ⬜                                    
  10 --- Entrega      ⬜                                    

Status permitidos:

-   `⬜ PENDENTE`
-   `🟡 EM ANDAMENTO`
-   `🟢 CONCLUÍDA`
-   `🔴 BLOQUEADA`

------------------------------------------------------------------------

# 16. HISTÓRICO DE VERSÕES

## v0.15 --- 29/09/2026

### Distinção de CNPJ/Receita e validação do Recalcular

-   **Versão anterior:** v0.14
-   **Nova versão:** v0.15
-   **Data:** 29/09/2026
-   **Motivo:** registrar a investigação e cobertura da distinção entre CNPJ
  estruturalmente inválido e Receita `NOT_FOUND`, além da verificação do
  recálculo local com critérios atuais.
-   **Alteração:** checkpoint registra que a avaliação estrutural usa
  `validateNormalizedCnpj`, separada de `status_receita === NOT_FOUND`; `NA` e
  `ERROR` não são tratados como não encontrado. Matriz unitária cobre os estados
  e a prioridade RECUSAR > REVISAR > APROVAR. A revisão do handler confirmou uso
  dos critérios atuais em operação local; não se reproduziu estado stale nem
  chamada de fonte no Recalcular, portanto sua função não foi reescrita. E2E e
  validação real registram recálculo sem novo POST e preservação dos detalhes.
-   **Impacto:** baixo; ajuste focal no classificador compartilhado/contrato de
  critérios e cobertura, sem mudança nas APIs externas ou na coleta.
-   **Decisão:** aprovada.

### CHECKPOINT — DISTINÇÃO CNPJ/RECEITA E RECALCULAR

Status: CONCLUÍDO
Data: 29/09/2026
Commit: não realizado.
Investigação CNPJ: estruturalmente inválido é determinado exclusivamente por
`validateNormalizedCnpj(input.cnpj)` e controlado por `rejectInvalidCnpj`;
Receita não encontrado é determinado exclusivamente por
`status_receita === NOT_FOUND` e controlado por `rejectReceitaNotFound`. `ERROR`
e `NA` da Receita continuam distintos de `NOT_FOUND`. O modelo/backend já
preservavam essa distinção; o risco era a cobertura insuficiente da interação
entre critérios configuráveis, estado estrutural e estado da Receita.
Investigação Recalcular: o handler já usava o estado React atual de critérios e
chamava somente `reclassifySupplierRows` sobre resultados armazenados. Não foi
reproduzido uso de estado stale nem chamada HTTP; a correção do fluxo não exigiu
reescrever o botão. A configuração também é enviada em Analyze e a rota executa
as consultas antes de aplicar o classificador.
Implementação/testes: `RiskInput` compartilhado conserva CNPJ e status da Receita
como sinais independentes; critérios configurados alimentam o avaliador puro.
Testes incluem CNPJ inválido com critério ligado/desligado, `NOT_FOUND` ligado/
desligado, Receita SUCCESS/ERROR/NA, prioridade junto a Auto SIM e execução de
Receita/IBAMA com todos os critérios desativados.
Testes realizados: `npm test` — 98/98 aprovados; E2E — 10/10 aprovados; lint
frontend, builds frontend/backend e `git diff --check` aprovados.
Validação real: BUNGE ALIMENTOS S/A (`84046101000193`) retornou Receita
SUCCESS/ATIVA, Autos SUCCESS/SIM e Embargos SUCCESS/NÃO. Analyze resultou em
REVISAR; desativar Autos não recalculou imediatamente; Recalcular mudou para
APROVAR; reativar Autos e recalcular retornou a REVISAR. A contagem permaneceu
em um POST de análise e os dados SIM/SUCCESS de Autos continuaram nos detalhes.
Resultado: CNPJ estrutural inválido e não encontrado na Receita tratados como
condições independentes; `ERROR`/`NA` não viram `NOT_FOUND`; Recalcular local
aplica os critérios atuais sem nova consulta. Prioridade preservada.
Limitação: quando `reviewUndetermined` está desativado, `ERROR`/`NA` não acionam
REVISAR apenas por indeterminação, conforme critério configurável opcional.
Etapa 9 permanece PENDENTE.

## v0.14 --- 29/09/2026

### Refinamento visual da listagem e detalhes

-   **Versão anterior:** v0.13
-   **Nova versão:** v0.14
-   **Data:** 29/09/2026
-   **Motivo:** reduzir a densidade visual de evidências e status na tabela sem
  remover informação do modelo ou dos detalhes.
-   **Alteração:** sucesso é representado por ícone pequeno junto ao resultado;
  `NA`/`ERROR` continuam distintos e textuais. Cabeçalhos foram compactados,
  linhas e botão Detalhes reduzidos e painéis de fonte mostram resultado e status
  técnico em campos separados. Classificação, motivo e detalhe foram preservados.
-   **Impacto:** baixo; apresentação somente, sem alteração de regras,
  classificação, consultas, dados, CSV, PDF ou arquitetura.
-   **Decisão:** aprovada.

## v0.13 --- 29/09/2026

### Organização visual dos estados da análise

-   **Versão anterior:** v0.12
-   **Nova versão:** v0.13
-   **Data:** 29/09/2026
-   **Motivo:** aproveitar melhor a largura disponível antes e depois da análise
  e separar visualmente a configuração da consulta dos resultados.
-   **Alteração:** estado inicial horizontal para CNPJs e critérios; após análise,
  resumo compacto, ação Nova análise, critérios recolhidos e resultados em largura
  total. Controles responsivos e alturas de botões alinhadas; filtros, exportações,
  detalhes e lógica de recálculo preservados.
-   **Impacto:** baixo; reorganização visual sem alteração de consultas, regras
  de classificação, critérios ou exportações.
-   **Decisão:** aprovada.

## v0.12 --- 29/09/2026

### Critérios de risco configuráveis e recálculo local

-   **Versão anterior:** v0.11
-   **Nova versão:** v0.12
-   **Data:** 29/09/2026
-   **Motivo:** separar a coleta de dados da classificação configurável e permitir
  reaplicar critérios sem consultar novamente as fontes.
-   **Alteração:** adicionados critérios de RECUSAR/REVISAR, classificador puro
  compartilhado e botão `Recalcular` local. `Analisar fornecedores` continua
  consultando Receita, Autos e Embargos sempre, independentemente dos critérios;
  a classificação é aplicada aos resultados coletados. Edição dos checkboxes não
  recalcula automaticamente. Critérios padrão: RECUSAR por CNPJ inválido,
  BAIXADA e INAPTA; REVISAR por Autos SIM e Embargos SIM. NOT_FOUND e informação
  indeterminada iniciam desabilitados. `ERROR` e `NA` permanecem distintos. Sem
  alteração da classificação após abrir/fechar detalhes; CSV/PDF continuam usando
  a classificação atual dos resultados.
-   **Impacto:** médio; classificação passou a depender dos critérios enviados
  na análise ou explicitamente aplicados localmente, sem alteração nas consultas,
  fontes, arquitetura ou regra de prioridade.
-   **Decisão:** aprovada.

### CHECKPOINT — CRITÉRIOS DE RISCO CONFIGURÁVEIS

Status: CONCLUÍDO
Data: 29/09/2026
Commit: não realizado.
Implementação: configuração simples de critérios no painel existente. A coleta
e a classificação são separadas por `classifyRiskWithCriteria`; o backend aplica
os critérios após concluir as consultas. O botão `Recalcular` usa apenas os
resultados guardados no estado da análise e não faz `fetch`.
Defaults: RECUSAR para CNPJ inválido, BAIXADA e INAPTA; REVISAR para Auto de
Infração SIM e Área Embargada SIM. CNPJ `NOT_FOUND` e informação indeterminada
(`NA`/`ERROR`) começam desabilitados e podem ser habilitados pelo usuário.
Prioridade: critérios de RECUSAR são avaliados antes dos de REVISAR; sem critério
acionado, APROVAR. Evidências, status, erros e detalhes coletados são preservados
quando a classificação muda.
Testes realizados: `npm test` — 95/95 aprovados; E2E — 9/9 aprovados; lint
frontend e builds frontend/backend aprovados; `git diff --check` aprovado. E2E
verifica edição sem recálculo automático, mudança de classificação ao clicar
`Recalcular`, permanência do Auto nos detalhes e exatamente uma chamada de análise.
Consulta das fontes: teste de rota com critérios desabilitados confirma que os
clientes Receita e IBAMA continuam sendo chamados. A rota IBAMA delega à mesma
IbamaService que consulta Autos e Embargos.
Validação real: BUNGE ALIMENTOS S/A (`84046101000193`) consultada pela interface,
BrasilAPI `SUCCESS`/ATIVA, Autos `SUCCESS`/SIM e Embargos `SUCCESS`/NÃO. Com Autos
habilitado, resultado REVISAR; com Autos desabilitado e após `Recalcular`, APROVAR.
O detalhe manteve Autos SIM/SUCCESS e Embargos NÃO/SUCCESS. Uma única requisição
POST de análise foi observada; nenhuma chamada adicional ocorreu ao recalcular.
Limitações: dados individuais e contagens dos registros IBAMA não são preservados
no modelo atual. O critério opcional de indeterminação trata status `ERROR` como
revisão quando habilitado, sem converter status/evidência em `NÃO`.
Resultado: critérios editáveis aplicados somente sob ação explícita; recálculo
local validado e consultas independentes dos critérios preservadas.

## v0.11 --- 29/09/2026

### Transparência de detalhes do fornecedor

-   **Versão anterior:** v0.10
-   **Nova versão:** v0.11
-   **Data:** 29/09/2026
-   **Motivo:** registrar a validação e cobertura da visualização dos dados
  preservados pelas três fontes em cada fornecedor.
-   **Alteração:** checkpoint documenta o painel de detalhes existente, novo
  E2E de abertura/fechamento e distinção de `SUCCESS`, `NA` e `ERROR`, além da
  validação real pela interface. Limitações dos campos não preservados pelo
  contrato atual foram registradas sem ampliar o backend.
-   **Impacto:** baixo; teste e documentação, sem mudança de classificação,
  consultas, modelo de dados, backend, CSV, PDF ou arquitetura.
-   **Decisão:** aprovada.

## v0.11 --- 29/09/2026

### Transparência de detalhes do fornecedor

-   **Versão anterior:** v0.10
-   **Nova versão:** v0.11
-   **Data:** 29/09/2026
-   **Motivo:** registrar a validação e cobertura da visualização dos dados
  preservados pelas três fontes em cada fornecedor.
-   **Alteração:** checkpoint documenta o painel de detalhes existente, novo
  E2E de abertura/fechamento e distinção de `SUCCESS`, `NA` e `ERROR`, além da
  validação real pela interface. Limitações dos campos não preservados pelo
  contrato atual foram registradas sem ampliar o backend.
-   **Impacto:** baixo; teste e documentação, sem mudança de classificação,
  consultas, modelo de dados, backend, CSV, PDF ou arquitetura.
-   **Decisão:** aprovada.

## v0.10 --- 29/09/2026

### Registro da validação real ponta a ponta

-   **Versão anterior:** v0.9
-   **Nova versão:** v0.10
-   **Data:** 29/09/2026
-   **Motivo:** registrar a execução real pela interface e a verificação dos
  arquivos exportados com resultados das fontes públicas.
-   **Alteração:** adicionada evidência para três CNPJs com BrasilAPI, Autos e
  Embargos em `SUCCESS`; resultados consolidados vistos na tela e confirmados
  nos downloads CSV/PDF. Downloads foram temporários e nenhum arquivo do projeto
  foi alterado durante a validação.
-   **Impacto:** baixo; registro de evidência, sem mudança de código, regras de
  negócio, integrações ou contrato de dados.
-   **Decisão:** aprovada.

## v0.9 --- 29/09/2026

### Registro final do PDF consolidado da Etapa 8

-   **Versão anterior:** v0.8
-   **Nova versão:** v0.9
-   **Data:** 29/09/2026
-   **Motivo:** registrar a atualização do PDF para o formato consolidado e as
  evidências finais da Etapa 8.
-   **Alteração:** checkpoint atualizado com tabela única de seis colunas em
  A4 landscape, 48 registros em três páginas e cenário curto em uma página;
  testes, E2E e consistência tela/CSV registrados. A validação visual foi
  explicitamente marcada como não disponível, pois o Chromium iniciou download
  em vez de renderizar o PDF. Nenhuma inspeção visual é alegada.
-   **Impacto:** baixo; documentação da apresentação PDF e das evidências,
  sem alteração de regras de negócio, backend, integrações ou CSV.
-   **Decisão:** aprovada.

## v0.8 --- 28/09/2026

### Fechamento formal da Etapa 8 com limitação visual registrada

-   **Versão anterior:** v0.7
-   **Nova versão:** v0.8
-   **Data:** 28/09/2026
-   **Motivo:** registrar os testes, a geração multipágina e a consistência
  da Etapa 8, encerrando formalmente a etapa conforme decisão do projeto.
-   **Alteração:** Etapa 8 marcada como concluída; checkpoint registra os
  resultados de testes e builds, PDFs e CSV preservados, cenário de 48 CNPJs,
  consistência entre tela e CSV, validação pontual da BrasilAPI e alerta de
  tamanho dos bundles. A ausência de ferramenta de renderização visual e a
  falta de comprovação visual de legibilidade/cortes foram explicitadas.
-   **Impacto:** baixo; atualização documental sem alteração de código,
  arquitetura ou regras de negócio.
-   **Decisão:** aprovada com a limitação visual registrada.

## v0.7 --- 28/09/2026

### Registro das regras definitivas de classificação

-   **Versão anterior:** v0.6
-   **Nova versão:** v0.7
-   **Data:** 28/09/2026
-   **Motivo:** registrar explicitamente as regras de classificação e o
  significado específico de `tem_embargo_ibama` definidos para o case.
-   **Alteração:** documentadas a separação entre Autos de Infração e Áreas
  Embargadas, a matriz de consolidação do embargo, a prioridade das decisões,
  a preservação de `ERROR`/`NA` e a natureza não normativa do PDF de referência.
  Incluída cobertura de testes para Autos `SIM` sem embargo e fonte de
  Embargos indeterminada.
-   **Impacto:** baixo; documentação e testes, sem alteração de comportamento
  do Risk Engine, integração ou arquitetura.
-   **Decisão:** aprovada.

## v0.6 --- 28/09/2026

### Fechamento formal da Etapa 7

-   **Versão anterior:** v0.5
-   **Nova versão:** v0.6
-   **Data:** 28/09/2026
-   **Motivo:** registrar a conclusão da exportação CSV após implementação e
  auditoria estrutural.
-   **Alteração:** atualização do status da Etapa 7 e registro do formato,
  validações e risco conhecido; nenhum escopo futuro foi alterado.
-   **Impacto:** baixo; exportação operacional sem alteração do contrato API,
  backend, Risk Engine ou regras de negócio.
-   **Decisão:** aprovada.

## v0.5 --- 28/09/2026

### Fechamento formal da Etapa 6

-   **Versão anterior:** v0.4
-   **Nova versão:** v0.5
-   **Data:** 28/09/2026
-   **Motivo:** registrar a conclusão da interface de resultados após validação.
-   **Alteração:** atualizar o status da Etapa 6 e registrar implementação e
  evidências; nenhum escopo ou regra de etapas anteriores/futuras foi alterado.
-   **Impacto:** baixo; conclusão da apresentação visual, sem mudança de negócio.
-   **Decisão:** aprovada.

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

CHECKPOINT — ETAPA 6

Status: CONCLUÍDA
Data: 28/09/2026
Commit: feat: complete results interface
Implementação: resultados consolidados apresentados na UI com resumo APROVAR,
REVISAR e RECUSAR; inválidos contabilizados como RECUSAR; duplicados excluídos
dos totais; filtro somente por classificação; detalhes do fornecedor com
identificação, Receita, Autos, Áreas Embargadas, decisão, motivo e data.
Evidências/status: Receita, Autos e Embargos apresentados individualmente;
`SIM`, `NÃO` e `NA` permanecem distintos de `SUCCESS`, `ERROR` e `NOT_FOUND`.
Motivos ficam visíveis na lista principal. Testes Playwright confirmaram resumo,
filtro, detalhes, inválidos, `NOT_FOUND` e preservação de `ERROR`/`NA`.
Validação visual: desktop 1440x1000 e mobile 390x844; página sem overflow
horizontal. Console errors=[] e page errors=[].
Fontes reais: fluxo integrado exibiu Receita `ERROR` por HTTP 403 da BrasilAPI,
Autos `SUCCESS` + `NÃO` e Embargos `SUCCESS` + `NÃO`; `ERROR` não foi convertido
em `NOT_FOUND` ou `NÃO`. O HTTP 403 foi comportamento externo observado no
ambiente de validação, não falha de código.
Testes realizados: `npm test` — 71/71 aprovados; lint frontend aprovado; builds
frontend e backend aprovados; `git diff --check` aprovado; Playwright aprovado.
Resultado: critérios de apresentação da Etapa 6 validados. Backend e Risk Engine
não foram alterados; regras de negócio e contrato da API foram preservados.
Pendências: Etapa 7 não iniciada; CSV e PDF permanecem nas etapas seguintes.
Decisões: totais calculados a partir de `results + invalid`, com duplicados fora;
classificação consumida do backend, sem regra de risco no frontend. Etapa 7
permanece pendente.

CHECKPOINT — ETAPA 7

Status: CONCLUÍDA
Data: 28/09/2026
Commit: docs: close csv export stage
Implementação: exportação CSV no frontend a partir dos resultados carregados,
sem nova rota. Uma linha por fornecedor avaliado; fonte dos dados preservada e
objetos CNAE/endereço achatados. Arquivo delimitado por `;`, UTF-8 com BOM,
registros CRLF e escaping de aspas, delimitadores e quebras de linha.
Estrutura: 31 colunas auditadas por parse estrutural; todas as linhas mantêm a
mesma quantidade de campos. `SIM`/`NÃO`/`NA` e `SUCCESS`/`ERROR`/`NOT_FOUND`
permanecem distintos. Nulos são células vazias. CNPJs inválidos são exportados
como RECUSAR, sem status de fonte inventado. Duplicados não geram linhas; a
quantidade descartada é preservada por CNPJ. O CSV não depende do filtro visual.
Evidência: testes estruturais recuperaram zeros à esquerda, acentos, `;`, aspas,
quebras de linha, CNAE, endereço, classificações e motivos. Playwright confirmou
download, nome/data, BOM, conteúdo integral com filtro aplicado, cenário somente
inválidos e ausência de download após falha total.
Testes realizados: `npm test` — 78/78 aprovados; lint frontend aprovado; builds
frontend e backend aprovados; `git diff --check` aprovado; Playwright — 3/3
aprovados.
Resultado: gates e critérios da Etapa 7 aprovados.
Risco conhecido: formula injection não é mitigada; valores-fonte são preservados
sem transformação silenciosa e podem ser interpretados como fórmula por
planilhas se começarem por caracteres de fórmula. O cenário de falha de rede
forçada no Playwright produz a mensagem de recurso abortado do Chromium; sucesso
e fluxo somente-inválidos não produziram erros de console ou page errors.
Pendências: Etapa 8 não iniciada; PDF permanece pendente.
Decisões: backend, Risk Engine, contrato API e regras de classificação não foram
alterados. Etapa 8 permanece pendente.

------------------------------------------------------------------------

CHECKPOINT — DETALHES DO FORNECEDOR

Status: CONCLUÍDO
Data: 29/09/2026
Commit: não realizado.
Objetivo: permitir a inspeção dos dados e estados das fontes já preservados
para cada fornecedor, mantendo visível a classificação atual.
Implementação: reutilizado o detalhe expansível inline existente na linha do
fornecedor, com ação `Detalhes`/`Fechar`; nenhuma alteração de código de
produção, endpoint, integração, classificação ou modelo de dados foi necessária.
Dados exibidos: CNPJ informado e normalizado, razão social, situação, data de
abertura, CNAE, endereço, telefone, status/erro da Receita e data da consulta;
Autos e Áreas Embargadas exibem evidência `SIM`/`NÃO`/`NA`, status da fonte e
erro quando existente. CNPJ inválido continua sem consultas e com classificação
RECUSAR.
Limitações do contrato atual: BrasilAPI não preserva nome fantasia, data da
situação cadastral, natureza jurídica ou e-mail. IBAMA preserva somente
evidência agregada por CNPJ, status e erro; registros individuais e contagens
dos autos/embargos não são carregados pelo backend e, portanto, não são exibidos.
Testes: `npm test` — 87/87 aprovados; E2E total — 8/8 aprovados, incluindo
abertura/fechamento, dados das fontes, `SUCCESS`/`ERROR`/`NA`, inválido e
classificação inalterada; lint frontend, builds frontend/backend e
`git diff --check` aprovados.
Validação real: BUNGE ALIMENTOS S/A (`84046101000193`) consultada pela interface
sem interceptação. BrasilAPI `SUCCESS`/ATIVA; Autos `SUCCESS`/SIM; Áreas
Embargadas `SUCCESS`/NÃO; detalhe mostrou os dados retornados e a classificação
permaneceu APROVAR após abrir e fechar.
Resultado: detalhes transparentes para o payload existente; não foi necessário
alterar produção nem regras de negócio. Não houve consulta a registros
individuais do IBAMA porque eles não estão preservados no modelo atual.

------------------------------------------------------------------------

CHECKPOINT — ORGANIZAÇÃO VISUAL DA ANÁLISE

Status: CONCLUÍDO
Data: 29/09/2026
Commit: não realizado.
Objetivo: separar visualmente entrada/configuração da análise concluída e liberar
largura para os resultados sem redesenhar a aplicação.
Implementação: antes da análise, CNPJs e critérios aparecem em uma composição
horizontal responsiva com a ação primária Analisar fornecedores. Após a análise,
a lista completa de CNPJs sai da lateral; são exibidos o total de fornecedores,
Nova análise e os critérios em disclosure compacto. A tabela/resumo ocupa a
largura disponível. Filtros, detalhes e exportações foram preservados; botões
Nova análise, Recalcular, CSV e PDF usam alturas consistentes.
Comportamento: Nova análise limpa resultados e entrada, retorna ao formulário e
não consulta fontes. Analisar fornecedores continua sendo a única ação que
consulta; alterar critérios não recalcula automaticamente e Recalcular continua
local sobre os resultados existentes.
Testes: `npm test` — 95/95 aprovados; E2E — 10/10 aprovados, incluindo largura
total, resumo, critérios compactos, Nova análise sem consulta automática, nova
consulta somente após Analyze, Recalcular, detalhes e exportações; lint frontend,
builds frontend/backend e `git diff --check` aprovados.
Validação visual: capturas dos estados inicial e pós-análise em desktop
(1440×1000) e mobile (390×844) revisadas. `scrollWidth` correspondeu à largura
da viewport em ambos os tamanhos; entrada se reorganiza em telas menores e a
tabela mantém a largura desktop disponível.
Resultado: os dois estados estão separados visualmente; nenhuma regra de risco,
consulta, detalhe, CSV ou PDF foi alterada.

------------------------------------------------------------------------

CHECKPOINT — REFINAMENTO VISUAL DA LISTAGEM E DETALHES

Status: CONCLUÍDO
Data: 29/09/2026
Commit: não realizado.
Implementação: SUCCESS aparece como ícone pequeno junto a ATIVA/SIM/NÃO; NA e
ERROR mantêm rótulos distintos e CNPJ inválido mantém aviso próprio. Ambiental
continua exibindo `resultado_ambiental`. A classificação e o motivo seguem em
destaque. Cabeçalhos simplificados para Embargos e Risco, células mais compactas
e botão Detalhes reduzido com chevrons de abrir/fechar. Detalhes separam o valor
de negócio do Status da consulta e continuam mostrando SUCCESS/ERROR.
Testes: `npm test` — 95/95 aprovados; E2E — 10/10 aprovados; lint frontend,
builds frontend/backend e `git diff --check` aprovados. E2E confirma detalhe,
filtros, CSV/PDF e ausência de mudança nas classificações.
Validação visual: listagem e detalhes revisados em capturas desktop 1440x1000 e
mobile 390x844. Sem overflow horizontal; o botão Detalhes mediu 26 px de altura.
Capturas temporárias em `/tmp`, não incluídas no repositório.
Resultado: redução de caixas/badges na listagem, estados técnicos ainda
identificáveis por ícone e texto, e conteúdo técnico completo preservado nos
detalhes. Risk Engine, critérios, consultas e exportações não foram alterados.

------------------------------------------------------------------------

# 20. REGRA FINAL

O projeto deve continuar simples.

A pergunta que deve ser feita antes de adicionar qualquer coisa é:

> "Isso melhora diretamente a demonstração do case da Tarken?"

Se a resposta for não, não adicionar.

O objetivo final é uma solução pequena, funcional, explicável e bem
apresentada --- não uma aplicação de produção.
