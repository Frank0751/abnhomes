# ABN Homes Company Limited Website

A world-class, full-stack luxury real estate website for **ABN Homes Company Limited**, Accra, Ghana. Built with Next.js 16, TypeScript, Tailwind CSS 4, Prisma, and Framer Motion.

![ABN Homes](public/images/logo/abn-homes-logo-real.png)

## Features

- **7 Independent Pages** with Next.js App Router
  - Home (`/`) - Full single-page experience with 13 sections
  - About (`/about`) - Company story, 8 services, process, testimonials
  - Residences (`/residences`) - Property listings with detail modal, mortgage calculator
  - Amenities (`/amenities`) - 12 amenities + 8 detailed services
  - Gallery (`/gallery`) - Filterable masonry gallery with lightbox + social feed
  - Locations (`/locations`) - 3 Accra areas with Google Map embed
  - Contact (`/contact`) - Enquiry form, contact card, newsletter signup

- **Backend API** with Prisma + SQLite
  - `POST /api/enquiries` - Contact form submissions (with Zod validation, honeypot, rate limiting)
  - `POST /api/subscribers` - Newsletter signup
  - `POST /api/tours` - Tour booking requests
  - `GET /api/enquiries` - Admin-only enquiry retrieval (Bearer token auth)

- **Real ABN Content**
  - 12 real Instagram images from @abn_homes
  - 6 real TikTok cover images from @greatpuffy
  - 11 real Instagram captions integrated into the site
  - Real company bio: "We Build and Sell affordable Houses, We Buy and Sell Lands, Constructions, Project Management, Architectural Drawings, Project Supervising, Renovations"
  - Real address: 8 Asiko Street, Tantra Hill, Accra
  - Real phone: 054 170 4048

- **Interactive Features**
  - Cinematic hero with animated "ABN HOMES" 3D letter reveal
  - Property detail modal with image gallery and inline mortgage calculator
  - WhatsApp floating chat button with expandable preview
  - EN/FR language switcher with full i18n
  - Filterable gallery with keyboard-navigable lightbox
  - Parallax interior spotlight carousel
  - Animated count-up stats
  - Back-to-top button

- **SEO & PWA**
  - JSON-LD structured data (RealEstateAgent schema)
  - PWA manifest (installable)
  - Sitemap.xml and robots.txt
  - OpenGraph and Twitter card metadata
  - Per-page unique metadata

