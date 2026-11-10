'use client'

import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, EMPRESA_KEY } from './api'
import { setStored, useStored } from './local-store'

export type Empresa = {
  id: string
  name: string
  siglas: string
  moneda: string
  granContribuyente: boolean
  isActive: boolean
}

type EmpresaContext = { empresa: Empresa; empresas: Empresa[] }

const Ctx = createContext<EmpresaContext | null>(null)

export const EmpresaProvider = Ctx.Provider

// Active empresa. Only valid under <EmpresaGate>.
export function useEmpresa(): EmpresaContext {
  const value = useContext(Ctx)
  if (!value) throw new Error('useEmpresa must be used inside EmpresaGate')
  return value
}

export function useEmpresas() {
  return useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => apiFetch('/api/empresas'),
  })
}

export function useActiveEmpresaId(): string | null {
  return useStored(EMPRESA_KEY)
}

export function selectEmpresa(id: string | null): void {
  setStored(EMPRESA_KEY, id)
}
