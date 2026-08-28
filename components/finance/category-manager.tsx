"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormField, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { saveExpenseCategory, saveIncomeCategory } from "@/lib/finance/actions"
import type { ExpenseCategory, IncomeCategory } from "@/lib/finance/types"

function CategoryForm({
  type,
  category,
  scope,
  onDone,
}: {
  type: "income" | "expense"
  category?: IncomeCategory | ExpenseCategory
  scope?: "project" | "office" | "both"
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(category)

  function onSubmit(formData: FormData) {
    setError(null)
    if (category) formData.set("id", String(category.id))
    if (scope) formData.set("scope", scope)
    startTransition(async () => {
      const res =
        type === "income" ? await saveIncomeCategory(formData) : await saveExpenseCategory(formData)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Category updated" : "Category added")
      onDone()
    })
  }

  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {error ? (
        <p className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <FormField label="Name" htmlFor={`${type}-cat-name`}>
        <Input
          id={`${type}-cat-name`}
          name="name"
          required
          defaultValue={category?.name ?? ""}
          className={formControlClass}
        />
      </FormField>
      <FormField label="Color" htmlFor={`${type}-cat-color`}>
        <Input
          id={`${type}-cat-color`}
          name="color"
          type="color"
          defaultValue={category?.color ?? (type === "income" ? "#16a34a" : "#dc2626")}
          className="h-11 w-full cursor-pointer"
        />
      </FormField>
      <FormField label="Sort order" htmlFor={`${type}-cat-sort`}>
        <Input
          id={`${type}-cat-sort`}
          name="sort_order"
          type="number"
          defaultValue={String(category?.sort_order ?? 0)}
          className={formControlClass}
        />
      </FormField>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {isEdit ? "Save" : "Add category"}
        </Button>
      </div>
    </form>
  )
}

function CategoryList({
  type,
  categories,
  scope,
}: {
  type: "income" | "expense"
  categories: IncomeCategory[] | ExpenseCategory[]
  scope?: "project" | "office" | "both"
}) {
  const [editing, setEditing] = useState<IncomeCategory | ExpenseCategory | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { setAdding(true); setEditing(null) }}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {(adding || editing) && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <CategoryForm
            key={editing?.id ?? "new"}
            type={type}
            category={editing ?? undefined}
            scope={scope}
            onDone={() => {
              setAdding(false)
              setEditing(null)
            }}
          />
        </div>
      )}

      {categories.length ? (
        <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden
                />
                <div>
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">Order {cat.sort_order}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cat.active ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline">Hidden</Badge>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(cat); setAdding(false) }}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
      )}
    </div>
  )
}

export function CategoryManager({
  incomeCategories,
  expenseCategories,
  scope,
}: {
  incomeCategories: IncomeCategory[]
  expenseCategories: ExpenseCategory[]
  scope?: "project" | "office" | "both"
}) {
  return (
    <Tabs defaultValue="income">
      <TabsList>
        <TabsTrigger value="income">Income Categories</TabsTrigger>
        <TabsTrigger value="expense">Expense Categories</TabsTrigger>
      </TabsList>
      <TabsContent value="income" className="mt-4">
        <CategoryList type="income" categories={incomeCategories} scope={scope} />
      </TabsContent>
      <TabsContent value="expense" className="mt-4">
        <CategoryList type="expense" categories={expenseCategories} scope={scope} />
      </TabsContent>
    </Tabs>
  )
}
