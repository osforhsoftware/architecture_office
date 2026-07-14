import { spawn } from "node:child_process"
import os from "node:os"

function getLanIp() {
  const nets = os.networkInterfaces()
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address
      }
    }
  }
  return null
}

const lanIp = getLanIp()
const port = process.env.PORT ?? "3000"

console.log("")
console.log("  LAN access (other devices on same Wi-Fi):")
if (lanIp) {
  console.log(`  → http://${lanIp}:${port}`)
} else {
  console.log("  → Could not detect LAN IP. Run ipconfig and use your Wi-Fi IPv4 address.")
}
console.log("  Local access on this PC:")
console.log(`  → http://localhost:${port}`)
console.log("")

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-H", "0.0.0.0", "-p", port],
  { stdio: "inherit", shell: true },
)

child.on("exit", (code) => process.exit(code ?? 0))
