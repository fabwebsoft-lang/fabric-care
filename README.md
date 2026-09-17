# Fabric Care — Professional Laundry Operations Web Application

Fabric Care is a high-performance, mobile-responsive laundry and dry-cleaning shop management web application built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, and **TanStack React Query**.

---

## 📁 Project Architecture

```
fabric-care/
├── public/                     # Static assets (favicons, brand graphics)
│   └── fabric-care-logo.png
├── src/                        # Core application source code
│   ├── assets/                 # App assets & media
│   ├── components/             # UI views & feature components
│   │   ├── ui/                 # Reusable Radix UI design system primitives
│   │   ├── ActiveProcessView.tsx # Kanban workflow stage progression board
│   │   ├── BillsView.tsx       # Searchable orders directory, filters & receipts
│   │   ├── BottomNav.tsx       # Responsive mobile navigation bar
│   │   ├── CustomersView.tsx   # Customer directory, clothes codes & history
│   │   ├── DashboardLayout.tsx # Application layout shell
│   │   ├── DashboardView.tsx   # Operational metrics & overview graphs
│   │   ├── ErrorBoundary.tsx   # React runtime error boundary
│   │   ├── ExpensesView.tsx    # Operational expense tracking & category analytics
│   │   ├── NewBillModal.tsx    # Interactive bill creator & cloth tag generator
│   │   ├── RolesAndAccessView.tsx # Role simulator & 4-digit PIN setup
│   │   ├── SettingsView.tsx    # Shop profile, device manager & backup triggers
│   │   └── StatementsView.tsx  # Financial performance analytics & CSV exporter
│   ├── contexts/               # React Context Providers
│   │   ├── AccessControlContext.tsx # Dynamic role-based permissions
│   │   └── ThemeContext.tsx    # Theme & appearance management
│   ├── hooks/                  # Custom React hooks (useAuth, useMobile, etc.)
│   ├── lib/                    # State engine & helper utilities
│   │   ├── trpc.tsx            # Reactive in-browser state engine & LocalStorage store
│   │   └── utils.ts            # Classnames helper (cn)
│   ├── pages/                  # Top-level route pages
│   │   ├── Home.tsx            # Main operations dashboard container
│   │   └── NotFound.tsx        # 404 error page
│   ├── types/                  # Centralized TypeScript domain interfaces
│   │   └── index.ts            # Order, Customer, Expense, Shop, Worker models
│   ├── App.tsx                 # Root application routing & provider tree
│   ├── const.ts                # Application constants & helpers
│   ├── index.css               # Design system tokens, styling & scrollbars
│   └── main.tsx                # Application mounting entrypoint
├── index.html                  # HTML5 entrypoint
├── package.json                # Project dependencies & scripts
├── tsconfig.json               # TypeScript path alias configuration (@/* -> ./src/*)
├── vite.config.ts              # Vite bundler configuration & chunk splitting
├── vercel.json                 # Vercel SPA deployment configuration
└── README.md                   # Project documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Local Development Server
```bash
pnpm dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Production Build
```bash
pnpm build
```

---

## ⚡ Deployment on Vercel
1. Push this repository to GitHub / GitLab.
2. Import project at **[vercel.com/new](https://vercel.com/new)**.
3. Select the **Vite** preset (settings in `vercel.json` are auto-configured).
4. Click **Deploy** — builds and goes live in ~5 seconds.
