"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  ragSearchKeys,
  searchRag,
  type RagSearchParams,
  type RagSearchResponse,
} from "@/lib/rag"
import { useRagSearchStore } from "@/stores/rag-search-store"

export function useRagSearchQuery() {
  const queryClient = useQueryClient()
  const activeSearch = useRagSearchStore((s) => s.activeSearch)
  const primeOpenHits = useRagSearchStore((s) => s.primeOpenHits)
  const commitSearch = useRagSearchStore((s) => s.commitSearch)

  const query = useQuery<RagSearchResponse, Error>({
    queryKey: activeSearch
      ? ragSearchKeys.search(activeSearch)
      : [...ragSearchKeys.searches(), "idle"],
    queryFn: () => searchRag(activeSearch as RagSearchParams),
    enabled: Boolean(activeSearch?.query.trim()),
  })

  async function runSearch(options?: { force?: boolean }) {
    const params = commitSearch()
    if (!params) return

    const key = ragSearchKeys.search(params)
    if (options?.force) {
      await queryClient.invalidateQueries({ queryKey: key })
    }

    const data = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => searchRag(params),
    })
    primeOpenHits(data.hits)
  }

  return {
    ...query,
    activeSearch,
    runSearch,
    result: query.data ?? null,
    errorMessage: query.error?.message ?? null,
    isSearching: query.isFetching,
  }
}
