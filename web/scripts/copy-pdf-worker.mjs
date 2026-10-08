import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.dirname(fileURLToPath(import.meta.url))
const destDir = path.resolve(root, "../public")
const dest = path.join(destDir, "pdf.worker.min.mjs")

function resolveWorker() {
  try {
    return require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")
  } catch {
    const reactPdf = path.dirname(require.resolve("react-pdf"))
    return require.resolve("pdfjs-dist/build/pdf.worker.min.mjs", {
      paths: [reactPdf],
    })
  }
}

const src = resolveWorker()
fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log(`copied pdf.js worker → ${path.relative(path.resolve(root, ".."), dest)}`)
