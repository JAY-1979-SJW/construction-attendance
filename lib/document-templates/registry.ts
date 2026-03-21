import { DocumentTemplateDefinition } from './types'
import { wageLedgerTemplate } from './templates/wage-ledger'
import { monthlyAttendanceTemplate } from './templates/monthly-attendance'
import { insuranceReportTemplate } from './templates/insurance-report'
import { taxReportTemplate } from './templates/tax-report'
import { retirementMutualTemplate } from './templates/retirement-mutual'
import { subcontractorSettlementTemplate } from './templates/subcontractor-settlement'

const templates: DocumentTemplateDefinition[] = [
  wageLedgerTemplate,
  monthlyAttendanceTemplate,
  insuranceReportTemplate,
  taxReportTemplate,
  retirementMutualTemplate,
  subcontractorSettlementTemplate,
]

const registry = new Map<string, DocumentTemplateDefinition>(
  templates.map(t => [t.templateCode, t])
)

export function getTemplate(templateCode: string): DocumentTemplateDefinition {
  const t = registry.get(templateCode)
  if (!t) throw new Error(`Unknown templateCode: ${templateCode}`)
  return t
}

export function getAllTemplateCodes(): string[] {
  return Array.from(registry.keys())
}

export { registry }
