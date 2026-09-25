"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchGoldSet, underwriteKeys, type GoldSetResponse } from "@/lib/underwrite"

export function useGoldSetQuery() {
  const query = useQuery<GoldSetResponse, Error>({
    queryKey: underwriteKeys.goldSet(),
    queryFn: fetchGoldSet,
    staleTime: 10 * 60 * 1000,
  })

  return {
    ...query,
    catalog: query.data ?? null,
    errorMessage: query.error?.message ?? null,
  }
}
