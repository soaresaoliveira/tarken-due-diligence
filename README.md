# Tarken - Due Diligence de Fornecedores

Case técnico para analisar fornecedores a partir de uma lista de CNPJs,
consolidar dados públicos e classificar riscos como **APROVAR**, **REVISAR**
ou **RECUSAR**. O resultado previsto inclui visualização dos dados e exportação
em CSV e PDF.

## Fontes

- BrasilAPI para dados cadastrais de CNPJ.
- IBAMA - Autos de Infração.
- IBAMA - Áreas/Termos Embargados.

## Stack planejada

- Frontend: React, TypeScript, Vite.
- Backend: Node.js e TypeScript, com API HTTP simples.

O projeto será desenvolvido por etapas. O [MASTER_PLAN.md](MASTER_PLAN.md) é a
fonte de verdade para escopo, decisões, critérios de aceite e andamento.

## Execução local

```sh
npm install
npm run dev
```

A aplicação valida CNPJs localmente e consulta a BrasilAPI e as duas fontes do
IBAMA por meio do backend. A Etapa 4 mantém os status técnicos separados dos
resultados ambientais (`SIM`, `NÃO`, `NA`).
