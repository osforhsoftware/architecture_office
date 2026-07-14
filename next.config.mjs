import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.220.51", "192.168.220.47", "192.168.220.*"],
  /**
   * Inline non-sensitive connection metadata at build time so Hostinger's Node
   * wrapper (which drops runtime process.env) still has host/user/database.
   * Set MYSQL_PASSWORD (and optionally DATABASE_URL) in the build environment;
   * do not add secrets to this block.
   */
  env: {
    NEXT_PUBLIC_FRONTEND_URL:
      process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? "",
    NEXT_PUBLIC_BACKEND_URL:
      process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "",
    MYSQL_HOST: process.env.MYSQL_HOST ?? process.env.DB_HOST ?? "",
    MYSQL_PORT: process.env.MYSQL_PORT ?? "3306",
    MYSQL_USER:
      process.env.MYSQL_USER ??
      process.env.DB_USER ??
      process.env.MYSQL_USERNAME ??
      "",
    MYSQL_DATABASE:
      process.env.MYSQL_DATABASE ??
      process.env.MYSQL_DB ??
      process.env.DB_NAME ??
      "",
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
