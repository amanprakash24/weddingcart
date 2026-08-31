# Wedding Cart Codebase Overview

**Project Name:** Shaadi Shopping (Wedding Cart)  
**Framework:** Next.js 16.2.2  
**Database:** PostgreSQL (via Prisma 7.8.0)  
**Auth:** NextAuth.js 4.24.14  
**Deployment:** Vercel  

---

## 📋 Project Summary

A comprehensive wedding marketplace and CRM platform that connects couples, vendors, and event organizers. The system handles:
- **Marketplace:** Browse and compare wedding vendors/venues by category and location
- **CRM:** Lead management, sales pipeline, vendor assignments
- **Wedding OS:** Complete wedding planning workspace (timeline, guests, approvals, finance)
- **Vendor OS:** Vendor onboarding, portfolio management, booking system
- **Finance:** Invoicing, payments via Razorpay, commission management

---

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend:** React 19.2.4, Next.js 16.2.2 with App Router
- **Styling:** Tailwind CSS 4, Framer Motion (animations)
- **Database:** PostgreSQL with Prisma ORM (7.8.0)
- **Auth:** NextAuth.js (JWT-based, credentials only)
- **Media:** Cloudinary for image/video uploads
- **Payment:** Razorpay integration
- **Rich Text:** TipTap editor (for blogs)
- **UI Components:** Lucide React icons
- **Validation:** Zod
- **Monorepo Support:** Bun lockfile management

### Key Services
- WhatsApp integration
- OTP-based authentication
- Payment webhook handling
- Google Ads tracking
- Rate limiting
- Role-based access control (RBAC)

---

## 📂 Directory Structure

### `/app` - Next.js Pages & API Routes (116 files)

#### **API Routes** (`/app/api/`) - 67 endpoints
Core business logic endpoints organized by domain:

**Admin Portal:**
- `admin/login`, `admin/me`, `admin/logout`

**Marketplace:**
- `vendors/[id]`, `categories/[id]`, `blogs/[slug]`
- `enquiries/[id]`, `bookings/[id]`, `consultations/[id]`

**CRM Dashboard:**
- `crm/leads/[sourceType]/[id]` (+ stage, assign, notes, tasks)
- `crm/sales-reps`, `crm/stats`, `crm/founder-dashboard`

**Wedding OS:**
- `weddings/[id]/` (guests, approvals, invoices, tasks, payouts, milestones, workspace, vendor-bookings, status, couple, notes)
- `weddings/[id]/invoices/[invoiceId]/payment-link`
- `weddings/[id]/vendor-bookings/[vbId]/payout`

**Vendor OS:**
- `vendors/[id]`, `vendor-applications/[id]`, `vendor/bookings/[bookingId]`
- `vendor-search`, `vendor-applications`

**Customer Portal:**
- `customer/approvals/[approvalId]`, `customer/weddings/[id]/guests/[guestId]`

**Events & Finance:**
- `events/[id]/` (checkin, orders)
- `invoices/[id]`, `payments/webhook`
- `rsvp/[token]`

**Utilities:**
- `otp/send`, `otp/verify`
- `leads/[id]` (Lead inbox)
- `upload`, `upload/video-signature`
- `seed` (Database seeding)
- `stats` (Global statistics)

#### **Page Routes** (`/app/...`) - 49 pages
**Admin Portal:** (`/admin/`)
- Dashboard, Blog management, Category management
- Vendor management, Event management, CRM Leads workspace

**Public Pages:**
- `/` (Homepage)
- `/about`, `/plan` (Wedding planning)
- `/blog/[slug]`, `/blog` (Blog listing)
- `/categories/[slug]`, `/cities/[city]/[category]`
- `/vendors/[id]`, `/portfolio/[id]`
- `/events/[slug]`, `/cart`, `/rsvp/[token]`

**Vendor Portal:** (`/vendor/`)
- Login, Dashboard

**Customer Portal:** (`/customer/`)
- Login, Dashboard, Wedding workspace

