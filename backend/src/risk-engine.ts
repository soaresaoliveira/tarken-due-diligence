import {
  classifyRiskWithCriteria,
  DEFAULT_RISK_CRITERIA,
  type RiskCriteria,
  type RiskDecision,
  type RiskInput,
} from '../../shared/risk-engine.js'

export { DEFAULT_RISK_CRITERIA } from '../../shared/risk-engine.js'
export type { RiskClassification, RiskCriteria, RiskDecision, RiskInput } from '../../shared/risk-engine.js'

export function classifyRisk(input: RiskInput, criteria: RiskCriteria = DEFAULT_RISK_CRITERIA): RiskDecision {
  return classifyRiskWithCriteria(input, criteria)
}
