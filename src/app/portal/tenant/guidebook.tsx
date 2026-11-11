'use client'

import { useState } from 'react'
import { BookOpen, Wifi, Zap, Droplets, ShieldCheck, DoorOpen, ScrollText, MapPin } from 'lucide-react'

export type GuidebookData = {
  homeName: string
  address: string
  wifiName?: string | null
  wifiPassword?: string | null
  houseRules: string[]
  safety: {
    smokeAlarm?: boolean
    coAlarm?: boolean
    fireExtinguisher?: boolean
    firstAidKit?: boolean
    securityCameraNote?: string
    hazardNote?: string
  }
  backupPower?: string | null
  generatorKva?: number | null
  waterStorageLitres?: number | null
  securityNotes?: string | null
  doorCode?: string | null
  accessNotes?: string | null
  checkInFrom?: string | null
  checkOutUntil?: string | null
}

/** The in-stay house manual: everything a guest needs once they are through the door. */
export function GuidebookButton({ data }: { data: GuidebookData }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/5"
      >
        <BookOpen className="size-3" />
        House manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lifted sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl tracking-tight">House manual — {data.homeName}</h3>

            <section className="mt-4 space-y-3 text-sm">
              {(data.doorCode || data.accessNotes) && (
                <div className="rounded-xl bg-[#0a0e1a] px-4 py-3 text-white">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
                    <DoorOpen className="size-3.5" /> Door access
                  </p>
                  {data.doorCode && (
                    <p className="mt-1 font-mono text-2xl tracking-widest">{data.doorCode}</p>
                  )}
                  {data.accessNotes && <p className="mt-1 text-xs text-white/70">{data.accessNotes}</p>}
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-muted-foreground">{data.address}</p>
                </div>
              </div>

              {(data.wifiName || data.wifiPassword) && (
                <div className="flex items-start gap-3">
                  <Wifi className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                  <div>
                    <p className="font-medium">Wi-Fi</p>
                    <p className="text-muted-foreground">
                      {data.wifiName ?? 'Network'} {data.wifiPassword ? `· password: ${data.wifiPassword}` : ''}
                    </p>
                  </div>
                </div>
              )}

              {data.backupPower && data.backupPower !== 'none' && (
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                  <div>
                    <p className="font-medium">Power cuts</p>
                    <p className="text-muted-foreground">
                      {data.backupPower === 'generator' && `The generator starts automatically${data.generatorKva ? ` (${data.generatorKva} kVA)` : ''}. Lights and sockets stay on; the AC pauses for about two minutes during switch-over.`}
                      {data.backupPower === 'inverter' && 'The inverter carries lights, Wi-Fi and sockets automatically.'}
                      {data.backupPower === 'solar hybrid' && 'Solar with battery backup carries the essentials.'}
                    </p>
                  </div>
                </div>
              )}

              {data.waterStorageLitres ? (
                <div className="flex items-start gap-3">
                  <Droplets className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                  <div>
                    <p className="font-medium">Water</p>
                    <p className="text-muted-foreground">
                      {(data.waterStorageLitres / 1000).toFixed(1)} m³ stored on site — the taps keep
                      running when the city supply stops.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <ScrollText className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                <div>
                  <p className="font-medium">House rules</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {data.houseRules.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                <div>
                  <p className="font-medium">Safety &amp; security</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {data.safety.smokeAlarm && <li>· Smoke alarm installed</li>}
                    {data.safety.coAlarm && <li>· Carbon monoxide alarm installed</li>}
                    {data.safety.fireExtinguisher && <li>· Fire extinguisher in the kitchen</li>}
                    {data.safety.firstAidKit && <li>· First aid kit on site</li>}
                    {data.safety.securityCameraNote && <li>· {data.safety.securityCameraNote}</li>}
                    {data.safety.hazardNote && <li>· {data.safety.hazardNote}</li>}
                    {data.securityNotes && <li>· {data.securityNotes}</li>}
                  </ul>
                </div>
              </div>

              <p className="border-t border-black/[0.06] pt-3 text-xs text-muted-foreground">
                Check-in from {data.checkInFrom ?? '15:00'} · checkout by {data.checkOutUntil ?? '11:00'} ·
                Emergency? Call or WhatsApp +233 54 170 4048 — someone answers.
              </p>
            </section>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg bg-[#0a0e1a] px-4 py-2.5 text-sm font-medium text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
