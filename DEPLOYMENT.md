# FabricCare - End-to-End Deployment Guide

FabricCare is a mobile-first laundry and dry-cleaning shop operations application built with React 19, TypeScript, Vite, Tailwind CSS v4, Express, tRPC v11, Drizzle ORM, PostgreSQL, and Google OAuth 2.0.

---

## 📦 Ready-to-Deploy Packages Created

1. **`fabric-care-dist.zip` (~324 KB)**
   - Pre-built, minified, code-split production bundle.
   - Ready for instant drag-and-drop deployment on **Netlify Drop**, **Vercel**, **Firebase Hosting**, **Cloudflare Pages**, or static web servers.
   - Zero build step required on the server.

2. **`fabric-care-clean-source.zip` (~273 KB)**
   - Clean source code package with all bloat and `node_modules` removed (down from 138.8 MB).
   - Ready to push to GitHub, GitLab, or upload directly to Vercel/Netlify for automated CI/CD builds.

---

## ⚡ 1. Instant Static Deployment (Fastest)

### Option A: Drag & Drop on Netlify
1. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
2. Drag and drop the extracted `dist` folder or upload `fabric-care-dist.zip`.
3. Your site goes live in seconds with global CDN caching and SSL.

### Option B: Deploy on Vercel
1. Go to **[vercel.com/new](https://vercel.com/new)**.
2. Import your GitHub repository (`fabric-care-clean-source.zip` contents).
3. **Framework Preset**: Vite (`vercel.json` is pre-configured with SPA rewrites).
4. **Environment Variables**: Add your database / OAuth keys:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:password@host:port/database` | PostgreSQL Connection URI |
| `NODE_ENV` | `production` | Production environment |
| `JWT_SECRET` | *(Random 32+ character secret string)* | Session signing key |

5. Click **"Deploy"**.

---

## 🚀 2. Performance Optimizations Applied

- **Code Splitting & Lazy Loading**: All heavy modals and views (`ActiveProcessView`, `BillsView`, `CustomersView`, `StatementsView`, `RolesAndAccessView`, `SettingsView`, `ExpensesView`, `NewBillModal`) load on-demand with smooth React `Suspense` fallbacks.
- **Optimized Asset Sizes**: Large assets compressed with crisp High-DPI fidelity (image payload reduced by ~89%).
- **Vendor Chunk Isolation**: Separation of React runtime, query cache, charts, and UI primitives for maximum browser caching efficiency.

---

## 🛠️ 3. Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start fast Vite dev server
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).
