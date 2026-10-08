import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["react-pdf", "docx-preview"],
  serverExternalPackages: ["pdfjs-dist"],
}

export default nextConfig
