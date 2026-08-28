import os from "os"
import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const devPort = process.env.PORT ?? "3000"

function localDevHosts() {
  const hosts = new Set(["localhost", "127.0.0.1"])
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        hosts.add(entry.address)
      }
    }
  }
  return [...hosts]
}

function envPublicHosts() {
  const hosts = []
  for (const key of [
    "FRONTEND_URL",
    "NEXT_PUBLIC_FRONTEND_URL",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
  ]) {
    const raw = process.env[key]?.trim()
    if (!raw) continue
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      hosts.push(url.host, url.hostname)
    } catch {
      /* ignore invalid env */
    }
  }
  return hosts
}

const localHosts = localDevHosts()
const publicHosts = [...new Set([...localHosts, ...envPublicHosts()])]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: localHosts,
  experimental: {
    serverActions: {
      allowedOrigins: publicHosts.flatMap((host) =>
        host.includes(":") ? [host] : [host, `${host}:${devPort}`],
      ),
    },
  },
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
