# Claude Code Standards — Next.js Project

## File Size & Function Rules

- **Every file must be under 200 lines.** If a file approaches 200 lines, refactor immediately by extracting components, hooks, or utilities.
- **Every function must be under 30 lines.** If a function exceeds 30 lines, break it into smaller named functions with clear responsibilities.
- **Every component must do one thing.** If you're describing a component with "and" (e.g., "it fetches data AND renders a table AND handles pagination"), split it up.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & layouts
│   ├── (auth)/             # Route groups for auth pages
│   ├── (dashboard)/        # Route groups for dashboard
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   ├── ui/                 # Primitives: Button, Input, Badge, Card, Modal
│   ├── forms/              # Form-specific: LoginForm, SearchBar, FilterPanel
│   ├── layout/             # Structural: Header, Sidebar, Footer, PageShell
│   ├── data-display/       # Tables, Lists, Charts, StatCards
│   └── feedback/           # Toast, Spinner, ErrorBoundary, EmptyState
├── hooks/                  # Custom React hooks
├── lib/                    # Non-React utilities, API clients, constants
│   ├── api/                # API route handlers and fetch wrappers
│   ├── utils/              # Pure helper functions
│   └── constants/          # App-wide constants and config
├── types/                  # Shared TypeScript types and interfaces
└── styles/                 # Global styles only (component styles use Tailwind)
```

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase, prefix `use` | `useDebounce.ts` |
| Utilities | camelCase | `formatCurrency.ts` |
| Types | PascalCase | `UserProfile.ts` |
| Constants | UPPER_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Route files | lowercase (Next.js convention) | `page.tsx`, `layout.tsx` |

---

## Component Standards

### Prefer Small, Composable Components

```tsx
// ❌ BAD — monolithic component doing everything
export function UserDashboard() {
  // 150+ lines of fetching, state, rendering tables, charts, filters...
}

// ✅ GOOD — composed from focused pieces
export function UserDashboard() {
  return (
    <PageShell title="Dashboard">
      <DashboardFilters />
      <StatsRow />
      <RecentActivityTable />
    </PageShell>
  );
}
```

### Component File Template

Every component file should follow this structure:

```tsx
// src/components/data-display/StatsCard.tsx

import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "flat";
}

export function StatsCard({ label, value, icon, trend }: StatsCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {trend && <TrendIndicator trend={trend} />}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: "up" | "down" | "flat" }) {
  const styles = {
    up: "text-green-600",
    down: "text-red-600",
    flat: "text-gray-500",
  };
  const labels = { up: "↑ Up", down: "↓ Down", flat: "→ Flat" };

  return <span className={`text-xs ${styles[trend]}`}>{labels[trend]}</span>;
}
```

### Rules

1. **Named exports only** — no `export default`. This keeps imports explicit and grep-friendly.
2. **Props interface in the same file** — colocate the interface directly above the component.
3. **No inline business logic** — extract to hooks or utility functions.
4. **Private sub-components are fine** — small helpers like `TrendIndicator` above can live in the same file as long as the file stays under 200 lines. Extract to their own file when reused elsewhere.

---

## Server vs Client Components

```tsx
// Default: Server Components (no directive needed)
// src/app/(dashboard)/page.tsx
import { getStats } from "@/lib/api/stats";
import { StatsRow } from "@/components/data-display/StatsRow";

export default async function DashboardPage() {
  const stats = await getStats();
  return <StatsRow stats={stats} />;
}

// Client Components: only when you need interactivity
// src/components/forms/SearchBar.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState("");
  // ...
}
```

### When to use `"use client"`

- The component uses `useState`, `useEffect`, `useRef`, or any React hook.
- The component uses browser APIs (`window`, `document`, `localStorage`).
- The component handles user events (`onClick`, `onChange`, `onSubmit`).

**Push `"use client"` as far down the tree as possible.** Keep pages and layouts as server components. Only leaf interactive components should be client components.

---

## Custom Hooks

Extract all stateful logic and side effects into custom hooks.

```tsx
// src/hooks/useDebounce.ts
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

```tsx
// src/hooks/usePagination.ts
import { useState, useMemo } from "react";

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
}

export function usePagination({
  totalItems,
  pageSize = 10,
  initialPage = 1,
}: UsePaginationOptions) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.ceil(totalItems / pageSize),
    [totalItems, pageSize]
  );

  const offset = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    offset,
    pageSize,
    goToPage: setCurrentPage,
    nextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
  };
}
```

