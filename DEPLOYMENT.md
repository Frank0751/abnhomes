# ABN Homes Website - Deployment Checklist

Use this checklist when deploying to Vercel for the first time.

## Pre-Deployment (Local)

- [ ] Install Node.js 18.17+ from [nodejs.org](https://nodejs.org)
- [ ] Run `npm install` in the project folder
- [ ] Copy `.env.example` to `.env` and fill in values
- [ ] Run `npm run db:push` to create the local SQLite database
- [ ] Run `npm run dev` and verify the site works at http://localhost:3000
- [ ] Run `npm run lint` and fix any errors
- [ ] Run `npm run build` to verify production build succeeds

## GitHub Setup

- [ ] Create a new repository on GitHub (e.g., `abn-homes-website`)
- [ ] Initialize git in the project folder:
  ```bash
  git init
  git add .
  git commit -m "Initial commit: ABN Homes website"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/abn-homes-website.git
  git push -u origin main
  ```

## Vercel Deployment

- [ ] Go to [vercel.com](https://vercel.com) and sign in with GitHub
- [ ] Click "Add New Project" > Import your `abn-homes-website` repository
- [ ] Vercel auto-detects Next.js. Verify these settings:
  - Framework Preset: Next.js
  - Build Command: `npm run build` (should be auto-detected)
  - Output Directory: `.next` (should be auto-detected)
  - Install Command: `npm install` (should be auto-detected)

## Environment Variables (CRITICAL)

In the Vercel dashboard, go to Settings > Environment Variables and add:

- [ ] `DATABASE_URL` - **You MUST switch from SQLite to PostgreSQL for Vercel**
  - Recommended: Create a Vercel Postgres database (Storage tab > Create Database)
  - Or use [Neon](https://neon.tech) (free tier) or [Supabase](https://supabase.com)
  - Example: `postgresql://user:password@host:5432/dbname?sslmode=require`

- [ ] `ABN_ADMIN_TOKEN` - A secret string for the admin API
  - Generate one: `openssl rand -hex 32`
  - Example: `a1b2c3d4e5f6...`

- [ ] `ABN_WEBHOOK_URL` (Optional) - For Slack/Discord enquiry notifications
  - Leave empty if not needed

## Database Migration (SQLite to PostgreSQL)

**Important**: SQLite does NOT work on Vercel because serverless functions have no persistent filesystem.

- [ ] Open `prisma/schema.prisma`
- [ ] Change the datasource provider from `sqlite` to `postgresql`:
  ```prisma
  datasource db {
    provider = "postgresql"  // was "sqlite"
    url      = env("DATABASE_URL")
  }
  ```
- [ ] Commit and push the change
- [ ] After Vercel deploys, run the migration:
  ```bash
  npx prisma db push --url "YOUR_POSTGRES_URL"
  ```
  Or use the Vercel Postgres CLI to run migrations.

## Post-Deployment Verification

- [ ] Visit your Vercel URL (e.g., `https://abn-homes-website.vercel.app`)
- [ ] Test all 7 pages: Home, About, Residences, Amenities, Gallery, Locations, Contact
- [ ] Submit the contact form and verify it saves to the database
- [ ] Subscribe to the newsletter and verify it saves
- [ ] Test the WhatsApp floating button
- [ ] Test the property detail modal (click "View Detail" on a residence)
- [ ] Test the mortgage calculator sliders
- [ ] Test mobile responsiveness (resize browser or use dev tools)
- [ ] Test the language switcher (EN/FR)
- [ ] Verify the Google Map embed loads on Locations page

## Custom Domain (Optional)

- [ ] In Vercel dashboard, go to Settings > Domains
- [ ] Add your domain (e.g., `abnhomes.com.gh`)
- [ ] Update DNS records as instructed by Vercel
- [ ] Update `src/app/layout.tsx` `metadataBase` URL to your domain
- [ ] Update `src/app/sitemap.ts` URLs to your domain
- [ ] Update `src/app/robots.ts` host URL to your domain

## Admin API Access

To retrieve enquiries from your deployed site:

```bash
curl -H "Authorization: Bearer YOUR_ABN_ADMIN_TOKEN" \
  https://your-domain.vercel.app/api/enquiries
```

Filter by status:
```bash
curl -H "Authorization: Bearer YOUR_ABN_ADMIN_TOKEN" \
  "https://your-domain.vercel.app/api/enquiries?status=new"
```

## Troubleshooting

### Build fails on Vercel
- Check that `prisma/schema.prisma` uses `postgresql` not `sqlite`
- Verify `DATABASE_URL` is set in Vercel environment variables
- Check Vercel build logs for the specific error

### Images not loading
- All images are local in `/public/images/` so they should work
- If using remote images, add the hostname to `next.config.ts` `images.remotePatterns`

### Database connection errors
- Verify `DATABASE_URL` is the PostgreSQL connection string (not SQLite)
- Ensure the database is accessible from Vercel (not localhost)
- Check that `prisma generate` runs during build (it's in the `postinstall` script)

### Contact form returns 500
- Check that the database is connected (see DATABASE_URL above)
- Verify the `Enquiry` model exists in the database (`npx prisma db push`)
- Check Vercel function logs for the specific error

## Need Help?

- **Phone**: 054 170 4048
- **Instagram**: @abn_homes
- **TikTok**: @greatpuffy
