'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, PageHeader } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/form'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    apiFetch<{ needsSetup: boolean }>('/api/setup/status').then(({ needsSetup }) => {
      if (!needsSetup) router.replace('/login')
      else setChecking(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiFetch('/api/setup/complete', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      })
      router.push('/login')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <PageHeader title="Bienvenido" subtitle="Cree la cuenta del propietario para comenzar." />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Nombre completo">
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Correo electrónico">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres.">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
      </div>
    </div>
  )
}
