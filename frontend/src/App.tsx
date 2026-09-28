import { useState, type FormEvent } from 'react'
import { ArrowRight, CircleAlert, Download, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react'
import { ResultsSummary } from './components/ResultsSummary.tsx'
import { SupplierResults } from './components/SupplierResults.tsx'
import type { AnalysisResponse, RiskFilter, SupplierRow } from './types/analysis.ts'
import { parseCnpjLines } from './utils/cnpj.ts'
import { composeSupplierRows, filterSupplierRows, summarizeSupplierRows } from './utils/analysis.ts'
import { serializeSupplierCsv, supplierCsvFilename } from './utils/csv.ts'
import type { CnpjEntry } from './utils/cnpj.ts'

const starterInput = [
  '11.222.333/0001-81',
  '11222333000181',
  '11.222.333/0001-82',
  '123',
  'texto sem números',
].join('\n')

type AnalysisState = {
  rows: SupplierRow[]
  duplicates: CnpjEntry[]
}

function App() {
  const [input, setInput] = useState(starterInput)
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)
  const [filter, setFilter] = useState<RiskFilter>('TODOS')
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')

  const inputCount = input.split(/\r?\n/).filter((line) => line.trim()).length
  const summary = analysis
    ? summarizeSupplierRows(analysis.rows, analysis.duplicates.length)
    : null
  const visibleRows = analysis
    ? filterSupplierRows(analysis.rows, filter)
    : []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const batch = parseCnpjLines(input)
    setAnalysis(null)
    setFilter('TODOS')
    setRequestError('')

    if (batch.entries.length === 0) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/ibama/cnpjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: batch.entries.map((entry) => entry.original) }),
      })
      const payload = await response.json() as AnalysisResponse

      if (
        !response.ok ||
        !Array.isArray(payload.results) ||
        !Array.isArray(payload.invalid) ||
        !Array.isArray(payload.duplicates)
      ) {
        throw new Error(payload.error ?? 'A resposta do backend não contém todos os resultados esperados.')
      }

      const rows = composeSupplierRows(batch, payload)
      setAnalysis({ rows, duplicates: payload.duplicates })
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a consulta. Tente novamente.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function clearInput() {
    setInput('')
    setAnalysis(null)
    setFilter('TODOS')
    setRequestError('')
  }

  function exportCsv() {
    if (!analysis || analysis.rows.length === 0 || isLoading) return

    const blob = new Blob([serializeSupplierCsv(analysis.rows, analysis.duplicates)], {
      type: 'text/csv;charset=utf-8',
    })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = supplierCsvFilename()
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#inicio" aria-label="Tarken, início">
            <span className="brand__mark"><ShieldCheck size={20} strokeWidth={2.2} /></span>
            <span className="brand__wordmark">tarken<span>.</span></span>
            <span className="brand__divider" aria-hidden="true" />
            <span className="brand__product">due diligence</span>
          </a>
          <div className="environment-tag">
            <span className="environment-tag__dot" />
            <span>PROCUREMENT</span>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span>ANÁLISE</span> / FORNECEDORES</p>
            <h1 id="page-title">Due Diligence de Fornecedores</h1>
            <p className="page-heading__description">
              Informações cadastrais e ambientais consolidadas para apoiar a análise de Procurement.
            </p>
          </div>
        </section>

        <div className="analysis-layout">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">CNPJs para análise</h2>
              <p>Um CNPJ por linha; máscara opcional.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="cnpj-list">
                Lista de fornecedores
                <span>{inputCount} {inputCount === 1 ? 'informado' : 'informados'}</span>
              </label>
              <textarea
                id="cnpj-list"
                name="cnpjs"
                value={input}
                disabled={isLoading}
                onChange={(event) => {
                  setInput(event.target.value)
                  setAnalysis(null)
                  setRequestError('')
                }}
                rows={7}
                spellCheck={false}
                aria-describedby="input-note"
              />
              <div className="input-actions">
                <span className="input-note" id="input-note">
                  Linhas vazias são ignoradas; duplicidades são consolidadas.
                </span>
                <button
                  className="clear-button"
                  type="button"
                  onClick={clearInput}
                  disabled={!input || isLoading}
                  title="Limpar lista"
                  aria-label="Limpar lista de CNPJs"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <button className="submit-button" type="submit" disabled={!inputCount || isLoading}>
                {isLoading ? (
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                ) : (
                  <ArrowRight size={17} aria-hidden="true" />
                )}
                <span>{isLoading ? 'Consultando fontes' : 'Analisar fornecedores'}</span>
              </button>
            </form>
            <p className="input-panel__footnote">
              <CircleAlert size={14} />
              CNPJs inválidos são avaliados sem consulta às fontes externas.
            </p>
          </section>

          <section className="results-panel" aria-labelledby="analysis-title" aria-busy={isLoading}>
            <div className="results-heading">
              <div>
                <div className="panel-kicker"><span>02</span><span>ANÁLISE</span></div>
                <h2 id="analysis-title">Resultado consolidado</h2>
              </div>
            </div>

            {isLoading && (
              <div className="loading-state" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
                <span>Consultando Receita e fontes IBAMA…</span>
              </div>
            )}

            {requestError && (
              <div className="error-message" role="alert">
                <strong>Não foi possível concluir a consulta.</strong>
                <span>{requestError}</span>
                <span>Os resultados das fontes não foram presumidos.</span>
              </div>
            )}

            {summary && analysis && (
              <>
                <ResultsSummary summary={summary} />
                {analysis.rows.length > 0 && !isLoading && (
                  <div className="export-actions">
                    <button className="export-button" onClick={exportCsv} type="button">
                      <Download size={16} aria-hidden="true" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                )}
                <SupplierResults rows={visibleRows} filter={filter} onFilterChange={setFilter} />
              </>
            )}

            {!summary && !isLoading && !requestError && (
              <div className="empty-state">
                <h3>A análise aparecerá aqui</h3>
                <p>Informe os CNPJs para consultar as fontes e visualizar a classificação consolidada.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="page-footer">
          <span>TARKEN <span className="footer-dot">·</span> DUE DILIGENCE DE FORNECEDORES</span>
          <span>Receita <span className="footer-dot">·</span> IBAMA</span>
        </footer>
      </main>
    </div>
  )
}

export default App