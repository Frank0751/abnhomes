'use client'

import { useActionState } from 'react'
import { Send } from 'lucide-react'

type ActionState = { ok: true; message: string } | { ok: false; error: string } | null

export function TestMessageForm({ action }: { action: (formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    return action(formData)
  }, null)

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</span>
          <select
            name="channel"
            className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none"
            defaultValue="EMAIL"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</span>
          <input
            name="to"
            required
            placeholder="guest@example.com"
            className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subject (email only)</span>
        <input
          name="subject"
          placeholder="A quick test from ABN Homes"
          className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body</span>
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Hello from the ABN Homes notification centre."
          className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none"
        />
      </label>
      {state && (
        <p className={`text-[13px] ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0a0e1a] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        <Send className="size-3.5" />
        {pending ? 'Sending…' : 'Send test'}
      </button>
    </form>
  )
}
