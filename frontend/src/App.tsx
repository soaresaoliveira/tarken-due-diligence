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

type ReceitaStatus = 'SUCCESS' | 'ERROR' | 'NOT_FOUND'

type ReceitaResult = {
  cnpj: string
  razao_social: string | null
  situacao_cadastral: string | null
  data_abertura: string | null
  cnae: { codigo: string | null; descricao: string | null } | null
  endereco: {
    cep: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    municipio: string | null
    uf: string | null
  } | null
  telefone: string | null
  status: ReceitaStatus
  error?: string
}

function formatAddress(address: ReceitaResult['endereco']) {
  if (!address) return '—'
  return Object.values(address).filter(Boolean).join(', ') || '—'
}

const sourceStatusLabels: Record<ReceitaStatus | 'NOT_SENT' | 'PENDING', string> = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  NOT_FOUND: 'NOT_FOUND',
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
  const [receitaResults, setReceitaResults] = useState<ReceitaResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')

  const inputCount = input.split(/\r?\n/).filter((line) => line.trim()).length
  const receitaByCnpj = new Map(receitaResults.map((result) => [result.cnpj, result]))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseCnpjLines(input)
    setBatch(parsed)
    setReceitaResults([])
    setRequestError('')

    if (parsed.valid.length === 0) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/receita/cnpjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: parsed.valid.map((entry) => entry.cnpj) }),
      })
      const payload = (await response.json()) as {
        results?: ReceitaResult[]
        error?: string
      }

      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(payload.error ?? 'O backend retornou uma resposta inesperada.')
      }

      setReceitaResults(payload.results)
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o backend. Status da fonte: ERROR.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function clearInput() {
    setInput('')
    setBatch(null)
    setReceitaResults([])
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
            <span>Etapa 3 · Receita</span>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span>03</span> / RECEITA FEDERAL</p>
            <h1 id="page-title">Consulta cadastral</h1>
            <p className="page-heading__description">
              Valide localmente e consulte os dados cadastrais da empresa.
            </p>
          </div>
          <div className="heading-stamp" aria-label="Protótipo visual">
            <span className="heading-stamp__icon"><BadgeCheck size={16} /></span>
            <span>Integração BrasilAPI</span>
          </div>
        </section>

        <aside className="demo-banner" aria-label="Aviso sobre dados demonstrativos">
          <span className="demo-banner__icon"><Sparkles size={17} /></span>
          <p>
            <strong>Consulta via backend.</strong> CNPJs são validados localmente;
            somente os válidos e únicos seguem para a BrasilAPI. IBAMA não é consultado.
          </p>
          <span className="demo-banner__tag">API</span>
        </aside>

        <div className="analysis-layout">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">Lista de CNPJs</h2>
              <p>Insira um CNPJ por linha; a consulta cadastral usa o backend.</p>
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
                  setReceitaResults([])
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
                <span>{isLoading ? 'Consultando BrasilAPI' : 'Consultar fornecedores'}</span>
              </button>
            </form>
            <p className="input-panel__footnote">
              <CircleAlert size={14} />
              Apenas CNPJs válidos são enviados pelo backend à BrasilAPI.
            </p>
          </section>

          <section className="results-panel" aria-labelledby="results-title" aria-live="polite">
            <div className="results-heading">
              <div>
                <div className="panel-kicker"><span>02</span><span>RESULTADOS</span></div>
                <h2 id="results-title">Resultado cadastral</h2>
              </div>
              {batch && (
                <div className="result-count">{batch.informedCount} {batch.informedCount === 1 ? 'entrada avaliada' : 'entradas avaliadas'}</div>
              )}
            </div>

            {requestError && (
              <div className="error-message" role="alert">
                <strong>Status da fonte: ERROR.</strong> {requestError}. Nenhuma ausência de cadastro foi presumida.
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
                    <caption className="visually-hidden">Validação local e dados cadastrais retornados pela BrasilAPI</caption>
                    <thead>
                      <tr>
                        <th scope="col">CNPJ / entrada</th>
                        <th scope="col">Status</th>
                        <th scope="col">Razão social</th>
                        <th scope="col">Situação</th>
                        <th scope="col">Abertura</th>
                        <th scope="col">CNAE</th>
                        <th scope="col">Endereço</th>
                        <th scope="col">Telefone</th>
                        <th scope="col">BrasilAPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.entries.map((entry, index) => {
                        const receita = entry.status === 'valid'
                          ? receitaByCnpj.get(entry.cnpj)
                          : undefined
                        const sourceStatus: ReceitaStatus | 'NOT_SENT' | 'PENDING' =
                          entry.status !== 'valid'
                            ? 'NOT_SENT'
                            : receita?.status ?? (requestError ? 'ERROR' : 'PENDING')

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
                            <td>{receita?.razao_social ?? '—'}</td>
                            <td>{receita?.situacao_cadastral ?? '—'}</td>
                            <td>{receita?.data_abertura ?? '—'}</td>
                            <td className="reason-cell">
                              {receita?.cnae
                                ? [receita.cnae.codigo, receita.cnae.descricao].filter(Boolean).join(' · ')
                                : '—'}
                            </td>
                            <td className="reason-cell">{formatAddress(receita?.endereco ?? null)}</td>
                            <td>{receita?.telefone ?? '—'}</td>
                            <td>
                              <span className={`source-badge source-badge--${sourceStatus.toLowerCase()}`}>
                                {sourceStatusLabels[sourceStatus]}
                              </span>
                              {receita?.error && <small className="source-error">{receita.error}</small>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="results-footnote">
                  <ShieldCheck size={14} />
                  Inválidos e duplicados não são consultados. ERROR permanece distinto de NOT_FOUND.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon"><ClipboardList size={22} /></div>
                <h3>Os dados cadastrais aparecerão aqui</h3>
                <p>Valide a lista para consultar os CNPJs válidos pela BrasilAPI, através do backend.</p>
              </div>
            )}
          </section>
        </div>

        <footer className="page-footer">
          <span>TARKEN <span className="footer-dot">·</span> CASE DE DUE DILIGENCE</span>
          <span>Receita via backend <span className="footer-dot">·</span> IBAMA fora desta etapa</span>
        </footer>
      </main>
    </div>
  )
}

export default App
