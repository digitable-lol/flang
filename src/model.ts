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

export type VisualizationMode = "all" | "category" | "functors" | "proof"

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
  viz: FtsVisualization
}