### Hook Rules

- One hook per file.
- Hook files should be under 80 lines. If longer, the hook is doing too much.
- Hooks must be pure logic — no JSX.
- Name describes the capability: `useDebounce`, `usePagination`, `useFormValidation`.

---

## Utility Functions

```tsx
// src/lib/utils/format.ts

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string, style: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    dateStyle: style === "long" ? "long" : "medium",
  });
}

export function truncate(str: string, maxLen: number = 100): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen).trimEnd()}…`;
}
```

### Utility Rules

- Every function must be a **pure function** — no side effects, no external state.
- Group related utilities in one file (`format.ts`, `validation.ts`, `url.ts`).
- Each utility file under 100 lines. Split when it grows.
- Every exported function gets a JSDoc one-liner if the name isn't fully self-explanatory.

---

## API Layer

```tsx
// src/lib/api/client.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(`${BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
```

```tsx
// src/lib/api/users.ts
import { apiFetch } from "./client";
import type { User, CreateUserInput } from "@/types/user";

export function getUsers(params?: { page?: string; limit?: string }) {
  return apiFetch<User[]>("/api/users", { params });
}

export function getUserById(id: string) {
  return apiFetch<User>(`/api/users/${id}`);
}

export function createUser(input: CreateUserInput) {
  return apiFetch<User>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

### API Rules

- One shared `apiFetch` wrapper — all requests go through it.
- Domain-specific API files: `users.ts`, `projects.ts`, `billing.ts`.
- Return typed promises. Never return `any`.
- Server Actions go in `actions.ts` files colocated with the route or in `lib/actions/`.

---

## TypeScript Standards

```tsx
// src/types/user.ts

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type UserRole = "admin" | "member" | "viewer";

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
}

// Use Pick/Omit to derive types rather than redefining
export type UserSummary = Pick<User, "id" | "name" | "role">;
export type UpdateUserInput = Partial<Omit<CreateUserInput, "email">>;
```

### TypeScript Rules

- **No `any`.** Use `unknown` and narrow with type guards when the type is truly uncertain.
- **No type assertions (`as`)** unless interfacing with untyped third-party code, and add a comment explaining why.
- Prefer `interface` for object shapes, `type` for unions and computed types.
- Shared types go in `src/types/`. Component-specific prop types stay in the component file.

---

## Error Handling

```tsx
// src/components/feedback/ErrorBoundary.tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-lg font-medium">Something went wrong</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded bg-primary px-4 py-2 text-white"
      >
        Reload page
      </button>
    </div>
  );
}
```

### Error Handling Rules

- Wrap page-level content in `<ErrorBoundary>`.
- API calls always use try/catch. Never let promises go unhandled.
- Use Next.js `error.tsx` files for route-level error handling.
- User-facing errors get friendly messages. Log the full error server-side.

---

## Code Reuse Checklist

Before writing any new code, check:

1. **Does a UI primitive exist?** Check `src/components/ui/` first.
2. **Does a hook exist?** Check `src/hooks/` for existing stateful logic.
3. **Does a utility exist?** Check `src/lib/utils/` for formatters, validators, helpers.
4. **Does an API function exist?** Check `src/lib/api/` before writing new fetch calls.
5. **Can an existing component be extended with props** rather than creating a new one?

If something is used in **2+ places**, it must be extracted into a shared location.

---

## Refactoring Triggers

Refactor immediately when any of these occur:

| Signal | Action |
|---|---|
| File exceeds 200 lines | Split into smaller files |
| Function exceeds 30 lines | Extract sub-functions |
| Component has 3+ `useState` calls | Extract a custom hook |
| Same code in 2+ files | Extract to shared utility/component |
| Component receives 8+ props | Group related props into an object or split the component |
| Deeply nested JSX (4+ levels) | Extract child components |
| File has mixed concerns (UI + logic + data fetching) | Separate into component + hook + API |

---

## Import Order

Keep imports sorted in this order, separated by blank lines:

```tsx
// 1. React / Next.js
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 2. Third-party libraries
import { clsx } from "clsx";

// 3. Internal absolute imports — hooks, lib, types
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/utils/format";
import type { User } from "@/types/user";

// 4. Relative imports — sibling components
import { StatsCard } from "./StatsCard";
```

---

## Commit & PR Discipline

- Each commit should be a single logical change.
- If a refactor touches 5+ files, it gets its own commit separate from feature work.
- No file in a PR should exceed 200 lines. If it does, refactor before merging.
