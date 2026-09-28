import type { AnalysisSummary } from '../types/analysis.ts'

type ResultsSummaryProps = {
  summary: AnalysisSummary
}

const metrics = [
  { key: 'total', label: 'Fornecedores processados', className: 'summary-item--total' },
  { key: 'aprovar', label: 'APROVAR', className: 'summary-item--approve' },
  { key: 'revisar', label: 'REVISAR', className: 'summary-item--review' },
  { key: 'recusar', label: 'RECUSAR', className: 'summary-item--refuse' },
] as const

export function ResultsSummary({ summary }: ResultsSummaryProps) {
  return (
    <section className="summary-strip" aria-label="Resumo da análise">
      {metrics.map((metric) => (
        <div className={`summary-item ${metric.className}`} key={metric.key}>
          <span className="summary-item__label">{metric.label}</span>
          <strong>{summary[metric.key]}</strong>
        </div>
      ))}
      {summary.duplicados > 0 && (
        <p className="duplicate-note">
          {summary.duplicados} {summary.duplicados === 1 ? 'duplicidade removida' : 'duplicidades removidas'}; fora do total de fornecedores.
        </p>
      )}
    </section>
  )
}