**Venue Pages:** (`/venues/`)
- Location-specific pages (patna/boring-road, kankarbagh, etc.)

**Vendor Landing Pages:**
- `/vendors/7-vachan-patna`, `/vendors/swayamvar-hall-patna`, `/vendors/touch-of-cozy-patna`

**Special Pages:**
- `/vendor-onboarding` (Vendor registration)
- SEO: `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`

---

### `/components` - React Components (105 files)

#### **Root Components** (39 components)
Core UI and page wrappers:
- **Navigation:** `Navbar.tsx`, `Footer.tsx`
- **Auth:** `OtpLoginClient.tsx`, `AdminLoginClient.tsx`
- **Portal Pages:** `PortalHomeClient.tsx`, `ClientPortalClient.tsx`, `VenuePortalClient.tsx`
- **Shopping:** `CartDrawer.tsx`, `CartFAB.tsx`, `CartPageClient.tsx`
- **Marketplace:** `VendorCard.tsx`, `VendorDetailClient.tsx`, `CategoryCard.tsx`, `CategoryPageClient.tsx`
- **Public Pages:** `HomepageClient.tsx`, `AboutClient.tsx`, `PlanPageClient.tsx`
- **Features:** `TipTapEditor.tsx` (Rich text), `LeadCapturePopup.tsx`
- **SEO:** `JsonLd.tsx`, `RelatedGuides.tsx`
- **Utilities:** `ScrollToTop.tsx`, `AuthSessionProvider.tsx`
- **Vendor Pages:** `SevenVachanVendorPageClient.tsx`, `SwayamvarVendorPageClient.tsx`, `TouchOfCozyVendorPageClient.tsx`

#### **CRM Components** (`/components/crm/`) - 29 files
Lead management and sales dashboard:
- **Main:** `CrmDashboardClient.tsx`, `LeadTable.tsx`, `LeadSearch.tsx`, `LeadFilters.tsx`
- **Workspace:** `LeadWorkspaceClient.tsx`, `LeadWorkspaceHeader.tsx`, `CustomerCard.tsx`
  - `AssignControl.tsx`, `StageControl.tsx` (Lead manipulation)
  - `TaskPanel.tsx`, `VendorInterestPanel.tsx`, `InsightsPanel.tsx`
  - `Timeline.tsx`, `ConvertToWeddingDialog.tsx`, `WeddingDetailsCard.tsx`
- **Dashboard:** `FounderDashboardClient.tsx`
  - Cards: `BusinessPerformanceCard.tsx`, `CommissionCard.tsx`, `PipelineHealthCard.tsx`, `FollowUpHealthCard.tsx`
  - `TeamPerformanceCard.tsx`, `VendorAvailabilityCard.tsx`, `PipelineVelocityCard.tsx`, `CommandCenter.tsx`
- **Utils:** `StatsCards.tsx`, `TodaysWork.tsx`, `types.ts`

#### **Wedding Components** (`/components/wedding/workspace/`) - 12 files
Wedding planning dashboard:
- **Main:** `WeddingWorkspaceClient.tsx`, `WeddingHeader.tsx`
- **Sections:** `CoupleCard.tsx`, `GuestRsvp.tsx`, `Approvals.tsx`, `Finance.tsx`
- **Planning:** `TimelineMilestones.tsx`, `ServiceRequirements.tsx`, `WeddingEvents.tsx`, `Documents.tsx`
- **Utils:** `types.ts`, `constants.ts`

#### **Homepage Components** (`/components/homepage/`) - 17 files
Landing page sections:
- `HeroSection.tsx`, `ValuePropsSection.tsx`, `CitiesSection.tsx`
- `FeaturedVendorsSection.tsx`, `BudgetSection.tsx`, `WeddingStylesSection.tsx`
- `ExpertSection.tsx`, `TestimonialsSection.tsx`, `BlogHighlightsSection.tsx`
- `JourneySection.tsx`, `AboutBrandSection.tsx`, `FinalCtaSection.tsx`
- **Utils:** `CountUpStat.tsx`, `TrustStats.tsx`, `LazyVideo.tsx`, `animations.ts`

