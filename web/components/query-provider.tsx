"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"

import { useRagSearchStore } from "@/stores/rag-search-store"
import { useUnderwriteStore } from "@/stores/underwrite-store"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

type SyncPersister = ReturnType<typeof createSyncStoragePersister>

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => getQueryClient())
  const [persister, setPersister] = React.useState<SyncPersister | null>(null)

  React.useEffect(() => {
    setPersister(
      createSyncStoragePersister({
        storage: window.localStorage,
        key: "underwriting.playground.react-query",
      })
    )
    void useRagSearchStore.persist.rehydrate()
    void useUnderwriteStore.persist.rehydrate()
  }, [])

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v3-source-urls",
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
