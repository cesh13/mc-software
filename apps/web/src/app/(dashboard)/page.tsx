"use client";

import { useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session } = useSession();
  
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

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Accounting Platform
        </h1>
        <p className="text-gray-600">
          {userMeta?.role === "admin"
            ? "You are logged in as an administrator."
            : `You are logged in to client: ${userMeta?.clientSlug || "Unknown"}`}
        </p>
      </div>
    </div>
  );
}