#### **Admin Components** (`/components/admin/`) - 4 files
- `EventAdminClient.tsx`, `EventForm.tsx`
- `ImageUploadField.tsx`, `VideoUploadField.tsx`

#### **Other Components**
- **Venues:** `LocalityGuidePage.tsx`, `VenueFilterList.tsx`
- **Events:** `EventPublicClient.tsx`
- **Plan:** `LivePlanPreview.tsx`

---

### `/lib` - Business Logic & Utilities (33 files)

#### **Core Services**
- `prisma.ts` - Database client with Prisma 7 adapter setup
- `mongodb.ts` - MongoDB connection (legacy)
- `users.ts` - User utilities
- `slug.ts` - URL slug generation
- `errors.ts` - Error handling

#### **Auth System** (`/lib/auth/`)
- `auth.ts` - NextAuth configuration & providers
- `session.ts` - JWT session management
- `roles.ts` - Role definitions (SUPER_ADMIN, SALES, OPERATIONS, VENDOR, CUSTOMER)
- `permissions.ts` - Permission matrix
- `rateLimit.ts` - Rate limiting for OTP, API endpoints

#### **Third-Party Integrations**
- `razorpay.ts` - Payment processing
- `whatsapp.ts` - WhatsApp Business API
- `shaadiPhone.ts` - Shaadi.com phone integration
- `shaadiContact.ts` - Shaadi.com contact sync

#### **Wedding Domain** (`/lib/wedding/`)
- `lifecycle.ts` - Wedding status transitions & workflows
- `timeline.ts` - Milestone management
- `health.ts` - Wedding health score calculation

#### **CRM Domain** (`/lib/crm/`)
- `pipeline.ts` - Sales pipeline stages & flow
- `subject.ts` - Subject line generation for communications

#### **Data Models** (`/lib/models/`) - 11 files
Mongoose models (legacy, used in migration):
- `Vendor.ts`, `VendorApplication.ts`, `Category.ts`
- `Booking.ts`, `Enquiry.ts`, `Consultation.ts`
- `Invoice.ts`, `Blog.ts`, `Lead.ts`, `OTP.ts`

#### **Serializers** (`/lib/serializers/`)
- `vendor.ts` - Vendor data serialization

#### **Analytics**
- `googleAds.ts` - Google Ads conversion tracking

#### **Other**
- `adminAuth.ts` - Admin HMAC session (legacy)
- `planPreview.ts` - Wedding plan rendering

---

### `/services` - Business Logic Layer (25 files)

Domain-driven service layer implementing workflows:

**Marketplace Services:**
- `vendor.service.ts`, `vendorApplication.service.ts`
- `category.service.ts`, `booking.service.ts`
- `enquiry.service.ts`, `consultation.service.ts`
- `blog.service.ts`, `event.service.ts`

**CRM Services:**
- `lead.service.ts`, `leadWorkspace.service.ts`, `leadInbox.service.ts`
- `commandCenter.service.ts`, `founderDashboard.service.ts`

**Wedding OS Services:**
- `weddingWorkspace.service.ts`, `weddingConversion.service.ts`
- `guest.service.ts`, `approval.service.ts`

**Vendor OS Services:**
- `venuePortal.service.ts`

**Finance Services:**
- `invoice.service.ts`, `payment.service.ts`, `payout.service.ts`

**Support Services:**
- `otp.service.ts`, `clientPortal.service.ts`
- `stats.service.ts`, `seed.service.ts`

---

### `/repositories` - Data Access Layer (28 files)

