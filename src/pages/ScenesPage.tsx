// 场景库列表页
// 顶部导航：返回工作台 + 标题"场景库"
// 卡片网格（2列）：缩略图 + 名称 + 更新时间 + 加载/分享/删除

import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  Share2,
  Trash2,
  Folder,
  Play,
  Copy,
  Check,
  X,
  Loader2,
} from "lucide-react";
import * as QRCode from "qrcode";
import type { SceneMeta } from "@shared/types";
import { api } from "@/api/client";
import { useStudioStore } from "@/store/sceneStore";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
          <h3 className="font-display font-bold text-white">分享场景</h3>
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

export function ScenesPage() {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadScenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listScenes();
      setScenes(res.scenes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenes();
  }, []);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const meta = await api.getScene(id);
      useStudioStore.getState().loadSceneState(meta.state, meta.cameraPose);
      useStudioStore.getState().setLoadedSceneId(meta.id);
      navigate("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleShare = (meta: SceneMeta) => {
    if (!meta.shareToken) return;
    setShareUrl(`${window.location.origin}/share/scene/${meta.shareToken}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteScene(id);
      setScenes((prev) => prev.filter((s) => s.id !== id));
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
            <Folder className="w-5 h-5 text-accent-film" />
            场景库
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
        {!loading && scenes.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-studio-muted">
            <Folder className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">还没有保存的场景</p>
            <Link
              to="/studio"
              className="mt-4 px-4 py-2 rounded-lg bg-accent-film text-studio-black font-semibold"
            >
              前往工作台
            </Link>
          </div>
        )}

        {/* 场景卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="glass-panel rounded-xl overflow-hidden hover:shadow-glass transition group"
            >
              {/* 缩略图 */}
              <div className="aspect-video bg-studio-dark relative overflow-hidden">
                <img
                  src={api.sceneThumbnailURL(scene.id)}
                  alt={scene.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs font-mono text-white">
                  {scene.state.humans.length} 人形 · {scene.state.focalLength}mm
                </div>
              </div>
              {/* 信息 + 操作 */}
              <div className="p-3">
                <div className="font-semibold text-white truncate">
                  {scene.name}
                </div>
                <div className="text-xs text-studio-light mt-0.5">
                  {formatDate(scene.updatedAt)}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleLoad(scene.id)}
                    disabled={loadingId === scene.id}
                    className="flex-1 py-1.5 rounded-lg bg-accent-film text-studio-black text-sm font-semibold flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                  >
                    {loadingId === scene.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        加载
                      </>
                    )}
                  </button>
                  {scene.shareToken && (
                    <button
                      onClick={() => handleShare(scene)}
                      className="px-3 py-1.5 rounded-lg glass-button text-white text-sm flex items-center gap-1 hover:brightness-110 active:scale-95 transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(scene.id)}
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

      {/* 分享弹窗 */}
      {shareUrl && (
        <ShareDialog url={shareUrl} onClose={() => setShareUrl(null)} />
      )}
    </div>
  );
}
