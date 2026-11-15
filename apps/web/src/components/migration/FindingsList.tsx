'use client'

import { useState } from 'react'
import {
  FINDING_DECISIONS, FINDING_DECISION_LABELS, type Finding, type FindingDecision, type FindingSeverity,
} from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Button, cx } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { useDecide, useDecisions } from './use-migration'

const ORDER: FindingSeverity[] = ['bloquea', 'decidir', 'info']
export const SEVERITY_LABELS: Record<FindingSeverity, string> = { bloquea: 'Bloquea', decidir: 'Decidir', info: 'Informativo' }
export const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  bloquea: 'bg-red-100 text-red-800', decidir: 'bg-amber-100 text-amber-900', info: 'bg-gray-100 text-gray-700',
}

export function SeverityBadge({ s }: { s: FindingSeverity }) {
  return <span className={cx('rounded px-1.5 py-0.5 text-xs font-semibold', SEVERITY_STYLES[s])}>{SEVERITY_LABELS[s]}</span>
}

function DecisionControl({ finding, current }: { finding: Finding; current?: FindingDecision }) {
  const decide = useDecide()
  const [note, setNote] = useState(current?.note ?? '')
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <Select
        aria-label="Decisión"
        value={current?.decision ?? ''}
        onChange={(e) => e.target.value && decide.mutate({ key: finding.key, decision: e.target.value as FindingDecision['decision'], note })}
      >
        <option value="">Sin decidir</option>
        {FINDING_DECISIONS.map((d) => <option key={d} value={d}>{FINDING_DECISION_LABELS[d]}</option>)}
      </Select>
      <Input className="min-w-64 flex-1" placeholder="Nota (opcional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      {current && note !== current.note && (
        <Button size="sm" onClick={() => decide.mutate({ key: finding.key, decision: current.decision, note })}>Guardar nota</Button>
      )}
      {current && (
        <span className="text-xs text-gray-500">{current.decidedByName ?? current.decidedBy} · {formatDate(current.decidedAt)}</span>
      )}
      {decide.error && <span className="text-xs text-red-700">{errorMessage(decide.error)}</span>}
    </div>
  )
}

function FindingCard({ f, current }: { f: Finding; current?: FindingDecision }) {
  const [open, setOpen] = useState(false)
  const shown = open ? f.samples : f.samples.slice(0, 10)
  return (
    <li className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge s={f.severity} />
        <span className="font-medium text-gray-900">{f.title}</span>
        <span className="text-sm tabular-nums text-gray-600">({f.count})</span>
        {f.questionRef && <span className="text-xs text-gray-500">Pregunta {f.questionRef}</span>}
      </div>
      <p className="mt-1 text-sm text-gray-700">{f.recommendation}</p>
      {f.samples.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-xs text-gray-600">
          {shown.map((s, i) => <li key={i} className="break-all">{s}</li>)}
        </ul>
      )}
      {f.samples.length > 10 && (
        <button className="mt-1 text-xs text-blue-700 underline" onClick={() => setOpen(!open)}>
          {open ? 'Ver menos' : `Ver los ${f.samples.length} ejemplos`}
        </button>
      )}
      {f.severity !== 'info' && <DecisionControl finding={f} current={current} />}
    </li>
  )
}

// Findings grouped by severity, with the decision taken on each.
export function FindingsList({ findings }: { findings: Finding[] }) {
  const decisions = useDecisions()
  const byKey = new Map((decisions.data ?? []).map((d) => [d.key, d]))
  const counts = ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length] as const)
  const undecided = findings.filter((f) => f.severity !== 'info' && !byKey.has(f.key)).length
  if (findings.length === 0) return <p className="text-sm text-gray-500">Sin hallazgos.</p>
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {counts.map(([s, n]) => <span key={s} className={cx('rounded px-2 py-0.5', SEVERITY_STYLES[s])}>{SEVERITY_LABELS[s]}: {n}</span>)}
        <span className="text-gray-600">Sin decidir: {undecided}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {ORDER.flatMap((s) => findings.filter((f) => f.severity === s)).map((f) => (
          <FindingCard key={f.key} f={f} current={byKey.get(f.key)} />
        ))}
      </ul>
    </div>
  )
}
