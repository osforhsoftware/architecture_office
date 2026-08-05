"use client"

import { useState, useTransition } from "react"
import { Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addProjectFile, deleteProjectFile } from "@/lib/actions"
import { FILE_CATEGORIES, FILE_TYPES } from "@/lib/constants"
import type { ProjectFile } from "@/lib/types"

export function ProjectFilesPanel({
  files,
  projectId,
  readOnly = false,
}: {
  files: ProjectFile[]
  projectId: number
  readOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [fileType, setFileType] = useState("PDF")
  const [category, setCategory] = useState("Other")

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("name", name)
    fd.set("file_type", fileType)
    fd.set("category", category)
    startTransition(async () => {
      const res = await addProjectFile(fd)
      if (res?.error) toast.error(res.error)
      else {
        toast.success("File recorded")
        setName("")
      }
    })
  }

  function onDelete(fileId: number) {
    if (readOnly) return
    const fd = new FormData()
    fd.set("file_id", String(fileId))
    fd.set("project_id", String(projectId))
    startTransition(async () => {
      await deleteProjectFile(fd)
      toast.success("File removed")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <form onSubmit={onAdd} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="file-name">File name</Label>
            <Input
              id="file-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Site_Plan_v2.pdf"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={fileType} onValueChange={(value) => value && setFileType(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => value && setCategory(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            <Upload className="size-4" /> Record file
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Binary upload storage is not configured yet. File metadata is tracked for workflow.
          </p>
        </form>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.file_type} · {f.category} · v{f.version ?? 1}
                {f.uploader_name ? ` · ${f.uploader_name}` : ""}
              </p>
            </div>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => onDelete(f.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
        {files.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">No files yet.</li>
        ) : null}
      </ul>
    </div>
  )
}
