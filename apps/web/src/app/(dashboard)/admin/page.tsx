"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

import { Card } from "@/components/ui/card";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    organizationSlug: "",
    displayName: "",
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => api.admin.listClients(),
  });

  const createMutation = useMutation({
    mutationFn: api.admin.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setShowForm(false);
      setFormData({ organizationSlug: "", displayName: "" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.admin.updateClient(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
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
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "Add Client"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization Slug
                </label>
                <input
                  type="text"
                  required
                  pattern="[a-z0-9_]+"
                  value={formData.organizationSlug}
                  onChange={(e) =>
                    setFormData({ ...formData, organizationSlug: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="acme_corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Acme Corporation"
                />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Client"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Schema
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
              {clients?.data.map((client: any) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {client.displayName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.organizationSlug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.schemaName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        client.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {client.isActive ? "Active" : "Disabled"}
                    </span>
                    {client.isProvisioned && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Provisioned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: client.id,
                          isActive: !client.isActive,
                        })
                      }
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {client.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
