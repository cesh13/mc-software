"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-4 pr-4">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 mr-4">{session?.user?.email}</span>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
