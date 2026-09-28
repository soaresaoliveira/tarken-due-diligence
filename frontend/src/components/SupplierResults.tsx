import { useState } from 'react'
import { BadgeCheck, ChevronDown, CircleAlert, CircleX, TriangleAlert } from 'lucide-react'
import type {
  ConsolidatedResult,
  Evidence,
  IbamaStatus,
  ReceitaStatus,
  RiskClassification,
  RiskFilter,
  SupplierRow,
} from '../types/analysis.ts'

type SupplierResultsProps = {
  rows: SupplierRow[]
  filter: RiskFilter
  onFilterChange: (filter: RiskFilter) => void
}

const riskLabels: Record<RiskClassification, string> = {
  APROVAR: 'APROVAR',
  REVISAR: 'REVISAR',
  RECUSAR: 'RECUSAR',
}

const filters: { value: RiskFilter; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'APROVAR', label: 'APROVAR' },
  { value: 'REVISAR', label: 'REVISAR' },
  { value: 'RECUSAR', label: 'RECUSAR' },
]

function formatAddress(address: ConsolidatedResult['endereco']) {
  if (!address) return 'Não informado pela fonte'
  const parts = [
    [address.logradouro, address.numero, address.complemento].filter(Boolean).join(', '),
    address.bairro,
    [address.municipio, address.uf].filter(Boolean).join(' / '),
    address.cep ? `CEP ${address.cep}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Não informado pela fonte'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function RiskBadge({ value }: { value: RiskClassification }) {
  const Icon = value === 'APROVAR' ? BadgeCheck : value === 'REVISAR' ? TriangleAlert : CircleX
  return (
    <span className={`risk-badge risk-badge--${value.toLowerCase()}`}>
      <Icon size={14} aria-hidden="true" />
      {riskLabels[value]}
    </span>
  )
}

function EvidenceBadge({ value }: { value: Evidence }) {
  return <span className={`evidence-badge evidence-badge--${value === 'NÃO' ? 'nao' : value.toLowerCase()}`}>{value}</span>
}

function ReceitaStatusBadge({ value }: { value: ReceitaStatus }) {
  const label = value === 'NOT_FOUND' ? 'NOT_FOUND' : value
  return <span className={`source-badge source-badge--${value.toLowerCase()}`}>{label}</span>
}

function IbamaSource({
  evidence,
  status,
  error,
}: {
  evidence: Evidence
  status: IbamaStatus
  error?: string
}) {
  return (
    <div className="source-result">
      <EvidenceBadge value={evidence} />
      <span className={`source-badge source-badge--${status.toLowerCase()}`}>{status}</span>
      {error && <small className="source-error">{error}</small>}
    </div>
  )
}

function NotConsulted() {
  return <span className="not-consulted">Não consultada</span>
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || 'Não informado pela fonte'}</dd>
    </div>
  )
}

function SupplierDetails({ row }: { row: SupplierRow }) {
  const result = row.result

  return (
    <div className="supplier-details">
      <section className="detail-section">
        <h3>Identificação</h3>
        <dl className="detail-grid">
          <DetailField label="CNPJ informado" value={row.input.original} />
          <DetailField label="CNPJ normalizado" value={row.input.cnpj || null} />
          <DetailField label="Razão social" value={result?.razao_social} />
          <DetailField label="Situação cadastral" value={result?.situacao_cadastral} />
          <DetailField label="Data de abertura" value={result?.data_abertura} />
          <DetailField label="CNAE" value={result?.cnae ? [result.cnae.codigo, result.cnae.descricao].filter(Boolean).join(' · ') : null} />
          <DetailField label="Endereço" value={result ? formatAddress(result.endereco) : null} />
          <DetailField label="Telefone" value={result?.telefone} />
        </dl>
      </section>

      <section className="detail-section">
        <h3>Receita Federal</h3>
        {result ? (
          <>
            <div className="detail-status-line">
              <ReceitaStatusBadge value={result.status_receita} />
              {result.status_receita === 'SUCCESS' && result.situacao_cadastral && <span>{result.situacao_cadastral}</span>}
            </div>
            {result.error && <p className="source-error detail-error"><CircleAlert size={14} />{result.error}</p>}
          </>
        ) : <p className="detail-muted">Não consultada: CNPJ inválido.</p>}
      </section>

      <section className="detail-section">
        <h3>IBAMA — Autos de Infração</h3>
        {result ? (
          <IbamaSource evidence={result.ibama_auto_infracao} status={result.status_ibama_auto} error={result.error_ibama_auto} />
        ) : <p className="detail-muted">Não consultada: CNPJ inválido.</p>}
      </section>

      <section className="detail-section">
        <h3>IBAMA — Áreas Embargadas</h3>
        {result ? (
          <IbamaSource evidence={result.ibama_embargo} status={result.status_ibama_embargo} error={result.error_ibama_embargo} />
        ) : <p className="detail-muted">Não consultada: CNPJ inválido.</p>}
      </section>

      <section className="detail-section detail-section--decision">
        <h3>Decisão</h3>
        <div className="detail-status-line"><RiskBadge value={row.classificacao_risco} /></div>
        <p className="detail-reason">{row.motivo_classificacao}</p>
        {result && <p className="detail-muted">Consulta em {formatDate(result.data_consulta)}</p>}
      </section>
    </div>
  )
}

function SupplierIdentity({ row }: { row: SupplierRow }) {
  return (
    <div className="supplier-identity">
      <strong>{row.result?.razao_social || 'Fornecedor não identificado'}</strong>
      <span className="cnpj-cell">{row.input.cnpj || row.input.original}</span>
      {row.result?.situacao_cadastral && <small>{row.result.situacao_cadastral}</small>}
      {row.invalid?.reason && <small className="entry-reason">{row.invalid.reason}</small>}
    </div>
  )
}

export function SupplierResults({ rows, filter, onFilterChange }: SupplierResultsProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  function toggleDetails(row: SupplierRow) {
    setExpandedKey((current) => current === row.key ? null : row.key)
  }

  function detailsButton(row: SupplierRow) {
    const isExpanded = expandedKey === row.key
    const supplier = row.result?.razao_social ?? row.input.original
    return (
      <button
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} detalhes de ${supplier}`}
        className="details-toggle"
        onClick={() => toggleDetails(row)}
        type="button"
      >
        <span>{isExpanded ? 'Fechar' : 'Detalhes'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    )
  }

  return (
    <section className="supplier-results" aria-labelledby="suppliers-title">
      <div className="results-heading">
        <div>
          <div className="panel-kicker"><span>02</span><span>FORNECEDORES</span></div>
          <h2 id="suppliers-title">Resultados consolidados</h2>
        </div>
        <span className="result-count">{rows.length} {rows.length === 1 ? 'fornecedor' : 'fornecedores'}</span>
      </div>

      <div className="risk-filters" role="group" aria-label="Filtrar por classificação">
        {filters.map((option) => (
          <button
            aria-pressed={filter === option.value}
            className={`risk-filter${filter === option.value ? ' risk-filter--active' : ''}`}
            key={option.value}
            onClick={() => {
              setExpandedKey(null)
              onFilterChange(option.value)
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state empty-state--filtered">
          <h3>Nenhum fornecedor nesta classificação</h3>
          <p>Escolha outra classificação para rever os resultados.</p>
        </div>
      ) : (
        <>
          <div className="table-frame supplier-table-frame">
            <table className="supplier-table">
              <caption className="visually-hidden">Resultados consolidados por fornecedor</caption>
              <thead>
                <tr>
                  <th scope="col">Fornecedor</th>
                  <th scope="col">Receita</th>
                  <th scope="col">Autos</th>
                  <th scope="col">Áreas embargadas</th>
                  <th scope="col">Ambiental</th>
                  <th scope="col">Classificação e motivo</th>
                  <th scope="col"><span className="visually-hidden">Detalhes</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <FragmentRow key={row.key} row={row} expanded={expandedKey === row.key} detailsButton={detailsButton} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="supplier-mobile-list">
            {rows.map((row) => (
              <article className="supplier-card" key={row.key}>
                <div className="supplier-card__top">
                  <SupplierIdentity row={row} />
                  <RiskBadge value={row.classificacao_risco} />
                </div>
                <p className="supplier-card__reason">{row.motivo_classificacao}</p>
                <div className="supplier-card__sources">
                  <CompactSource label="Receita" row={row} />
                  <CompactIbama label="Autos" evidence={row.result?.ibama_auto_infracao} status={row.result?.status_ibama_auto} />
                  <CompactIbama label="Embargos" evidence={row.result?.ibama_embargo} status={row.result?.status_ibama_embargo} />
                </div>
                {expandedKey === row.key && <SupplierDetails row={row} />}
                {detailsButton(row)}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function FragmentRow({
  row,
  expanded,
  detailsButton,
}: {
  row: SupplierRow
  expanded: boolean
  detailsButton: (row: SupplierRow) => React.ReactNode
}) {
  return (
    <>
      <tr className="supplier-row">
        <td><SupplierIdentity row={row} /></td>
        <td>{row.result ? <><ReceitaStatusBadge value={row.result.status_receita} /><small className="table-subtext">{row.result.situacao_cadastral || 'Situação não informada'}</small></> : <NotConsulted />}</td>
        <td>{row.result ? <IbamaSource evidence={row.result.ibama_auto_infracao} status={row.result.status_ibama_auto} /> : <NotConsulted />}</td>
        <td>{row.result ? <IbamaSource evidence={row.result.ibama_embargo} status={row.result.status_ibama_embargo} /> : <NotConsulted />}</td>
        <td>{row.result ? <EvidenceBadge value={row.result.resultado_ambiental} /> : <NotConsulted />}</td>
        <td><RiskBadge value={row.classificacao_risco} /><p className="reason-cell">{row.motivo_classificacao}</p></td>
        <td>{detailsButton(row)}</td>
      </tr>
      {expanded && <tr className="supplier-details-row"><td colSpan={7}><SupplierDetails row={row} /></td></tr>}
    </>
  )
}

function CompactSource({ label, row }: { label: string; row: SupplierRow }) {
  return (
    <div className="compact-source">
      <span>{label}</span>
      {row.result ? <ReceitaStatusBadge value={row.result.status_receita} /> : <NotConsulted />}
    </div>
  )
}

function CompactIbama({ label, evidence, status }: { label: string; evidence?: Evidence; status?: IbamaStatus }) {
  return (
    <div className="compact-source">
      <span>{label}</span>
      {evidence && status ? <><EvidenceBadge value={evidence} /><span className={`source-badge source-badge--${status.toLowerCase()}`}>{status}</span></> : <NotConsulted />}
    </div>
  )
}