Prisma-based repository pattern:
- `wedding.repository.ts`, `weddingEvent.repository.ts`
- `vendorBooking.repository.ts`, `vendor.repository.ts`
- `vendorApplication.repository.ts`, `task.repository.ts`
- `lead.repository.ts`, `leadInsight.repository.ts`
- `invoice.repository.ts`, `payment.repository.ts`, `paymentLink.repository.ts`
- `payout.repository.ts`, `couple.repository.ts`
- `timelineMilestone.repository.ts`, `booking.repository.ts`
- `enquiry.repository.ts`, `consultation.repository.ts`, `blog.repository.ts`
- `category.repository.ts`, `vendor.repository.ts`
- `event.repository.ts`, `eventOrder.repository.ts`, `eventTicket.repository.ts`, `eventPassType.repository.ts`
- `document.repository.ts`, `otp.repository.ts`
- `activityLog.repository.ts`, `commissionRate.repository.ts`

---

### `/context` - React Context (1 file)
- `CartContext.tsx` - Shopping cart state management

---

### `/prisma` - Database Schema & Migrations
- `schema.prisma` - Complete Prisma schema (Phase A: 1:1 Marketplace/CRM port, Phase B: Wedding OS greenfield)

**Model Categories in Schema:**
1. **Auth Models:** User, Role enum
2. **Marketplace Models:** Vendor, Category, Booking, Enquiry, Consultation, Blog
3. **CRM Models:** Lead, CommissionRate, LeadInsight
4. **Wedding OS Models:** Wedding, Couple, TimelineMilestone, ApprovalRequest, WeddingEvent, VendorBooking, Task
5. **Finance Models:** Invoice, Payment, PaymentLink, Payout
6. **Vendor OS Models:** VendorApplication, EventTicket, EventPassType, EventOrder
7. **Shared Models:** ActivityLog (append-only event log)

---

### `/data` - Static Data & Configuration
Data files for seed data, constants, or migration references

---

### `/docs` - Documentation
Architecture guides and planning documents

---

### `/public` - Static Assets
Public-facing images, icons, fonts

---

### `/generated` - Auto-Generated Files
- Prisma client generation (TypeScript types)

---

### `/scripts` - Utility Scripts
Build and utility scripts

---

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration (redirects, image domains) |
| `tailwind.config.ts` | Tailwind CSS customization |
| `postcss.config.mjs` | PostCSS plugins (Tailwind) |
| `.prettierrc.json` | Code formatting rules |
| `eslint.config.mjs` | Linting rules (ESLint 9) |
| `prisma.config.ts` | Prisma connection URL (Prisma 7 pattern) |
| `middleware.ts` | Edge middleware (auth routing) |
| `.env.example` | Environment variable template |
| `.env.local` | Local environment secrets |

---

## 🔐 Authentication & Authorization

### Roles
1. **SUPER_ADMIN** - Full system access
2. **SALES** - CRM & lead management
3. **OPERATIONS** - Event & workshop ops
4. **VENDOR** - Vendor portal access
5. **CUSTOMER** - Customer/couple portal access

### Auth Flows
- **Credentials Login:** Admin/Vendor/Customer portals (NextAuth.js)
- **OTP Login:** Customer registration (SMS via Shaadi.com)
- **JWT Sessions:** Stored as cookies, validated at middleware/API level

### Protected Routes
- `/admin/*` - SUPER_ADMIN, SALES, OPERATIONS
- `/vendor/*` - VENDOR
- `/customer/*` - CUSTOMER

---

## 💼 Key Domains & Features

### 1. **Marketplace**
   - Browse vendors by category, location, price
   - Vendor portfolios with images/videos
   - Inquiry/booking workflow
   - Blog & guides

### 2. **CRM (Lead Management)**
   - Lead inbox from multiple sources (Shaadi.com, website forms)
   - Sales pipeline stages (New → Contacted → Negotiating → Confirmed)
   - Lead assignment to sales reps
   - Lead-to-wedding conversion
   - Commission tracking
   - Founder dashboard with KPIs

### 3. **Wedding OS (Planning)**
   - Wedding workspace for couples
   - Guest list management with RSVP
   - Timeline & milestones
   - Vendor bookings & approvals
   - Finance tracking
   - Document storage
   - Activity log (event trail)

