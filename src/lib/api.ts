const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type ErrorBody = {
  code?: string;
  message?: string;
};

type Envelope<T> = {
  success?: boolean;
  data?: T | null;
  error?: ErrorBody | null;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const endpoints = {
  files: "/api/v1/files",
  file: (fileId: string) => `/api/v1/files/${fileId}`,
  preview: (fileId: string) => `/api/v1/files/${fileId}/preview`,
  quality: (fileId: string) => `/api/v1/files/${fileId}/quality`,
  analysis: (fileId: string) => `/api/v1/files/${fileId}/analysis`,
  mappingSuggestion: (fileId: string) => `/api/v1/files/${fileId}/mapping-suggestion`,
  job: (jobId: string) => `/api/v1/jobs/${jobId}`,
  complaints: "/api/v1/complaints",
  categories: "/api/v1/complaints/categories",
  candidates: "/api/v1/complaints/categories/candidates",
  candidateDecision: (candidateId: string) =>
    `/api/v1/complaints/categories/candidates/${candidateId}/decision`,
  reviews: "/api/v1/complaints/reviews",
  review: (reviewId: string) => `/api/v1/complaints/reviews/${reviewId}`,
} as const;

function errorMessage(payload: Envelope<unknown> | null, status: number): string {
  if (payload?.error?.message) return payload.error.message;
  return `요청 실패 (${status})`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다. 백엔드가 8000번에서 떠 있는지 확인하세요.", 0, "NETWORK");
  }

  const text = await response.text();
  let payload: Envelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new ApiError(text || `요청 실패 (${response.status})`, response.status);
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(errorMessage(payload, response.status), response.status, payload?.error?.code ?? "REQUEST_FAILED");
  }

  if (payload && "data" in payload) return payload.data as T;
  return payload as T;
}

export function uploadFile(file: File): Promise<{ fileId: string; status: string; message: string }> {
  const body = new FormData();
  body.append("file", file);
  return apiRequest(endpoints.files, { method: "POST", body });
}
