/** In-memory cache of original policy files so citation previews do not re-fetch. */

const MAX_ENTRIES = 8

const blobs = new Map<string, Blob>()
const inflight = new Map<string, Promise<Blob>>()
const order: string[] = []
const docxDom = new Map<string, DocumentFragment>()

function touch(url: string) {
  const at = order.indexOf(url)
  if (at >= 0) order.splice(at, 1)
  order.push(url)
  while (order.length > MAX_ENTRIES) {
    const evicted = order.shift()
    if (!evicted || evicted === url) continue
    blobs.delete(evicted)
    inflight.delete(evicted)
    docxDom.delete(evicted)
  }
}

export function peekPolicySourceBlob(url: string) {
  return blobs.get(url) ?? null
}

export function loadPolicySourceBlob(url: string): Promise<Blob> {
  const hit = blobs.get(url)
  if (hit) {
    touch(url)
    return Promise.resolve(hit)
  }
  const pending = inflight.get(url)
  if (pending) return pending

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.blob()
    })
    .then((blob) => {
      blobs.set(url, blob)
      inflight.delete(url)
      touch(url)
      return blob
    })
    .catch((error) => {
      inflight.delete(url)
      throw error
    })

  inflight.set(url, request)
  return request
}

export function takeDocxDom(url: string) {
  const fragment = docxDom.get(url)
  if (!fragment) return null
  docxDom.delete(url)
  touch(url)
  return fragment
}

export function stashDocxDom(url: string, host: HTMLElement) {
  if (!host.firstChild) return
  const fragment = document.createDocumentFragment()
  while (host.firstChild) fragment.appendChild(host.firstChild)
  docxDom.set(url, fragment)
  touch(url)
}
