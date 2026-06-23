import { Loader2 } from "lucide-react"

export default function ProjectsLoading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}
