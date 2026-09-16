export type Severity = "error" | "warning";
export type Scope = "manifest" | "entity" | "texture" | "filesystem" | "namespace" | "format";

export interface LintContext {
  bpDir: string;
  rpDir: string;
  dataDir: string;
  namespace: string | null;
  project: string | null;
}

export interface LintIssue {
  checkId: string;
  severity: Severity;
  message: string;
  path?: string;
}

export interface Check {
  id: string;
  severity: Severity;
  scope: Scope;
  run(ctx: LintContext): LintIssue[];
}

// Manifest shape — all fields optional because we parse unknown JSON
export interface ManifestHeader {
  name?: string;
  uuid?: string;
  pack_scope?: string;
  version?: unknown;
  min_engine_version?: unknown;
  use_beta_features?: boolean;
}

export interface ManifestDependency {
  uuid?: string;
  module_name?: string;
  version?: unknown;
}

export interface ManifestMetadata {
  product_type?: string;
}

export interface Manifest {
  format_version?: unknown;
  header?: ManifestHeader;
  modules?: unknown[];
  dependencies?: ManifestDependency[];
  metadata?: ManifestMetadata;
  capabilities?: string[];
}
