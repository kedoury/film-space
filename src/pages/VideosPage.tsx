// 视频库列表页
// 顶部导航：返回工作台 + 标题"视频库"
// 卡片网格（2列）：缩略图 + 名称 + 时长 + 大小 + 预览/下载/分享/删除

import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  Film,
  Share2,
  Trash2,
  Play,
  Download,
  Copy,
  Check,
  X,
  Loader2,
  Clock,
  HardDrive,
} from "lucide-react";
import * as QRCode from "qrcode";
import type { VideoMeta } from "@shared/types";
import { api, downloadBlob } from "@/api/client";

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 预览弹窗
function PreviewDialog({
  meta,
  onClose,
}: {
  meta: VideoMeta;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-white">{meta.name}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-studio-light hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <video
          src={api.videoFileURL(meta.id)}
          controls
          autoPlay
          className="w-full rounded-xl bg-black"
          playsInline
        />
      </div>
    </div>
  );
}

// 分享弹窗
function ShareDialog({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, url, {
        width: 180,
        margin: 2,
        color: { dark: "#0E0E10", light: "#FFFFFFFF" },
      }).catch(() => {});
    }
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel rounded-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">分享视频</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-studio-light hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-center mb-4">
          <canvas ref={qrRef} className="rounded-lg" />
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-studio-panel/80 border border-studio-border">
          <input
            readOnly
            value={url}
            className="flex-1 bg-transparent text-sm text-white font-mono outline-none truncate px-2"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded bg-accent-film/20 text-accent-film text-xs font-semibold flex items-center gap-1 hover:bg-accent-film/30"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" /> 已复制
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> 复制
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VideosPage() {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<VideoMeta | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listVideos();
      setVideos(res.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const handleDownload = async (meta: VideoMeta) => {
    setDownloadingId(meta.id);
    try {
      const res = await fetch(api.videoFileURL(meta.id));
      const blob = await res.blob();
      downloadBlob(blob, `${meta.name}.webm`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = (meta: VideoMeta) => {
    if (!meta.shareToken) return;
    setShareUrl(`${window.location.origin}/share/video/${meta.shareToken}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-studio-black overflow-y-auto studio-scroll">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 glass-panel border-b border-studio-border">
        <div className="flex items-center gap-3 px-6 py-4">
          <Link
            to="/studio"
            className="w-9 h-9 rounded-full glass-button flex items-center justify-center text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-accent-film" />
            视频库
          </h1>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent-film animate-spin" />
          </div>
        )}
        {error && (
          <div className="p-4 rounded-lg bg-status-rec/20 text-status-rec text-sm mb-4">
            {error}
          </div>
        )}
        {!loading && videos.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-studio-muted">
            <Film className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">还没有保存的视频</p>
            <Link
              to="/studio"
              className="mt-4 px-4 py-2 rounded-lg bg-accent-film text-studio-black font-semibold"
            >
              前往工作台
            </Link>
          </div>
        )}

        {/* 视频卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="glass-panel rounded-xl overflow-hidden hover:shadow-glass transition group"
            >
              {/* 缩略图 */}
              <div
                className="aspect-video bg-studio-dark relative overflow-hidden cursor-pointer"
                onClick={() => setPreviewMeta(video)}
              >
                <img
                  src={api.videoThumbnailURL(video.id)}
                  alt={video.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-xs font-mono text-white">
                  {formatTime(video.durationMs)}
                </div>
              </div>
              {/* 信息 + 操作 */}
              <div className="p-3">
                <div className="font-semibold text-white truncate">
                  {video.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-studio-light mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(video.durationMs)}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(video.sizeBytes)}
                  </span>
                  <span>{formatDate(video.createdAt)}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setPreviewMeta(video)}
                    className="flex-1 py-1.5 rounded-lg bg-accent-film text-studio-black text-sm font-semibold flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    预览
                  </button>
                  <button
                    onClick={() => handleDownload(video)}
                    disabled={downloadingId === video.id}
                    className="px-3 py-1.5 rounded-lg glass-button text-white text-sm flex items-center gap-1 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                  >
                    {downloadingId === video.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {video.shareToken && (
                    <button
                      onClick={() => handleShare(video)}
                      className="px-3 py-1.5 rounded-lg glass-button text-white text-sm flex items-center gap-1 hover:brightness-110 active:scale-95 transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="px-3 py-1.5 rounded-lg glass-button text-status-rec text-sm flex items-center gap-1 hover:brightness-110 active:scale-95 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewMeta && (
        <PreviewDialog
          meta={previewMeta}
          onClose={() => setPreviewMeta(null)}
        />
      )}
      {/* 分享弹窗 */}
      {shareUrl && (
        <ShareDialog url={shareUrl} onClose={() => setShareUrl(null)} />
      )}
    </div>
  );
}
