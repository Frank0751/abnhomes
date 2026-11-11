'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Listing gallery: a hero photo with a thumbnail rail that opens a full-screen
 * viewer. Touch-friendly, keyboard-closable, honest about how many photos
 * there are.
 */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return <div className="aspect-[16/9] w-full rounded-xl bg-black/5" />
  }

  const hero = images[0]
  const rest = images.slice(1, 5)

  return (
    <>
      <div className="relative grid aspect-[16/9] w-full grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-xl">
        <button
          className="relative col-span-4 row-span-2 cursor-zoom-in sm:col-span-2"
          onClick={() => {
            setIndex(0)
            setOpen(true)
          }}
          aria-label={`Open photo 1 of ${images.length}`}
        >
          <Image src={hero} alt={name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" priority />
        </button>
        {rest.map((src, i) => (
          <button
            key={src + i}
            className={`relative hidden cursor-zoom-in sm:block ${i === rest.length - 1 && images.length > 5 ? '' : ''}`}
            onClick={() => {
              setIndex(i + 1)
              setOpen(true)
            }}
            aria-label={`Open photo ${i + 2} of ${images.length}`}
          >
            <Image src={src} alt={`${name} photo ${i + 2}`} fill sizes="25vw" className="object-cover" />
            {i === rest.length - 1 && images.length > 5 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-medium text-white">
                +{images.length - 5} more photos
              </span>
            )}
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0e1a]/97" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm text-white/80">
              {name} — {index + 1} / {images.length}
            </p>
            <button onClick={() => setOpen(false)} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Close gallery">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <Image src={images[index]} alt={`${name} photo ${index + 1}`} fill sizes="100vw" className="object-contain" />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setIndex((index - 1 + images.length) % images.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  onClick={() => setIndex((index + 1) % images.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-5 py-4">
            {images.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setIndex(i)}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded ${i === index ? 'ring-2 ring-[#14b8a6]' : 'opacity-60'}`}
                aria-label={`Photo ${i + 1}`}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
