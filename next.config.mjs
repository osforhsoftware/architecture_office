import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.220.47"],
  env: {
    NEXT_PUBLIC_FRONTEND_URL:
      process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? "",
    NEXT_PUBLIC_BACKEND_URL:
      process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "",
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
