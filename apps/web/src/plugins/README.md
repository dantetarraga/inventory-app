# plugins/

Adapters around third-party libraries. **Only these files import the library**; the rest of the
app imports the adapter. To replace a library, rewrite the adapter keeping its public API.

| Plugin              | Wraps                                                | Use                                                     |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `toast.plugin.tsx`  | `sonner`                                             | `toast.success()`, `toast.error()`, `<ToastViewport />` |
| `date.plugin.ts`    | `DateAdapter` from `@stockpro/shared` (→ `date-fns`) | `dates.dateTime()`, `dates.month()`, `dates.today()`    |
| `storage.plugin.ts` | `localStorage`                                       | `storage.get()`, `storage.set()` — preferences only     |

The date library is wrapped in `packages/shared/src/dates.ts` because the API uses it too.
ESLint (`no-restricted-imports`) blocks importing `sonner` or `date-fns` outside these adapters.
