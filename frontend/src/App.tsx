import { useState, type FormEvent } from 'react'
import { ArrowRight, CircleAlert, Download, FileDown, LoaderCircle, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { ResultsSummary } from './components/ResultsSummary.tsx'
import { SupplierResults } from './components/SupplierResults.tsx'
import type { AnalysisResponse, RiskFilter, SupplierRow } from './types/analysis.ts'
import { parseCnpjLines } from './utils/cnpj.ts'
import { composeSupplierRows, filterSupplierRows, reclassifySupplierRows, summarizeSupplierRows } from './utils/analysis.ts'
import { serializeSupplierCsv, supplierCsvFilename } from './utils/csv.ts'
import { createSupplierPdfBlob } from './utils/pdf.ts'
import type { CnpjEntry } from './utils/cnpj.ts'
import { DEFAULT_RISK_CRITERIA, type RiskCriteria } from '../../shared/risk-engine.ts'

const starterInput = [
  '84046101000193',
  '60498706000157',
  '02003402002704',
  '77294254000194',
  '47067525000108',
  '02916265000160',
  '01838723000127',
  '03853896000140',
  '67620377000114',
  '08070508000178',
  '51466860000156',
  '92660604000182',
  '90810706000101',
  '60744463000190',
  '01844555000182',
  '55064562000190',
  '91495499000100',
  '79114450000165',
  '48662175000190',
  '89096457000155',
  '07628528000159',
  '45365558000109',
  '61156501000156',
  '22266175000188',
  '64904295000103',
  '00080671000100',
  '83310441000117',
  '88305859000150',
  '33229147000107',
  '61649810000168',
  '48539407000207',
  '07903169000109',
  '02734023000155',
  '89774160000100',
  '91495549000150',
  '77863223000107',
  '37497237000130',
  '00058722000105',
  '84046101000192',
  '17262213000194',
  '05808085000152',
  '05765061000163',
  '16616292000121',
  '01151850000153',
  '40954048000153',
  '34071059000192',
  '37637139000150',
  '15009061000197',
].join('\n')

const refusalCriteria: Array<{ key: keyof RiskCriteria; label: string }> = [
  { key: 'rejectInvalidCnpj', label: 'CNPJ inválido / dígito verificador inválido' },
  { key: 'rejectBaixada', label: 'Situação cadastral = BAIXADA' },
  { key: 'rejectInapta', label: 'Situação cadastral = INAPTA' },
  { key: 'rejectReceitaNotFound', label: 'CNPJ não encontrado na Receita' },
]

const reviewCriteria: Array<{ key: keyof RiskCriteria; label: string }> = [
  { key: 'reviewIbamaAuto', label: 'Auto de Infração IBAMA encontrado' },
  { key: 'reviewIbamaEmbargo', label: 'Área Embargada IBAMA encontrada' },
  { key: 'reviewUndetermined', label: 'Informação crítica não determinada (NA)' },
]

function RiskCriteriaOptions({
  criteria,
  disabled,
  onChange,
}: {
  criteria: RiskCriteria
  disabled: boolean
  onChange: (criterion: keyof RiskCriteria) => void
}) {
  return (
    <div className="risk-criteria__groups">
      <fieldset className="risk-criteria__group">
        <legend>RECUSAR fornecedor quando</legend>
        {refusalCriteria.map(({ key, label }) => (
          <label className="risk-criteria__option" key={key}>
            <input type="checkbox" checked={criteria[key]} disabled={disabled} onChange={() => onChange(key)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="risk-criteria__group">
        <legend>REVISAR fornecedor quando</legend>
        {reviewCriteria.map(({ key, label }) => (
          <label className="risk-criteria__option" key={key}>
            <input type="checkbox" checked={criteria[key]} disabled={disabled} onChange={() => onChange(key)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}

type AnalysisState = {
  rows: SupplierRow[]
  duplicates: CnpjEntry[]
}

function App() {
  const [input, setInput] = useState(starterInput)
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)
  const [riskCriteria, setRiskCriteria] = useState<RiskCriteria>(() => ({ ...DEFAULT_RISK_CRITERIA }))
  const [filter, setFilter] = useState<RiskFilter>('TODOS')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [pdfError, setPdfError] = useState('')

  const inputCount = input.split(/\r?\n/).filter((line) => line.trim()).length
  const summary = analysis
    ? summarizeSupplierRows(analysis.rows, analysis.duplicates.length)
    : null
  const visibleRows = analysis
    ? filterSupplierRows(analysis.rows, filter)
    : []
  const showResults = Boolean(analysis || isLoading || requestError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const batch = parseCnpjLines(input)
    setAnalysis(null)
    setFilter('TODOS')
    setRequestError('')
    setPdfError('')

    if (batch.entries.length === 0) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/ibama/cnpjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: batch.entries.map((entry) => entry.original), riskCriteria }),
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

  function updateRiskCriterion(criterion: keyof RiskCriteria) {
    setRiskCriteria((current) => ({ ...current, [criterion]: !current[criterion] }))
  }

  function recalculateRisk() {
    if (!analysis || isLoading || isGeneratingPdf) return
    setAnalysis((current) => current
      ? { ...current, rows: reclassifySupplierRows(current.rows, riskCriteria) }
      : current)
  }

  function clearInput() {
    setInput('')
    setAnalysis(null)
    setFilter('TODOS')
    setRequestError('')
    setPdfError('')
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

  async function exportPdf() {
    if (!analysis || analysis.rows.length === 0 || isLoading || isGeneratingPdf) return

    setIsGeneratingPdf(true)
    setPdfError('')
    try {
      const { blob, filename } = await createSupplierPdfBlob(analysis.rows, analysis.duplicates)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.')
    } finally {
      setIsGeneratingPdf(false)
    }
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

        <div className={`analysis-layout${analysis ? ' analysis-layout--results' : ' analysis-layout--setup'}`}>
          {!analysis && (
          <section className="input-panel input-panel--setup" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">CNPJs para análise</h2>
              <p>Um CNPJ por linha; máscara opcional.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="setup-fields">
                <div className="cnpj-entry-field">
                  <label className="field-label" htmlFor="cnpj-list">
                    Lista de fornecedores
                    <span>{inputCount} {inputCount === 1 ? 'informado' : 'informados'}</span>
                  </label>
                  <textarea
                    id="cnpj-list"
                    name="cnpjs"
                    value={input}
                    disabled={isLoading || isGeneratingPdf}
                    onChange={(event) => {
                      setInput(event.target.value)
                      setAnalysis(null)
                      setRequestError('')
                      setPdfError('')
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
                      disabled={!input || isLoading || isGeneratingPdf}
                      title="Limpar lista"
                      aria-label="Limpar lista de CNPJs"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <section className="risk-criteria" aria-labelledby="risk-criteria-title">
                  <h3 id="risk-criteria-title">Critérios de risco</h3>
                  <RiskCriteriaOptions
                    criteria={riskCriteria}
                    disabled={isLoading || isGeneratingPdf}
                    onChange={updateRiskCriterion}
                  />
                </section>
              </div>
              <button className="submit-button" type="submit" disabled={!inputCount || isLoading || isGeneratingPdf}>
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
          )}

          {analysis && (
            <section className="analysis-controls" aria-label="Análise atual">
              <div className="analysis-controls__summary">
                <div>
                  <p>ANÁLISE CONCLUÍDA</p>
                  <strong>{summary?.total ?? 0} {summary?.total === 1 ? 'fornecedor analisado' : 'fornecedores analisados'}</strong>
                </div>
                <button className="compact-action compact-action--primary" type="button" onClick={clearInput} disabled={isLoading || isGeneratingPdf}>
                  <Plus size={15} aria-hidden="true" />
                  <span>Nova análise</span>
                </button>
              </div>
              <details className="risk-criteria-disclosure">
                <summary>Critérios de risco</summary>
                <div className="risk-criteria-disclosure__body">
                  <RiskCriteriaOptions
                    criteria={riskCriteria}
                    disabled={isLoading || isGeneratingPdf}
                    onChange={updateRiskCriterion}
                  />
                  <button className="compact-action" type="button" onClick={recalculateRisk} disabled={isLoading || isGeneratingPdf}>
                    <RotateCcw size={14} aria-hidden="true" />
                    <span>Recalcular</span>
                  </button>
                </div>
              </details>
            </section>
          )}

          {showResults && <section className="results-panel" aria-labelledby="analysis-title" aria-busy={isLoading}>
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

            {pdfError && (
              <div className="error-message" role="alert">
                <strong>Não foi possível gerar o PDF.</strong>
                <span>{pdfError}</span>
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
                    <button className="export-button" onClick={exportPdf} type="button" disabled={isGeneratingPdf || isLoading}>
                      {isGeneratingPdf ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <FileDown size={16} aria-hidden="true" />}
                      <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Exportar PDF'}</span>
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
          </section>}
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