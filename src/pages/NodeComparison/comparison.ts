export function comparisonIds(params: URLSearchParams): string[] {
  return [...new Set(params.getAll('node').filter(Boolean))].slice(0, 3);
}

export function comparisonUrl(ids: string[]): string {
  const params = new URLSearchParams();
  for (const id of [...new Set(ids)].filter(Boolean).slice(0, 3)) params.append('node', id);
  return `/compare${params.size ? `?${params}` : ''}`;
}

export function designUtilization(flow: number, nominal: number): number | null {
  return nominal > 0 && Number.isFinite(flow) && Number.isFinite(nominal) ? flow / nominal * 100 : null;
}

export function signedDifference(value: number, reference: number, digits = 1): string {
  const difference = value - reference;
  return `${difference > 0 ? '+' : ''}${difference.toFixed(digits)}`;
}
