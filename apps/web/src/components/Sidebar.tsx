"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Dashboard", admin: false },
  { href: "/coa", label: "Chart of Accounts", admin: false },
  { href: "/admin", label: "Clients", admin: true },
  { href: "/admin/users", label: "Users", admin: true },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="h-screen w-64 bg-[var(--surface-container-low)] flex flex-col py-8 px-4">
      <div className="mb-8 pl-2 text-2xl font-bold tracking-tight text-[var(--primary)]">Accounting</div>
      <nav className="flex flex-col gap-2">
        {navLinks.filter(l => l.admin === isAdmin).map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-[var(--spacing-3)] px-4 py-2 rounded-lg font-medium transition-colors",
                active
                  ? "bg-[var(--surface-container-high)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--on_surface_variant)] hover:bg-[var(--surface-container-high)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
