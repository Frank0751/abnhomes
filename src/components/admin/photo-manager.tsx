'use client'

/**
 * A gallery's photos — a room's or a building's: add, reorder, choose the
 * cover, remove. The caller passes the two server actions that do the work,
 * already bound to the record they belong to.
 *
 * Photos are resized IN THE BROWSER before they are sent. A phone photo is
 * 3–8 MB and 4000+ pixels across; the website never shows one wider than
 * about 2000, and a serverless function will not accept a request much over
 * 4 MB. Re-drawing on a canvas also drops the EXIF block, which on a phone
 * photo includes the GPS position it was taken at.
 *
 * Changes to order are saved as they are made, one request each, so there is
 * no separate "save" step to forget.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'

const MAX_EDGE = 2000
const QUALITY = 0.85

async function shrink(file: File): Promise<Blob> {
  // imageOrientation applies the phone's rotation flag before drawing, so a
  // portrait photo does not arrive on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot prepare photos.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob) throw new Error('Could not prepare that photo.')
    return blob
  } finally {
    bitmap.close()
  }
}

export type PhotoResult = { ok: true; images: string[] } | { ok: false; error: string }

export function PhotoManager({
  name,
  initial,
  published,
  upload: uploadAction,
  save: saveAction,
  kind = 'room',
}: {
  /** Used in each photo's alt text. */
  name: string
  initial: string[]
  published: boolean
  upload: (formData: FormData) => Promise<PhotoResult>
  save: (images: string[]) => Promise<PhotoResult>
  kind?: 'room' | 'building'
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState(initial)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [saving, startSaving] = useTransition()
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    setUploading({ done: 0, total: list.length })
    let failed = 0

    // One at a time, so they land in the order chosen and no single request
    // carries more than one photo.
    for (const [i, file] of list.entries()) {
      try {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a photo.`)
        const blob = await shrink(file).catch(() => {
          throw new Error(
            `${file.name} could not be opened. If it is an iPhone HEIC photo, share it as JPEG (Most Compatible) and try again.`
          )
        })
        const form = new FormData()
        form.append('photo', blob, 'photo.jpg')
        const result = await uploadAction(form)
        if (!result.ok) throw new Error(result.error)
        setImages(result.images)
      } catch (error) {
        failed += 1
        toast({
          title: 'A photo was not added',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
      }
      setUploading({ done: i + 1, total: list.length })
    }

    setUploading(null)
    if (input.current) input.current.value = ''
    const added = list.length - failed
    if (added > 0) {
      toast({ title: `${added} photo${added === 1 ? '' : 's'} added` })
      router.refresh()
    }
  }

  function save(next: string[], message: string) {
    const previous = images
    setImages(next) // show it straight away; put it back if the save fails
    startSaving(async () => {
      const result = await saveAction(next)
      if (!result.ok) {
        setImages(previous)
        toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
        return
      }
      setImages(result.images)
      toast({ title: message })
      router.refresh()
    })
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    save(next, to === 0 ? 'Cover photo changed' : 'Order saved')
  }

  function remove(index: number) {
    if (published && images.length === 1) {
      toast({
        title: 'This is the last photo',
        description: `A ${kind} on the website needs at least one. Hide it first, or add another photo.`,
        variant: 'destructive',
      })
      return
    }
    if (!window.confirm('Remove this photo from the room? This cannot be undone.')) return
    save(images.filter((_, i) => i !== index), 'Photo removed')
  }

  const busy = uploading !== null || saving

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {images.length === 0
            ? 'No photos yet. The first one becomes the cover.'
            : `${images.length} photo${images.length === 1 ? '' : 's'}. The first is the cover — drag to reorder, or use the arrows.`}
        </p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          id="room-photo-input"
          onChange={(e) => upload(e.target.files)}
          disabled={busy}
        />
        <Button type="button" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {uploading ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Uploading {uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} of {uploading.total}
            </>
          ) : (
            <>
              <ImagePlus className="mr-1.5 size-4" />
              Add photos
            </>
          )}
        </Button>
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
        >
          <ImagePlus className="size-6" />
          Choose photos from this device
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, index) => (
            <li
              key={src}
              draggable={!busy}
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) move(dragFrom, index)
                setDragFrom(null)
              }}
              onDragEnd={() => setDragFrom(null)}
              className={cn(
                'group relative overflow-hidden rounded-lg border border-border bg-secondary',
                dragFrom === index && 'opacity-40',
                !busy && 'cursor-grab active:cursor-grabbing'
              )}
            >
              {/* A plain img: these are previews in the console, and the
                  optimiser would only add a round trip per thumbnail. */}
              <img
                src={src}
                alt={`${name}, photo ${index + 1}`}
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {index === 0 && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                  <Star className="size-3 fill-current" />
                  Cover
                </span>
              )}
              <div className="flex items-center justify-between gap-1 border-t border-border bg-white px-1.5 py-1">
                <div className="flex gap-0.5">
                  <IconButton label="Move earlier" onClick={() => move(index, index - 1)} disabled={busy || index === 0}>
                    <ArrowLeft className="size-3.5" />
                  </IconButton>
                  <IconButton label="Move later" onClick={() => move(index, index + 1)} disabled={busy || index === images.length - 1}>
                    <ArrowRight className="size-3.5" />
                  </IconButton>
                  {index !== 0 && (
                    <IconButton label="Make cover photo" onClick={() => move(index, 0)} disabled={busy}>
                      <Star className="size-3.5" />
                    </IconButton>
                  )}
                </div>
                <IconButton label="Remove photo" onClick={() => remove(index)} disabled={busy} danger>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:bg-red-50 hover:text-red-600'
      )}
    >
      {children}
    </button>
  )
}
