'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EmpresaProfile, EmpresaProfileInput } from '@accounting/shared'
import { apiFetch } from '@/lib/api'

export function useEmpresaProfile(empresaId: string) {
  return useQuery<EmpresaProfile>({
    queryKey: ['empresa-profile', empresaId],
    queryFn: () => apiFetch(`/api/empresa-profile/${empresaId}`),
  })
}

export function useSaveEmpresaProfile(empresaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EmpresaProfileInput) =>
      apiFetch<EmpresaProfile>(`/api/empresa-profile/${empresaId}`, { method: 'PUT', json: input }),
    onSuccess: (saved) => {
      qc.setQueryData(['empresa-profile', empresaId], saved)
      qc.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