- **Design**
  - Brand colors: Deep charcoal (#0a0e1a) + Teal (#0d9488) + Cream (#faf8f3)
  - Typography: Playfair Display (serif headings), Inter (body), Cormorant Garamond (display)
  - Fully responsive (mobile, tablet, desktop)
  - Custom SVG logo and favicon
  - No em dashes, no italics in headings (per brand spec)

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| Animations | Framer Motion |
| Icons | Lucide React |
| Validation | Zod |
| Fonts | next/font (Playfair Display, Inter, Cormorant Garamond) |

## Quick Start

### Prerequisites

- Node.js 18.17+ (or Bun)
- npm, yarn, pnpm, or bun

### Installation

1. **Clone or download this folder**

```bash
cd abn-homes-website
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set your values:
```env
DATABASE_URL=file:./db/custom.db
ABN_ADMIN_TOKEN=your-secret-admin-token-here
ABN_WEBHOOK_URL=  # Optional: Slack/Discord webhook for enquiry notifications
```

4. **Initialize the database**

```bash
npm run db:push
```

5. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

### Option 1: One-Click Deploy (Recommended)

1. Push this folder to a GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit: ABN Homes website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/abn-homes-website.git
git push -u origin main
```

2. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.

3. Vercel will auto-detect Next.js. Add these environment variables in the Vercel dashboard:
   - `DATABASE_URL` - Use a PostgreSQL URL (see Database Setup below)
   - `ABN_ADMIN_TOKEN` - A secret token for the admin API
   - `ABN_WEBHOOK_URL` - Optional, for enquiry notifications

4. Click **Deploy**. Your site will be live in ~2 minutes.

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. Set environment variables with:
```bash
vercel env add DATABASE_URL
vercel env add ABN_ADMIN_TOKEN
```

### Database Setup for Production

SQLite works locally but is NOT suitable for Vercel (serverless, no persistent filesystem). Use one of these for production:

**Option A: Vercel Postgres (Recommended)**
1. In Vercel dashboard, go to Storage > Create Database > Postgres
2. Copy the `DATABASE_URL` to your environment variables
3. Update `prisma/schema.prisma` datasource provider from `sqlite` to `postgresql`
4. Run `npx prisma db push`

**Option B: PlanetScale, Supabase, or Neon**
- Create a free PostgreSQL database on [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com)
- Copy the connection string to `DATABASE_URL`
- Update the Prisma schema provider to `postgresql`
- Run `npx prisma db push`

## Project Structure

```
abn-homes-website/
├── prisma/
│   └── schema.prisma          # Database models (Enquiry, Subscriber, TourBooking)
├── public/
│   ├── images/
│   │   ├── abn-real/          # 19 real ABN Instagram + TikTok images (HD enhanced)
│   │   ├── logo/              # ABN Homes logo (PNG variants)
│   │   ├── properties/        # Additional property images
│   │   ├── interiors/         # Additional interior images
│   │   └── locations/         # Accra location images
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── about/page.tsx     # /about
│   │   ├── amenities/page.tsx # /amenities
│   │   ├── api/
│   │   │   ├── enquiries/route.ts   # POST + GET enquiries
│   │   │   ├── subscribers/route.ts # POST subscribers
│   │   │   └── tours/route.ts       # POST tour bookings
│   │   ├── contact/page.tsx   # /contact
│   │   ├── gallery/page.tsx   # /gallery
│   │   ├── locations/page.tsx # /locations
│   │   ├── residences/page.tsx# /residences
│   │   ├── globals.css        # Global styles + ABN brand colors
│   │   ├── layout.tsx         # Root layout (nav, footer, fonts, SEO)
│   │   ├── manifest.ts        # PWA manifest
│   │   ├── page.tsx           # Home page
│   │   ├── robots.ts          # robots.txt
│   │   └── sitemap.ts         # sitemap.xml
│   ├── components/
│   │   ├── site/              # 23 ABN-specific components
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── abn-data.ts        # Shared ABN content (properties, amenities, etc.)
│   │   ├── db.ts              # Prisma client
│   │   └── utils.ts           # Utility functions
│   └── hooks/
├── .env.example
├── .gitignore
├── components.json            # shadcn/ui config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on localhost:3000 |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create and apply migration |

## API Endpoints

### POST /api/enquiries
Submit a contact form enquiry.
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+233 24 000 0000",
  "interest": "Tantra Hill",
  "message": "I would like to tour the penthouse."
}
```

### GET /api/enquiries
Retrieve all enquiries (admin only).
```bash
curl -H "Authorization: Bearer YOUR_ABN_ADMIN_TOKEN" https://your-domain.com/api/enquiries
```

### POST /api/subscribers
Newsletter signup.
```json
{
  "email": "subscriber@example.com",
  "name": "Optional Name"
}
```

### POST /api/tours
Book a property tour.
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+233 24 000 0000",
  "property": "Tantra Hill",
  "preferredDate": "2026-08-15",
  "partySize": 2,
  "virtual": false
}
```

## Customization

### Update Content
All site content is centralized in `src/lib/abn-data.ts`:
- `COMPANY` - Business name, phone, email, address, social links
- `properties` - Property listings (name, description, images, specs, pricing)
- `amenities` - Amenity grid items
- `services` - The 8 services from the official ABN bio
- `galleryShots` - Gallery images with categories and captions
- `socialPosts` - Social media feed posts
- `testimonials` - Customer testimonials
- `processSteps` - The 4-step booking process
- `locations` - Accra locations

### Change Colors
Edit `src/app/globals.css`:
```css
:root {
  --background: #faf8f3;    /* Cream background */
  --primary: #0a0e1a;        /* Deep charcoal */
  --accent: #0d9488;         /* Teal (ABN brand) */
}
```

### Replace Images
Put new images in `public/images/abn-real/` and update references in `src/lib/abn-data.ts`.

### Update Logo
Replace files in `public/images/logo/`:
- `abn-homes-logo-real.png` - Main logo (600x600, white background)
- `abn-badge.png` - Favicon/monogram (180x180, dark background)

## Real Content Sources

All images and captions were extracted from:
- **Instagram**: [@abn_homes](https://www.instagram.com/abn_homes/)
- **TikTok**: [@greatpuffy](https://www.tiktok.com/@greatpuffy) (Abraham Nayo, CEO)

Images were enhanced to 2x resolution using sharp with lanczos3 upscaling and sharpening filters.

## License

Proprietary - ABN Homes Company Limited. All rights reserved.

## Contact

- **Phone**: 054 170 4048
- **Email**: hello@abnhomes.com.gh
- **Address**: 8 Asiko Street, Tantra Hill, Accra, Ghana
- **Instagram**: @abn_homes
- **TikTok**: @greatpuffy
