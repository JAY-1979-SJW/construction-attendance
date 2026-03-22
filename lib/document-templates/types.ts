export type IssueSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface PreflightIssue {
  severity: IssueSeverity
  code: string
  message: string
  workerIds?: string[]
  detail?: unknown
}

export interface PreflightContext {
  monthKey: string
  siteId?: string
  companyId?: string
  /** @deprecated use companyId */
  subcontractorId?: string
}

export interface ColumnDefinition {
  key: string
  header: string
  required: boolean
  resolver: (row: Record<string, unknown>, context: PreflightContext) => string | number | null
  formatter?: (value: unknown) => string
  validator?: (value: unknown, row: Record<string, unknown>) => string | null
}

export interface DocumentTemplateDefinition {
  templateCode: string
  title: string
  fileFormat: 'csv' | 'xlsx'
  fileNamePattern: (ctx: PreflightContext) => string
  columns: ColumnDefinition[]
  preflightChecks: ((context: PreflightContext) => Promise<PreflightIssue[]>)[]
}
