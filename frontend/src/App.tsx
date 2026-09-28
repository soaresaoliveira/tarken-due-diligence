import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'

type Classification = 'APROVAR' | 'REVISAR' | 'RECUSAR'

type DemoResult = {
  cnpj: string
  supplier: string
  segment: string
  signal: string
  classification: Classification
}

const starterInput = [
  '00.000.000/0001-00',
  '11.111.111/0001-11',
  '22.222.222/0001-22',
].join('\n')

function App() {
  const [input, setInput] = useState(starterInput)
  const [results, setResults] = useState<DemoResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const cnpjs = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  const countFor = (classification: Classification) =>
    results.filter((result) => result.classification === classification).length

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/mock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs }),
      })
      const payload = (await response.json()) as {
        results?: DemoResult[]
        error?: string
      }

      if (!response.ok || !payload.results) {
        throw new Error(payload.error ?? 'Não foi possível carregar a demonstração.')
      }

      setResults(payload.results)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao carregar os dados demonstrativos.',
      )
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  function clearInput() {
    setInput('')
    setResults([])
    setError('')
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
            <span>Etapa 1 · Demonstração</span>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span>01</span> / ANÁLISE DE FORNECEDORES</p>
            <h1 id="page-title">Visão inicial de fornecedores</h1>
            <p className="page-heading__description">
              Uma primeira leitura, organizada em um só lugar.
            </p>
          </div>
          <div className="heading-stamp" aria-label="Protótipo visual">
            <span className="heading-stamp__icon"><BadgeCheck size={16} /></span>
            <span>Protótipo visual</span>
          </div>
        </section>

        <aside className="demo-banner" aria-label="Aviso sobre dados demonstrativos">
          <span className="demo-banner__icon"><Sparkles size={17} /></span>
          <p>
            <strong>Ambiente demonstrativo.</strong> Não há validação de CNPJ nem
            consultas a fontes externas. Todos os resultados são fictícios.
          </p>
          <span className="demo-banner__tag">MOCK</span>
        </aside>

        <div className="analysis-layout">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">Lista de CNPJs</h2>
              <p>Insira um por linha para compor a demonstração.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="cnpj-list">
                CNPJs para análise
                <span>{cnpjs.length} {cnpjs.length === 1 ? 'linha' : 'linhas'}</span>
              </label>
              <textarea
                id="cnpj-list"
                name="cnpjs"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={6}
                spellCheck={false}
                aria-describedby="input-note"
              />
              <div className="input-actions">
                <span className="input-note" id="input-note">
                  Entradas de exemplo, sem verificação.
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
              <button className="submit-button" type="submit" disabled={!cnpjs.length || isLoading}>
                {isLoading ? (
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                ) : (
                  <ArrowRight size={17} aria-hidden="true" />
                )}
                <span>{isLoading ? 'Preparando demonstração' : 'Consultar fornecedores'}</span>
              </button>
            </form>
            <p className="input-panel__footnote">
              <CircleAlert size={14} />
              A consulta usa somente dados locais de demonstração.
            </p>
          </section>

          <section className="results-panel" aria-labelledby="results-title" aria-live="polite">
            <div className="results-heading">
              <div>
                <div className="panel-kicker"><span>02</span><span>RESULTADOS</span></div>
                <h2 id="results-title">Resumo da análise</h2>
              </div>
              {results.length > 0 && (
                <div className="result-count">{results.length} registros de demonstração</div>
              )}
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}

            {results.length > 0 ? (
              <>
                <div className="summary-strip" aria-label="Resumo demonstrativo">
                  <div className="summary-item summary-item--total">
                    <span className="summary-item__label">Recebidos</span>
                    <strong>{results.length.toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--approve">
                    <span className="summary-item__label">Aprovar</span>
                    <strong>{countFor('APROVAR').toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--review">
                    <span className="summary-item__label">Revisar</span>
                    <strong>{countFor('REVISAR').toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="summary-item summary-item--refuse">
                    <span className="summary-item__label">Recusar</span>
                    <strong>{countFor('RECUSAR').toString().padStart(2, '0')}</strong>
                  </div>
                </div>

                <div className="table-frame">
                  <table>
                    <caption className="visually-hidden">Resultados fictícios da demonstração</caption>
                    <thead>
                      <tr>
                        <th scope="col">Fornecedor demonstrativo</th>
                        <th scope="col">CNPJ informado</th>
                        <th scope="col">Sinal de teste</th>
                        <th scope="col">Resultado mockado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => (
                        <tr className="result-row" key={`${result.cnpj}-${index}`}>
                          <td>
                            <div className="supplier-cell">
                              <span className="supplier-cell__icon"><Building2 size={16} /></span>
                              <span>
                                <strong>{result.supplier}</strong>
                                <small>{result.segment}</small>
                              </span>
                            </div>
                          </td>
                          <td className="cnpj-cell">{result.cnpj}</td>
                          <td><span className="signal-label">{result.signal}</span></td>
                          <td>
                            <span className={`risk-badge risk-badge--${result.classification.toLowerCase()}`}>
                              <span className="risk-badge__dot" />
                              {result.classification}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="results-footnote">
                  <Sparkles size={14} />
                  Classificações e sinais são fixtures visuais, não representam avaliação real.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon"><ClipboardList size={22} /></div>
                <h3>Os registros aparecerão aqui</h3>
                <p>A tabela será preenchida com exemplos fictícios ao iniciar a demonstração.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="page-footer">
          <span>TARKEN <span className="footer-dot">·</span> CASE DE DUE DILIGENCE</span>
          <span>Interface de demonstração <span className="footer-dot">·</span> fontes não consultadas</span>
        </footer>
      </main>
    </div>
  )
}

export default App
