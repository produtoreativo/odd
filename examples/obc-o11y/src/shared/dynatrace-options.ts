export function shouldApplyDynatraceDocumentDashboard(): boolean {
  return process.env.DYNATRACE_ENABLE_DOCUMENT_DASHBOARD === 'true'
    || process.env.DYNATRACE_DASHBOARD_MODE === 'document';
}

export function shouldGenerateDynatraceSloTerraform(): boolean {
  return process.env.DYNATRACE_ENABLE_SLO_TERRAFORM === 'true';
}
