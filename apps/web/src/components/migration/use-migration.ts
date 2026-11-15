'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DecisionInput, FindingDecision, ImporterInfo, InspectionResult, MigrationRun, MigrationRunSummary, RunInput,
} from '@accounting/shared'
import { apiFetch } from '@/lib/api'

const API = '/api/migration'
export const migrationKeys = {
  importers: ['migration', 'importers'] as const,
  runs: ['migration', 'runs'] as const,
  run: (id: string) => ['migration', 'run', id] as const,
  decisions: ['migration', 'decisions'] as const,
}

export function useImporters() {
  return useQuery<ImporterInfo[]>({ queryKey: migrationKeys.importers, queryFn: () => apiFetch(`${API}/importers`) })
}

export function useRuns() {
  return useQuery<MigrationRunSummary[]>({ queryKey: migrationKeys.runs, queryFn: () => apiFetch(`${API}/runs`) })
}

// Polls every 2 s while the trial is running.
export function useRun(id: string | null) {
  return useQuery<MigrationRun>({
    queryKey: migrationKeys.run(id ?? ''),
    queryFn: () => apiFetch(`${API}/runs/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 2000 : false),
  })
}

export function useDecisions() {
  return useQuery<FindingDecision[]>({ queryKey: migrationKeys.decisions, queryFn: () => apiFetch(`${API}/decisions`) })
}

export function useInspect() {
  return useMutation({
    mutationFn: (root: string) => apiFetch<InspectionResult>(`${API}/inspect`, { method: 'POST', json: { root } }),
  })
}

export function useStartRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RunInput) => apiFetch<MigrationRunSummary>(`${API}/runs`, { method: 'POST', json: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: migrationKeys.runs }),
  })
}

export function useDecide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DecisionInput) => apiFetch<FindingDecision>(`${API}/decisions`, { method: 'PUT', json: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: migrationKeys.decisions }),
  })
}
