import { useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  CircleAlert,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { parseCnpjLines, type CnpjBatch } from './utils/cnpj.ts'

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

  const inputCount = input.split(/\r?\n/).filter((line) => line.trim()).length

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBatch(parseCnpjLines(input))
  }

  function clearInput() {
    setInput('')
    setBatch(null)
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
            <span>Etapa 2 · Validação</span>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span>02</span> / ENTRADA DE FORNECEDORES</p>
            <h1 id="page-title">Validação de CNPJs</h1>
            <p className="page-heading__description">
              Normalize entradas e identifique erros antes da consulta.
            </p>
          </div>
          <div className="heading-stamp" aria-label="Protótipo visual">
            <span className="heading-stamp__icon"><BadgeCheck size={16} /></span>
            <span>Validação local</span>
          </div>
        </section>

        <aside className="demo-banner" aria-label="Aviso sobre dados demonstrativos">
          <span className="demo-banner__icon"><Sparkles size={17} /></span>
          <p>
            <strong>Processamento local.</strong> A validação segue o cálculo dos
            dígitos verificadores e não consulta fontes externas.
          </p>
          <span className="demo-banner__tag">MOCK</span>
        </aside>

        <div className="analysis-layout">
          <section className="input-panel" aria-labelledby="input-title">
            <div className="panel-kicker"><span>01</span><span>ENTRADA</span></div>
            <div className="input-panel__heading">
              <h2 id="input-title">Lista de CNPJs</h2>
              <p>Insira um CNPJ por linha, com ou sem máscara.</p>
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
              <button className="submit-button" type="submit" disabled={!inputCount}>
                <BadgeCheck size={17} aria-hidden="true" />
                <span>Validar entradas</span>
              </button>
            </form>
            <p className="input-panel__footnote">
              <CircleAlert size={14} />
              Os CNPJs não são enviados para serviços externos.
            </p>
          </section>

          <section className="results-panel" aria-labelledby="results-title" aria-live="polite">
            <div className="results-heading">
              <div>
                <div className="panel-kicker"><span>02</span><span>RESULTADOS</span></div>
                <h2 id="results-title">Resultado da validação</h2>
              </div>
              {batch && (
                <div className="result-count">{batch.informedCount} {batch.informedCount === 1 ? 'entrada avaliada' : 'entradas avaliadas'}</div>
              )}
            </div>

            {batch && batch.entries.length > 0 ? (
              <>
                <div className="summary-strip" aria-label="Resumo da validação">
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
                    <caption className="visually-hidden">Resultado local da validação dos CNPJs informados</caption>
                    <thead>
                      <tr>
                        <th scope="col">Entrada original</th>
                        <th scope="col">CNPJ normalizado</th>
                        <th scope="col">Status</th>
                        <th scope="col">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.entries.map((entry, index) => (
                        <tr className="result-row" key={`${entry.cnpj}-${index}`}>
                          <td className="original-cell">{entry.original}</td>
                          <td className="cnpj-cell">{entry.cnpj || '—'}</td>
                          <td>
                            <span className={`validation-badge validation-badge--${entry.status}`}>
                              {entry.status === 'valid' && <BadgeCheck size={13} />}
                              {entry.status === 'invalid' && <CircleAlert size={13} />}
                              {entry.status === 'duplicate' && <ClipboardList size={13} />}
                              {entry.status === 'valid' ? 'VÁLIDO' : entry.status === 'invalid' ? 'INVÁLIDO' : 'DUPLICADO'}
                            </span>
                          </td>
                          <td className="reason-cell">
                            {entry.reason ?? 'Dois dígitos verificadores conferidos.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="results-footnote">
                  <ShieldCheck size={14} />
                  Somente CNPJs válidos e únicos compõem o conjunto aceito; nenhuma consulta foi feita.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon"><ClipboardList size={22} /></div>
                <h3>As entradas serão verificadas aqui</h3>
                <p>Linhas vazias serão ignoradas; inválidos e duplicados terão seus motivos identificados.</p>
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
