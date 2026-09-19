"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LenderFilter, ProgramLayer } from "@/lib/rag"
import { useRagSearchStore } from "@/stores/rag-search-store"

const PROGRAM_OPTIONS: { value: ProgramLayer; label: string }[] = [
  { value: "all", label: "All layers" },
  { value: "compliance_floor", label: "Compliance floor" },
  { value: "eligibility_gate", label: "Eligibility gate" },
  { value: "sba_7a", label: "SBA 7(a)" },
  { value: "cdfi_direct", label: "CDFI Direct" },
]

const LENDER_OPTIONS: { value: LenderFilter; label: string }[] = [
  { value: "generic", label: "Generic (no lender overlay)" },
  { value: "accion", label: "Accion ∪ shared" },
  { value: "frontier_7a", label: "Frontier 7(a) ∪ shared" },
]

export function RagFilters({
  programId,
  lenderId,
}: {
  programId: string
  lenderId: string
}) {
  const program = useRagSearchStore((s) => s.program)
  const lender = useRagSearchStore((s) => s.lender)
  const setProgram = useRagSearchStore((s) => s.setProgram)
  const setLender = useRagSearchStore((s) => s.setLender)

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
      <div className="space-y-2">
        <Label htmlFor={programId}>Program layer</Label>
        <Select
          value={program}
          onValueChange={(value) => {
            if (value != null) setProgram(value as ProgramLayer)
          }}
        >
          <SelectTrigger id={programId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROGRAM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={lenderId}>Lender</Label>
        <Select
          value={lender}
          onValueChange={(value) => {
            if (value != null) setLender(value as LenderFilter)
          }}
        >
          <SelectTrigger id={lenderId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LENDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
