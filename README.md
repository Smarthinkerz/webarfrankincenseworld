# AR Vision Studio

AR Vision Studio is a Next.js 15 and Supabase WebAR SaaS preview with multilingual public pages, a WebAR player shell, and an admin CMS live-preview workspace.

The stack is deliberately Supabase-only for authentication, database, roles, and content persistence. Firebase is not used.

## Key Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/en` |
| `/en`, `/ja`, `/ar` | Multilingual front page |
| `/player/preview` | WebAR player preview |
| `/en/admin/login` | Admin login |
| `/en/admin` | Protected admin CMS |
| `/en/admin/cms-preview` | Visual CMS live-preview review surface |
| `/api/health` | Health endpoint |

## Production Setup

Apply `supabase/migrations/202605300002_admin_cms_live_preview.sql`, configure the environment variables from `.env.production.example`, create an approved `admin_profiles` record for the admin user, and deploy to Vercel or a self-hosted Next.js runtime.
