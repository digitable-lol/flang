export type FtsScalar = string | number | boolean | null
export type FtsValue = FtsScalar | FtsValue[] | { [key: string]: FtsValue }
export type PathSelector = Record<string, FtsScalar>
export type PathSegment = string | number | PathSelector

export interface SourcePosition {
  offset: number
  line: number
  column: number
}

export interface SourceSpan {
  start: SourcePosition
  end: SourcePosition
}

export interface FtsField {
  name: string
  type: string
}

export interface FtsStructure {
  name: string
  fields: FtsField[]
  ts_compat?: string
}

export interface FtsFunctor {
  name: string
  domain: string
  codomain: string
  law?: string
}

export type FtsUtilityOperand =
  | { kind: "value"; value: FtsScalar }
  | { kind: "field"; field: string }
  | { kind: "percent"; percent: number; field: string }
  | { kind: "result" }

export type FtsUtilityComparison = "eq" | "neq" | "gte" | "lte" | "gt" | "lt"

export interface FtsUtilityCondition {
  field: string
  operator: FtsUtilityComparison
  value: FtsUtilityOperand
}

export interface FtsUtilityRule {
  name: string
  when: FtsUtilityCondition[]
  action: {
    kind: "set" | "add"
    value: FtsUtilityOperand
  }
}

export interface FtsUtilityProperty {
  name: string
  operator: FtsUtilityComparison
  value: FtsUtilityOperand
}

export interface FtsUtilityExample {
  name: string
  input: Record<string, FtsScalar>
  expected: FtsScalar
}

export interface FtsUtility {
  name: string
  input: string
  output: string
  initial: FtsScalar
  rules: FtsUtilityRule[]
  properties: FtsUtilityProperty[]
  examples: FtsUtilityExample[]
}

export interface WitnessProposition {
  kind: "witness"
  structure: string
  field: string
  selector?: Record<string, FtsValue>
  value?: FtsValue
  path?: PathSegment[]
  detail?: string
}

export interface ApplyProposition {
  kind: "apply"
  functor: string
  arg: FtsProposition
  detail?: string
}

export interface ComposeProposition {
  kind: "compose"
  functors: string[]
  arg: FtsProposition
  detail?: string
}

export type FtsProposition = WitnessProposition | ApplyProposition | ComposeProposition

export interface FtsDocument {
  category: string
  structures: FtsStructure[]
  functors: FtsFunctor[]
  proposition: FtsProposition | null
  ts_compat: Record<string, string>
  utilities?: FtsUtility[]
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface UtilityGeneration {
  target: "typescript"
  utilities: string[]
  files: GeneratedFile[]
}

export interface CurryHowardProof {
  proposition: string
  witness: string
}

export interface CategoricalProof {
  category: string
  morphism: string
  domain: string
  codomain: string
}

export interface FtsProof {
  proof: string
  curry_howard: CurryHowardProof
  categorical: CategoricalProof
  morphisms: string[]
  path: PathSegment[]
}

export type ProofCertificateStatus = "verified" | "symbolic"

export interface WitnessProofStep {
  rule: "witness"
  structure: string
  field: string
  type: string
  path: PathSegment[]
  expected?: FtsValue
  actual?: FtsValue
  evidence_digest?: string
  verified: boolean
}

export interface ApplyProofStep {
  rule: "apply"
  functor: string
  domain: string
  codomain: string
  law: string
}

export type ProofCertificateStep = WitnessProofStep | ApplyProofStep

export interface FtsProofCertificate {
  version: "fts-proof/1"
  category: string
  status: ProofCertificateStatus
  document_digest: string
  context_digest?: string
  assumptions: string[]
  steps: ProofCertificateStep[]
  conclusion: {
    type: string
    term: string
  }
  certificate_digest: string
}

export interface CertificateVerification {
  valid: boolean
  status: ProofCertificateStatus
  expected_digest: string
  actual_digest: string
}

export type VisualizationMode = "all" | "category" | "morphisms" | "functors" | "proof"

export interface FtsVisualization {
  mermaid: string
  mermaid_category: string
  mermaid_functors: string
  mermaid_proof: string | null
}

export interface PipelineInput {
  source?: string
  document?: FtsDocument
  context?: unknown
  viz?: VisualizationMode
}

export interface PipelineResult {
  document: FtsDocument
  proof: FtsProof | null
  certificate: FtsProofCertificate | null
  viz: FtsVisualization
}
