// API 客户端封装

import type { SceneMeta, VideoMeta, SceneState, OrbitCameraPose } from "@shared/types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // 场景
  listScenes: () => request<{ scenes: SceneMeta[] }>("/scenes"),

  getScene: (id: string) => request<SceneMeta>(`/scenes/${id}`),

  uploadScene: async (params: {
    name: string;
    state: SceneState;
    cameraPose: OrbitCameraPose;
    thumbnail: Blob;
  }): Promise<{ id: string; shareToken: string }> => {
    const form = new FormData();
    form.append("name", params.name);
    form.append("json", JSON.stringify({ state: params.state, cameraPose: params.cameraPose }));
    form.append("thumbnail", params.thumbnail, "thumbnail.png");
    return request("/scenes", { method: "POST", body: form });
  },

  deleteScene: (id: string) =>
    request<void>(`/scenes/${id}`, { method: "DELETE" }),

  // 视频
  listVideos: () => request<{ videos: VideoMeta[] }>("/videos"),

  getVideo: (id: string) => request<VideoMeta>(`/videos/${id}`),

  uploadVideo: async (params: {
    name: string;
    durationMs: number;
    width: number;
    height: number;
    file: Blob;
    thumbnail?: Blob;
  }): Promise<{ id: string; fileURL: string; shareToken: string }> => {
    const form = new FormData();
    form.append("name", params.name);
    form.append("durationMs", String(params.durationMs));
    form.append("width", String(params.width));
    form.append("height", String(params.height));
    form.append("video", params.file, "video.webm");
    if (params.thumbnail) {
      form.append("thumbnail", params.thumbnail, "thumbnail.png");
    }
    return request("/videos", { method: "POST", body: form });
  },

  deleteVideo: (id: string) =>
    request<void>(`/videos/${id}`, { method: "DELETE" }),

  videoFileURL: (id: string) => `${BASE}/videos/${id}/file`,
  sceneThumbnailURL: (id: string) => `${BASE}/scenes/${id}/thumbnail`,
  videoThumbnailURL: (id: string) => `${BASE}/videos/${id}/thumbnail`,

  // 分享
  getShareScene: (token: string) =>
    request<SceneMeta>(`/share/scene/${token}`),

  getShareVideo: (token: string) =>
    request<VideoMeta>(`/share/video/${token}`),
};

// 触发本地下载
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
