import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { parseCnpjLines, type CnpjBatch } from './utils/cnpj.ts'

type IbamaStatus = 'SUCCESS' | 'ERROR'
type IbamaEvidence = 'SIM' | 'NÃO' | 'NA'
type SourceStatus = IbamaStatus | 'NOT_SENT' | 'PENDING'

type IbamaResult = {
  cnpj: string
  ibama_auto_infracao: IbamaEvidence
  status_ibama_auto: IbamaStatus
  error_ibama_auto?: string
  ibama_embargo: IbamaEvidence
  status_ibama_embargo: IbamaStatus
  error_ibama_embargo?: string
  resultado_ambiental: IbamaEvidence
}

const sourceStatusLabels: Record<SourceStatus, string> = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  NOT_SENT: 'NÃO ENVIADO',
  PENDING: 'AGUARDANDO',
}

const starterInput = [
  '11.222.333/0001-81',
  '11222333000181',
  '11.222.333/0001-82',
  '123',
  'texto sem números',
].join('\n')

function App() {
  const [input, setInput] = useState(starterInput)
  const [batch, setBatch] = useState<CnpjBatch | null>(null)
  const [ibamaResults, setIbamaResults] = useState<IbamaResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')

  const inputCount = input.split(/\r?\n/).filter((line) => line.trim()).length
  const ibamaByCnpj = new Map(ibamaResults.map((result) => [result.cnpj, result]))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseCnpjLines(input)
    setBatch(parsed)
    setIbamaResults([])
    setRequestError('')

    if (parsed.valid.length === 0) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/ibama/cnpjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: parsed.valid.map((entry) => entry.cnpj) }),
      })
      const payload = (await response.json()) as {
        results?: IbamaResult[]
        error?: string
      }

      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(payload.error ?? 'O backend IBAMA retornou uma resposta inesperada.')
      }

      setIbamaResults(payload.results)
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o backend IBAMA.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function clearInput() {
    setInput('')
    setBatch(null)
    setIbamaResults([])
    setRequestError('')
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
            <span>Etapa 4 · IBAMA</span>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span>04</span> / CONSULTA AMBIENTAL</p>
            <h1 id="page-title">Evidências do IBAMA</h1>
            <p className="page-heading__description">
              Consulte Autos de Infração e Áreas Embargadas por CNPJ.
            </p>
          </div>
          <div className="heading-stamp" aria-label="Protótipo visual">
            <span className="heading-stamp__icon"><BadgeCheck size={16} /></span>
            <span>Fontes independentes</span>
          </div>
        </section>

        <aside className="demo-banner" aria-label="Aviso sobre dados demonstrativos">
          <span className="demo-banner__icon"><Sparkles size={17} /></span>
          <p>
            <strong>Processamento no backend.</strong> Os datasets não são enviados ao
            navegador; somente evidências e status por CNPJ são retornados.
          </p>
          <span className="demo-banner__tag">API</span>
        </aside>

        <div className="analysis-layout">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">Lista de CNPJs</h2>
              <p>Insira um CNPJ por linha; a validação local filtra a consulta.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="cnpj-list">
                CNPJs para análise
                <span>{inputCount} {inputCount === 1 ? 'informado' : 'informados'}</span>
              </label>
              <textarea
                id="cnpj-list"
                name="cnpjs"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  setBatch(null)
                  setIbamaResults([])
                  setRequestError('')
                }}
                rows={7}
                spellCheck={false}
                aria-describedby="input-note"
              />
              <div className="input-actions">
                <span className="input-note" id="input-note">
                  Máscara opcional; pontuação é removida e linhas vazias ignoradas.
                </span>
                <button
                  className="clear-button"
                  type="button"
                  onClick={clearInput}
                  disabled={!input}
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
                <span>{isLoading ? 'Consultando IBAMA' : 'Consultar fontes IBAMA'}</span>
              </button>
            </form>
            <p className="input-panel__footnote">
              <CircleAlert size={14} />
              Apenas CNPJs válidos e únicos são enviados pelo backend às duas fontes.
            </p>
          </section>

          <section className="results-panel" aria-labelledby="results-title" aria-live="polite">
            <div className="results-heading">
              <div>
                <div className="panel-kicker"><span>02</span><span>RESULTADOS</span></div>
                <h2 id="results-title">Resultado das fontes</h2>
              </div>
              {batch && (
                <div className="result-count">{batch.informedCount} {batch.informedCount === 1 ? 'entrada avaliada' : 'entradas avaliadas'}</div>
              )}
            </div>

            {requestError && (
              <div className="error-message" role="alert">
                <strong>Status das fontes: ERROR.</strong> {requestError}. Nenhuma ausência de evidência foi presumida.
              </div>
            )}

            {batch && batch.entries.length > 0 ? (
              <>
                <div className="summary-strip" aria-label="Resumo da consulta">
                  <div className="summary-item summary-item--total">
                    <span className="summary-item__label">Informados</span>
                    <strong>{batch.informedCount.toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--approve">
                    <span className="summary-item__label">Válidos</span>
                    <strong>{batch.valid.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--review">
                    <span className="summary-item__label">Inválidos</span>
                    <strong>{batch.invalid.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--refuse">
                    <span className="summary-item__label">Duplicados removidos</span>
                    <strong>{batch.duplicates.length.toString().padStart(2, '0')}</strong>
                  </div>
                </div>

                <div className="table-frame">
                  <table>
                    <caption className="visually-hidden">Resultados e status independentes das duas fontes IBAMA</caption>
                    <thead>
                      <tr>
                        <th scope="col">CNPJ / entrada</th>
                        <th scope="col">Validação</th>
                        <th scope="col">Autos</th>
                        <th scope="col">Status Autos</th>
                        <th scope="col">Embargos</th>
                        <th scope="col">Status Embargos</th>
                        <th scope="col">Ambiental</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.entries.map((entry, index) => {
                        const result = entry.status === 'valid'
                          ? ibamaByCnpj.get(entry.cnpj)
                          : undefined
                        const autoStatus: SourceStatus =
                          entry.status !== 'valid'
                            ? 'NOT_SENT'
                            : result?.status_ibama_auto ?? (requestError ? 'ERROR' : 'PENDING')
                        const embargoStatus: SourceStatus =
                          entry.status !== 'valid'
                            ? 'NOT_SENT'
                            : result?.status_ibama_embargo ?? (requestError ? 'ERROR' : 'PENDING')
                        const autoResult = result?.ibama_auto_infracao ??
                          (requestError && entry.status === 'valid' ? 'NA' : '—')
                        const embargoResult = result?.ibama_embargo ??
                          (requestError && entry.status === 'valid' ? 'NA' : '—')
                        const environmentalResult = result?.resultado_ambiental ??
                          (requestError && entry.status === 'valid' ? 'NA' : '—')

                        return (
                          <tr className="result-row" key={`${entry.cnpj}-${index}`}>
                            <td className="original-cell">
                              <strong>{entry.cnpj || '—'}</strong>
                              <small>{entry.original}</small>
                            </td>
                            <td>
                              <span className={`validation-badge validation-badge--${entry.status}`}>
                                {entry.status === 'valid' && <BadgeCheck size={13} />}
                                {entry.status === 'invalid' && <CircleAlert size={13} />}
                                {entry.status === 'duplicate' && <ClipboardList size={13} />}
                                {entry.status === 'valid' ? 'VÁLIDO' : entry.status === 'invalid' ? 'INVÁLIDO' : 'DUPLICADO'}
                              </span>
                              {entry.reason && <small className="entry-reason">{entry.reason}</small>}
                            </td>
                            <td><span className={`evidence-badge evidence-badge--${autoResult === '—' ? 'empty' : autoResult === 'NÃO' ? 'nao' : autoResult.toLowerCase()}`}>{autoResult}</span></td>
                            <td>
                              <span className={`source-badge source-badge--${autoStatus.toLowerCase()}`}>
                                {sourceStatusLabels[autoStatus]}
                              </span>
                              {result?.error_ibama_auto && <small className="source-error">{result.error_ibama_auto}</small>}
                              {requestError && entry.status === 'valid' && <small className="source-error">{requestError}</small>}
                            </td>
                            <td><span className={`evidence-badge evidence-badge--${embargoResult === '—' ? 'empty' : embargoResult === 'NÃO' ? 'nao' : embargoResult.toLowerCase()}`}>{embargoResult}</span></td>
                            <td>
                              <span className={`source-badge source-badge--${embargoStatus.toLowerCase()}`}>
                                {sourceStatusLabels[embargoStatus]}
                              </span>
                              {result?.error_ibama_embargo && <small className="source-error">{result.error_ibama_embargo}</small>}
                              {requestError && entry.status === 'valid' && <small className="source-error">{requestError}</small>}
                            </td>
                            <td><span className={`evidence-badge evidence-badge--${environmentalResult === '—' ? 'empty' : environmentalResult === 'NÃO' ? 'nao' : environmentalResult.toLowerCase()}`}>{environmentalResult}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="results-footnote">
                  <ShieldCheck size={14} />
                  Status técnicos permanecem separados de SIM, NÃO e NA; não há classificação de risco nesta etapa.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon"><ClipboardList size={22} /></div>
                <h3>As evidências aparecerão aqui</h3>
                <p>Valide a lista para consultar as duas fontes ambientais pelo backend.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="page-footer">
          <span>TARKEN <span className="footer-dot">·</span> CASE DE DUE DILIGENCE</span>
          <span>Autos + Embargos <span className="footer-dot">·</span> sem Risk Engine</span>
        </footer>
      </main>
    </div>
  )
}

export default App
