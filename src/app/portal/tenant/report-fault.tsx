'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reportFaultAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Loader2, Wrench } from 'lucide-react'

export function ReportFaultDialog({
  unitId,
  unitName,
  triggerClassName,
}: {
  propertyId: string
  unitId: string
  unitName: string
  triggerClassName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <Wrench className="mr-1.5 size-4" />
          Report a problem
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form
          action={(formData) =>
            start(async () => {
              const result = await reportFaultAction(formData)
              if (result.ok) {
                toast({ title: result.message ?? 'Reported' })
                setOpen(false)
                router.refresh()
              } else {
                toast({ title: 'Not reported', description: result.error, variant: 'destructive' })
              }
            })
          }
        >
          <input type="hidden" name="unitId" value={unitId} />

          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              At {unitName}. We will text you when it is picked up and again when it is fixed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">What is wrong</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Kitchen tap is leaking"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">A little more detail</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                required
                placeholder="When it started, how bad it is, anything you have already tried."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Type</Label>
                <Select name="category" defaultValue="OTHER">
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLUMBING">Plumbing</SelectItem>
                    <SelectItem value="ELECTRICAL">Electrical</SelectItem>
                    <SelectItem value="AIR_CONDITIONING">Air conditioning</SelectItem>
                    <SelectItem value="APPLIANCE">Appliance</SelectItem>
                    <SelectItem value="WATER_SUPPLY">Water supply</SelectItem>
                    <SelectItem value="POWER_BACKUP">Power or backup</SelectItem>
                    <SelectItem value="SECURITY">Security</SelectItem>
                    <SelectItem value="INTERNET">Internet</SelectItem>
                    <SelectItem value="PEST">Pests</SelectItem>
                    <SelectItem value="STRUCTURAL">Structural</SelectItem>
                    <SelectItem value="OTHER">Something else</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">How urgent</Label>
                <Select name="priority" defaultValue="NORMAL">
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMERGENCY">Emergency — unsafe or flooding</SelectItem>
                    <SelectItem value="HIGH">Urgent — cannot use the room</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="LOW">Whenever convenient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
