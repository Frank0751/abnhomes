import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SignInForm } from './signin-form'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      {/* The photograph is the brand. It earns its place on the one screen
          every member of staff sees every morning. */}
      <div className="relative hidden lg:block">
        <Image
          src="/images/abn-real/abn-ig-2-hd.jpg"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/90 via-[#0a0e1a]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="font-serif text-3xl leading-tight text-white/95 max-w-md text-balance">
            Building dreams in every home.
          </p>
          <p className="mt-3 text-sm text-white/70 max-w-sm">
            8 Asiko Street, Tantra Hill, Accra
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16">
        <div className="w-full max-w-sm mx-auto">
          <Link href="/" className="inline-flex items-center gap-3 mb-10">
            <Image
              src="/images/logo/abn-badge.png"
              alt="ABN Homes"
              width={40}
              height={40}
              className="rounded-sm"
            />
            <span className="font-serif text-lg tracking-tight">ABN Homes</span>
          </Link>

          <h1 className="font-serif text-3xl tracking-tight text-balance">
            Sign in to operations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Bookings, tenancies, payments and maintenance for every ABN Homes building.
          </p>

          <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded bg-muted" />}>
            <SignInForm />
          </Suspense>

          <p className="mt-10 text-xs text-muted-foreground">
            Trouble signing in? Call the office on{' '}
            <a href="tel:+233541704048" className="underline underline-offset-2">
              054 170 4048
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
