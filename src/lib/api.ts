const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Exam {
  _id: string;
  id: string;
  title: string;
  subjectId: string;
  subject_id: string;
  description: string;
  googleFormUrl: string;
  google_form_url: string;
  durationMinutes: number;
  isActive: boolean;
  startsAt?: number;
  endsAt?: number;
  createdBy: string;
  created_by: string;
  createdAt: number;
  created_at: string;
  subjectName: string | null;
  teacherName: string | null;
}

export interface Attempt {
  _id: string;
  id: string;
  examId: string;
  exam_id: string;
  studentId: string;
  student_id: string;
  status: "in_progress" | "completed" | "expired";
  startedAt: number;
  started_at: string;
  endsAt: number;
  ends_at: string;
  completedAt?: number;
  completed_at?: string;
  violationCount: number;
  violation_count: string;
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
      localStorage.setItem("ujiankita_token", token);
    } else {
      localStorage.removeItem("ujiankita_token");
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("ujiankita_token");
    }
    return this.token;
  }

  // Convenience methods for REST calls
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body });
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body });
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

    // Detect HTML response (backend not running → web server returns 404 page)
    if (contentType.includes("text/html") || text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(
        "Server backend belum berjalan. Hubungi admin untuk memastikan server API aktif."
      );
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Response server tidak valid. Silakan coba lagi.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Terjadi kesalahan");
    }

    return data as T;
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{
      token: string;
      user: { id: string; name: string; username: string; role: string };
    }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    this.setToken(data.token);
    return data;
  }

  async bootstrapAdmin(name: string, username: string, password: string) {
    return this.request("/api/auth/bootstrap-admin", {
      method: "POST",
      body: { name, username, password },
    });
  }

  async hasAdmin() {
    return this.request<{ hasAdmin: boolean }>("/api/auth/has-admin");
  }

  async getCurrentUser() {
    return this.request<{
      id: string;
      name: string;
      username: string;
      role: string;
    }>("/api/auth/me");
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  }

  async updateProfile(data: { name?: string; username?: string }) {
    return this.request<{
      message: string;
      token?: string;
    }>("/api/auth/me", { method: "PUT", body: data });
  }

  async resetAdmin(data: { resetToken: string; newUsername?: string; newPassword: string }) {
    return this.request<{ message: string; username: string }>("/api/auth/reset-admin", {
      method: "POST",
      body: data,
    });
  }

  logout() {
    this.setToken(null);
  }

  // Users (admin)
  async listUsers() {
    return this.request<
      { id: string; name: string; username: string; role: string; created_at: string }[]
    >("/api/users");
  }

  async createUser(data: {
    name: string;
    username: string;
    password: string;
    role: "teacher" | "student";
  }) {
    return this.request("/api/users", { method: "POST", body: data });
  }

  async deleteUser(userId: string) {
    return this.request(`/api/users/${userId}`, { method: "DELETE" });
  }

  async importUsers(data: {
    role: "teacher" | "student";
    items: { name: string; username?: string; password?: string }[];
  }) {
    return this.request<
      { name: string; username: string; password: string }[]
    >("/api/users/import", { method: "POST", body: data });
  }

  // Subjects
  async listSubjects() {
    return this.request<
      { id: string; name: string; description: string }[]
    >("/api/subjects");
  }

  async createSubject(data: { name: string; description?: string }) {
    return this.request("/api/subjects", { method: "POST", body: data });
  }

  async deleteSubject(subjectId: string) {
    return this.request(`/api/subjects/${subjectId}`, { method: "DELETE" });
  }

  // Exams
  async listExams() {
    return this.request<Exam[]>("/api/exams");
  }

  async getExam(examId: string) {
    return this.request<Exam>(`/api/exams/${examId}`);
  }

  async createExam(data: {
    title: string;
    subjectId: string;
    description?: string;
    googleFormUrl: string;
    durationMinutes: number;
  }) {
    return this.request("/api/exams", { method: "POST", body: data });
  }

  async setExamSchedule(
    examId: string,
    data: { isActive: boolean; startsAt?: number; endsAt?: number }
  ) {
    return this.request(`/api/exams/${examId}/schedule`, {
      method: "PATCH",
      body: data,
    });
  }

  async attemptsSummary(examId: string) {
    return this.request<{
      started: number;
      inProgress: number;
      completed: number;
      expired: number;
      totalViolations: number;
    }>(`/api/exams/${examId}/summary`);
  }

  async attemptsForExam(examId: string) {
    return this.request<
      {
        id: string;
        exam_id: string;
        student_id: string;
        status: string;
        started_at: string;
        violationCount: number;
        student: { name: string; username: string } | null;
      }[]
    >(`/api/exams/${examId}/attempts`);
  }

  // Attempts
  async myAttempt(examId: string) {
    return this.request<Attempt | null>(`/api/attempts/my/${examId}`);
  }

  async myAttempts() {
    return this.request<Attempt[]>("/api/attempts/my");
  }

  async startAttempt(examId: string) {
    return this.request<{ id: string }>("/api/attempts/start", {
      method: "POST",
      body: { examId },
    });
  }

  async recordViolation(attemptId: string, type: string) {
    return this.request("/api/attempts/violation", {
      method: "POST",
      body: { attemptId, type },
    });
  }

  async completeAttempt(attemptId: string) {
    return this.request("/api/attempts/complete", {
      method: "POST",
      body: { attemptId },
    });
  }

  async expireAttempt(attemptId: string) {
    return this.request("/api/attempts/expire", {
      method: "POST",
      body: { attemptId },
    });
  }
}

export const api = new ApiClient();
