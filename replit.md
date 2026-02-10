# FirstUser

## Overview

FirstUser is a platform where founders create waitlist communities called "AppSpaces" and early users earn collectible badges based on their position in the waitlist. The application features a distinctive dark purple-themed design system with glass morphism effects, gradient accents, and ambient floating backgrounds.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state and caching
- **Styling**: Tailwind CSS v4 with custom design tokens defined in `@theme` blocks
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite with custom plugins for Replit integration

### Design System
The application implements a custom "FirstUser Design System" with:
- **Typography**: Inter for body text, Space Grotesk for headlines
- **Color Palette**: Deep void background (#0a0510) with violet/fuchsia accent gradients
- **Component Styling**: Glass morphism panels, gradient buttons, and animated ambient backgrounds
- **CSS Utilities**: Custom classes like `glass-panel`, `glass-input`, `btn-gradient`, `text-gradient`

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **API Pattern**: RESTful JSON API with `/api` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod integration for type-safe schemas
- **Session Management**: connect-pg-simple for PostgreSQL session storage

### Data Model
Three main entities:
1. **Users**: Authentication with username/email/password
2. **AppSpaces**: Waitlist communities created by founders with slug-based URLs
3. **WaitlistMembers**: Join records tracking position and badge tier (1st, 10^1, 10^2, 10^3, 10^4)

### Project Structure
```
client/src/         # React frontend
  components/ui/    # shadcn/ui components
  pages/            # Route components
  lib/              # Utilities, API client, auth hooks
server/             # Express backend
  routes.ts         # API endpoints
  storage.ts        # Database access layer
  db.ts             # Drizzle connection
shared/             # Shared types and schemas
  schema.ts         # Drizzle table definitions
```

### Build System
- Development: Vite dev server with HMR proxied through Express
- Production: esbuild bundles server code, Vite builds client to `dist/public`
- Database: `drizzle-kit push` for schema migrations

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Libraries
- **Radix UI**: Accessible primitive components (dialog, dropdown, tabs, etc.)
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **Tailwind CSS**: Utility-first styling with custom theme configuration

### State & Data Fetching
- **TanStack Query**: Async state management and caching
- **Wouter**: Lightweight React router

### External Services
- **SendGrid**: Email delivery for verification codes (`SENDGRID_API_KEY` secret, used in `server/email.ts`)
- **Textbelt**: SMS delivery for phone verification codes (`TEXTBELT_API_KEY` secret, used in `server/sms.ts` and `server/routes.ts`)
- **EMAIL_FROM**: Optional env var to set sender address (defaults to `FirstUser <noreply@firstuser.app>`)
- **FOUNDER_PHONES**: Optional env var with comma-separated founder phone numbers for auto-granting founder role on phone verification

### Development Tools
- **Vite**: Frontend build tool with React plugin
- **Replit Plugins**: Dev banner, cartographer, runtime error overlay
- **TypeScript**: Full type coverage across frontend and backend