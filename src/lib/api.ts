const API_BASE = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("portal_token", token);
    } else {
      localStorage.removeItem("portal_token");
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("portal_token");
    }
    return this.token;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: "PUT", body });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (contentType.includes("text/html") || text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new ApiError("Server backend belum berjalan.", 502);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("Response server tidak valid.", response.status);
    }

    if (!response.ok) {
      throw new ApiError(data.error || "Terjadi kesalahan", response.status);
    }

    return data as T;
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{
      token: string;
      user: { id: number; name: string; username: string; role: string; avatar: string; bio: string };
    }>("/api/auth/login", { method: "POST", body: { username, password } });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser() {
    return this.request<{
      id: number; name: string; username: string; role: string; avatar: string; bio: string;
      nip: string; nisn: string; class_name: string; created_at: string;
    }>("/api/auth/me");
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  }

  async updateProfile(data: { name?: string; username?: string }) {
    return this.request("/api/auth/me", { method: "PUT", body: data });
  }

  async hasAdmin() {
    return this.request<{ hasAdmin: boolean }>("/api/auth/has-admin");
  }

  async bootstrapAdmin(name: string, username: string, password: string) {
    return this.request("/api/auth/bootstrap-admin", {
      method: "POST",
      body: { name, username, password },
    });
  }

  logout() {
    this.setToken(null);
  }

  // Articles
  async listArticles(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{
      articles: any[];
      total: number;
      page: number;
      pages: number;
    }>(`/api/articles?${query}`);
  }

  async getArticle(slug: string) {
    return this.request<any>(`/api/articles/${slug}`);
  }

  async createArticle(data: any) {
    return this.request("/api/articles", { method: "POST", body: data });
  }

  async updateArticle(id: number, data: any) {
    return this.request(`/api/articles/${id}`, { method: "PUT", body: data });
  }

  async deleteArticle(id: number) {
    return this.request(`/api/articles/${id}`, { method: "DELETE" });
  }

  async listAdminArticles(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ articles: any[]; total: number; page: number; pages: number }>(`/api/admin/articles?${query}`);
  }

  // Categories
  async listCategories() {
    return this.request<any[]>("/api/categories");
  }

  async createCategory(data: any) {
    return this.request("/api/categories", { method: "POST", body: data });
  }

  async updateCategory(id: number, data: any) {
    return this.request(`/api/categories/${id}`, { method: "PUT", body: data });
  }

  async deleteCategory(id: number) {
    return this.request(`/api/categories/${id}`, { method: "DELETE" });
  }

  // Comments
  async addComment(articleId: number, content: string) {
    return this.request(`/api/articles/${articleId}/comments`, { method: "POST", body: { content } });
  }

  async listAdminComments(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request<any[]>(`/api/admin/comments${query}`);
  }

  async updateCommentStatus(id: number, status: string) {
    return this.request(`/api/comments/${id}/status`, { method: "PUT", body: { status } });
  }

  async deleteComment(id: number) {
    return this.request(`/api/comments/${id}`, { method: "DELETE" });
  }

  // Announcements
  async listAnnouncements() {
    return this.request<any[]>("/api/announcements");
  }

  async listAdminAnnouncements() {
    return this.request<any[]>("/api/admin/announcements");
  }

  async createAnnouncement(data: any) {
    return this.request("/api/announcements", { method: "POST", body: data });
  }

  async updateAnnouncement(id: number, data: any) {
    return this.request(`/api/announcements/${id}`, { method: "PUT", body: data });
  }

  async deleteAnnouncement(id: number) {
    return this.request(`/api/announcements/${id}`, { method: "DELETE" });
  }

  // Tags
  async listTags() {
    return this.request<any[]>("/api/tags");
  }

  // Sliders
  async listSliders() {
    return this.request<any[]>("/api/sliders");
  }

  // Users
  async listUsers() {
    return this.request<any[]>("/api/users");
  }

  async createUser(data: any) {
    return this.request("/api/users", { method: "POST", body: data });
  }

  async updateUser(id: number, data: any) {
    return this.request(`/api/users/${id}`, { method: "PUT", body: data });
  }

  async deleteUser(id: number) {
    return this.request(`/api/users/${id}`, { method: "DELETE" });
  }

  // Stats
  async getAdminStats() {
    return this.request<any>("/api/admin/stats");
  }

  async getTeacherStats() {
    return this.request<any>("/api/teacher/stats");
  }

  async getStudentStats() {
    return this.request<any>("/api/student/stats");
  }

  // Activity logs
  async getAdminLogs() {
    return this.request<any[]>("/api/admin/logs");
  }
}

export const api = new ApiClient();