### 4. **Vendor OS**
   - Vendor onboarding & application approval
   - Portfolio management
   - Event/ticket sales
   - Payout processing

### 5. **Finance**
   - Invoice generation & tracking
   - Payment processing via Razorpay
   - Commission rates per vendor
   - Payout workflows

### 6. **Events**
   - Event creation & management
   - Ticket/pass types
   - Orders & check-ins
   - Event analytics

---

## 📊 Data Architecture

### Database Layers
1. **PostgreSQL** - Primary database (via Prisma)
2. **MongoDB** - Legacy fallback (models still in `/lib/models/`)
3. **Cloudinary** - Media storage (images/videos)

### Key Tables (~50 Prisma models)
- **Core:** User, Role
- **Marketplace:** Vendor, Category, Booking, Enquiry, Consultation, Blog
- **CRM:** Lead, CommissionRate, LeadInsight
- **Wedding:** Wedding, Couple, TimelineMilestone, ApprovalRequest, WeddorEvent, VendorBooking, Task
- **Finance:** Invoice, Payment, PaymentLink, Payout
- **Vendor:** VendorApplication, EventTicket, EventPassType, EventOrder
- **Audit:** ActivityLog (immutable, append-only)

### Event Sourcing Pattern
- Architectural principle: **Store events, not dashboard state**
- `ActivityLog` is the source of truth for wedding progress, health score, and AI summaries
- Mutable fields (status) are caches for query speed, not primary facts

---

## 🚀 Deployment & DevOps

### Hosting
- **Vercel** (automatic deployments)
- Main branch → Production
- PRs → Preview URLs

### Environment Setup
- `.env.local` - Local secrets (not in git)
- `NEXTAUTH_SECRET` - Session encryption
- `DATABASE_URL` - PostgreSQL connection
- Razorpay keys, Cloudinary credentials, Shaadi.com tokens

### Build & Dev Commands
```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm start            # Serve production build
npm run lint         # ESLint check
npm run format       # Prettier format
npm run format:check # Check formatting
```

---

## 🔄 API Endpoints Summary

**~67 API routes organized by domain:**
- Admin authentication & management
- Marketplace (vendors, categories, bookings)
- CRM (leads, workspace, stats)
- Wedding OS (full planning suite)
- Vendor OS (applications, bookings)
- Finance (invoices, payments, payouts)
- Customer portal (approvals, guest management)
- Events (orders, check-ins)
- Utilities (OTP, uploads, webhooks)

---

## 📋 Notable Architectural Decisions

1. **Next.js App Router** - Latest Next.js 16 with server components
2. **Prisma 7 with Driver Adapter** - Connection URL via `prisma.config.ts` (not schema)
3. **JWT Sessions** - Stateless, edge-compatible auth via NextAuth.js
4. **Repository Pattern** - Clean separation between API routes and data access
5. **Service Layer** - Business logic encapsulation
6. **Event Log Architecture** - ActivityLog as immutable event trail for state derivation
7. **Hybrid Model Migration** - Phase A (legacy 1:1 port) + Phase B (new Wedding OS greenfield)
8. **Role-Based Access Control** - Fine-grained permissions matrix

---

## 🎯 What This Platform Does

**Shaadi Shopping** is an end-to-end wedding marketplace and planning platform:
- **For Couples:** Browse vendors, plan weddings, manage guests, track finance
- **For Vendors:** Onboard, manage bookings, track commissions, engage customers
- **For Admin:** Manage marketplace, track sales pipeline, analyze KPIs
- **For Operators:** Manage events, track tickets, handle fulfillment

---

## 📚 Key Files to Read First
1. `package.json` - Dependencies overview
2. `prisma/schema.prisma` - Data model
3. `middleware.ts` - Auth routing
4. `app/api/auth/[...nextauth]/route.ts` - Auth setup
5. `services/*.ts` - Business logic examples
6. `repositories/*.ts` - Data access patterns
7. `.env.example` - Required environment variables

---

*Last Updated: 2026-08-30*
