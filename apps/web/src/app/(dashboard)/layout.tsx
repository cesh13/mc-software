"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Ensure clientSlug is in localStorage when session loads
  useEffect(() => {
    if (session?.user?.metadata) {
      let userMeta: { role?: string; clientSlug?: string } | undefined;
      
      if (typeof session.user.metadata === "string") {
        try {
          userMeta = JSON.parse(session.user.metadata);
        } catch {
          userMeta = undefined;
        }
      } else {
        userMeta = session.user.metadata as { role?: string; clientSlug?: string } | undefined;
      }
      
      if (userMeta?.clientSlug) {
        localStorage.setItem("clientSlug", userMeta.clientSlug);
      }
    }
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (isPending) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Parse metadata if it's a string
  let userMeta: { role?: string; clientSlug?: string } | undefined;
  
  if (typeof session?.user?.metadata === "string") {
    try {
      userMeta = JSON.parse(session.user.metadata);
    } catch {
      userMeta = undefined;
    }
  } else {
    userMeta = session?.user?.metadata as { role?: string; clientSlug?: string } | undefined;
  }
  
  const isAdmin = userMeta?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-gray-900">Accounting</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {!isAdmin && (
                  <>
                    <Link
                      href="/"
                      className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/coa"
                      className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Chart of Accounts
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <>
                    <Link
                      href="/admin"
                      className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Clients
                    </Link>
                    <Link
                      href="/admin/users"
                      className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Users
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">
                {session?.user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
