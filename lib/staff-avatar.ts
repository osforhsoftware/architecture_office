import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function extensionForType(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

/** Persist a staff profile image under public/uploads/avatars and return its public path. */
export async function saveStaffAvatarFile(file: File, userId: number): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Profile image must be PNG, JPEG, or WebP.")
  }
  const bytes = await file.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error("Profile image file is empty.")
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Profile image must be under 2MB.")
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(uploadsDir, { recursive: true })

  const fileName = `staff-${userId}-${Date.now()}.${extensionForType(file.type)}`
  await writeFile(path.join(uploadsDir, fileName), Buffer.from(bytes))
  return `/uploads/avatars/${fileName}`
}

/** Delete a previously stored staff avatar from disk when it lives under /uploads/avatars. */
export async function deleteStaffAvatarFile(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl?.startsWith("/uploads/avatars/")) return
  try {
    await unlink(path.join(process.cwd(), "public", avatarUrl.replace(/^\//, "")))
  } catch {
    // File may already be gone; ignore.
  }
}

/**
 * Resolve the avatar to store from form data.
 * - `remove_avatar=true` clears the image
 * - `avatar` File replaces the current image
 * - otherwise keeps `currentAvatar`
 */
export async function resolveStaffAvatarFromForm(
  formData: FormData,
  userId: number,
  currentAvatar: string | null,
): Promise<{ avatarUrl: string | null; error?: string }> {
  const remove = String(formData.get("remove_avatar") || "") === "true"
  if (remove) {
    await deleteStaffAvatarFile(currentAvatar)
    return { avatarUrl: null }
  }

  const file = formData.get("avatar")
  if (file instanceof File && file.size > 0) {
    try {
      const next = await saveStaffAvatarFile(file, userId)
      if (currentAvatar && currentAvatar !== next) {
        await deleteStaffAvatarFile(currentAvatar)
      }
      return { avatarUrl: next }
    } catch (error) {
      return {
        avatarUrl: currentAvatar,
        error: error instanceof Error ? error.message : "Failed to save profile image.",
      }
    }
  }

  return { avatarUrl: currentAvatar }
}
