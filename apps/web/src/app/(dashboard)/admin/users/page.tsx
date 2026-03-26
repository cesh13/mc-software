"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

import { Card } from "@/components/ui/card";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    clientSlug: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.admin.listClients(),
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.admin.listUsers(),
  });

  const createMutation = useMutation({
    mutationFn: api.admin.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowForm(false);
      setFormData({ email: "", password: "", name: "", clientSlug: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.admin.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: api.admin.disableUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: api.admin.enableUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="px-4 py-6 sm:px-0">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "Add User"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client
                </label>
                <select
                  required
                  value={formData.clientSlug}
                  onChange={(e) =>
                    setFormData({ ...formData, clientSlug: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a client</option>
                  {clients?.data
                    .filter((c: any) => c.isProvisioned && c.isActive)
                    .map((client: any) => (
                      <option key={client.id} value={client.organizationSlug}>
                        {client.displayName}
                      </option>
                    ))}
                </select>
              </div>
              {createMutation.isError && (
                <div className="text-red-600 text-sm">
                  {(createMutation.error as any)?.message || "Failed to create user"}
                </div>
              )}
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.data.map((user: any) => {
                let metadata;
                try {
                  metadata = typeof user.metadata === "string" 
                    ? JSON.parse(user.metadata) 
                    : user.metadata;
                } catch {
                  metadata = {};
                }

                return (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metadata?.clientSlug || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          metadata?.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {metadata?.role === "admin" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.banned
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {user.banned ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {metadata?.role !== "admin" && (
                        <>
                          {user.banned ? (
                            <button
                              onClick={() => {
                                if (confirm(`Enable user ${user.email}?`)) {
                                  enableMutation.mutate(user.id);
                                }
                              }}
                              disabled={enableMutation.isPending}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (confirm(`Disable user ${user.email}? They will be logged out and unable to log in.`)) {
                                  disableMutation.mutate(user.id);
                                }
                              }}
                              disabled={disableMutation.isPending}
                              className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                            >
                              Disable
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Permanently delete user ${user.email}? This cannot be undone.`)) {
                                deleteMutation.mutate(user.email);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
