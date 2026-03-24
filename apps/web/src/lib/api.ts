const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiClient {
  private getClientSlug(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("clientSlug");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const clientSlug = this.getClientSlug();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (clientSlug) {
      headers["X-Client-Slug"] = clientSlug;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Chart of Accounts
  coa = {
    list: () => this.request<{ data: any[] }>("/api/coa"),
    create: (data: any) => this.request<{ data: any }>("/api/coa", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id: string, data: any) =>
      this.request<{ data: any }>(`/api/coa/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      this.request<{ data: { success: boolean } }>(`/api/coa/${id}`, {
        method: "DELETE",
      }),
  };

  // Admin
  admin = {
    listClients: () => this.request<{ data: any[] }>("/api/admin/clients"),
    createClient: (data: any) =>
      this.request<{ data: any }>("/api/admin/clients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateClient: (id: string, data: any) =>
      this.request<{ data: any }>(`/api/admin/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    getClient: (id: string) =>
      this.request<{ data: any }>(`/api/admin/clients/${id}`),
    listUsers: () => this.request<{ data: any[] }>("/api/admin/users"),
    createUser: (data: any) =>
      this.request<{ data: any }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteUser: (email: string) =>
      this.request<{ data: { success: boolean } }>(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
      }),
    disableUser: (userId: string) =>
      this.request<{ data: any }>(`/api/admin/users/${userId}/disable`, {
        method: "POST",
      }),
    enableUser: (userId: string) =>
      this.request<{ data: any }>(`/api/admin/users/${userId}/enable`, {
        method: "POST",
      }),
  };
}

export const api = new ApiClient();
