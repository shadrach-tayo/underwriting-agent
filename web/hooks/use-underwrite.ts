"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  runUnderwrite,
  underwriteKeys,
  type UnderwriteRequestParams,
  type UnderwriteResult,
} from "@/lib/underwrite"
import { useUnderwriteStore } from "@/stores/underwrite-store"

export function useUnderwriteQuery() {
  const queryClient = useQueryClient()
  const activeRun = useUnderwriteStore((s) => s.activeRun)
  const commitRun = useUnderwriteStore((s) => s.commitRun)

  const query = useQuery<UnderwriteResult, Error>({
    queryKey: activeRun
      ? underwriteKeys.run(activeRun)
      : [...underwriteKeys.runs(), "idle"],
    queryFn: () => runUnderwrite(activeRun as UnderwriteRequestParams),
    enabled: Boolean(activeRun),
    staleTime: 5 * 60 * 1000,
  })

  async function run(options?: { force?: boolean }) {
    const params = commitRun()
    if (!params) {
      throw new Error(
        "Revenue, loan amount, and years in business are required numbers."
      )
    }

    const key = underwriteKeys.run(params)
    if (options?.force) {
      await queryClient.invalidateQueries({ queryKey: key })
    }

    return queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => runUnderwrite(params),
    })
  }

  return {
    ...query,
    activeRun,
    run,
    result: query.data ?? null,
    errorMessage: query.error?.message ?? null,
    isRunning: query.isFetching,
  }
}
