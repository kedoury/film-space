// 录制结果弹窗
// 录制停止后展示：视频预览、时长、大小
// 三个动作：下载本地 / 上传云端 / 丢弃

import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  Trash2,
  Copy,
  Check,
  Link2,
  Loader2,
  Clock,
  HardDrive,
} from "lucide-react";
import { useStudioStore } from "@/store/sceneStore";
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

export function RecordingResultDialog() {
  const recordingBlob = useStudioStore((s) => s.recordingBlob);
  const recordingMs = useStudioStore((s) => s.recordingMs);
  const setRecordingBlob = useStudioStore((s) => s.setRecordingBlob);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建 / 清理 blob URL
  useEffect(() => {
    if (recordingBlob) {
      const url = URL.createObjectURL(recordingBlob);
      setBlobUrl(url);
      setShareUrl(null);
      setError(null);
      setCopied(false);
      return () => URL.revokeObjectURL(url);
    }
    setBlobUrl(null);
  }, [recordingBlob]);

  if (!recordingBlob || !blobUrl) return null;

  // 从 video metadata 获取宽高
  const getVideoDimensions = (): Promise<{ w: number; h: number }> => {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
      };
      v.onerror = () => resolve({ w: 1280, h: 720 });
      v.src = blobUrl;
    });
  };

  const handleDownload = () => {
    downloadBlob(recordingBlob, `film-space-${Date.now()}.webm`);
  };

  const handleUpload = async () => {
    setUploading(true);
    setError(null);
    try {
      const { w, h } = await getVideoDimensions();
      const result = await api.uploadVideo({
        name: `视频 ${new Date().toLocaleString("zh-CN")}`,
        durationMs: recordingMs,
        width: w,
        height: h,
        file: recordingBlob,
      });
      setShareUrl(`${window.location.origin}/share/video/${result.shareToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // 降级：选中文本
    }
  };

  const handleDiscard = () => {
    setRecordingBlob(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4 shadow-glass">
        {/* 标题 */}
        <h2 className="text-lg font-display font-bold text-white mb-4">
          录制完成
        </h2>

        {/* 视频预览 */}
        <div className="rounded-xl overflow-hidden bg-studio-black mb-4">
          <video
            src={blobUrl}
            controls
            className="w-full max-h-64"
            playsInline
          />
        </div>

        {/* 元信息 */}
        <div className="flex items-center gap-4 mb-4 text-sm text-studio-light">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {formatTime(recordingMs)}
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4" />
            {formatBytes(recordingBlob.size)}
          </span>
        </div>

        {/* 分享链接（上传成功后） */}
        {shareUrl && (
          <div className="mb-4 p-3 rounded-lg bg-studio-panel/80 border border-studio-border">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent-film flex-shrink-0" />
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-sm text-white font-mono outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="px-2 py-1 rounded bg-accent-film/20 text-accent-film hover:bg-accent-film/30 transition flex items-center gap-1 text-xs font-semibold"
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
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-status-rec/20 text-status-rec text-sm">
            上传失败：{error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {!shareUrl && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 py-2.5 rounded-lg bg-accent-film text-studio-black font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  上传云端
                </>
              )}
            </button>
          )}
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-lg glass-button text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition"
          >
            <Download className="w-4 h-4" />
            下载本地
          </button>
          <button
            onClick={handleDiscard}
            className="px-4 py-2.5 rounded-lg glass-button text-status-rec font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition"
          >
            <Trash2 className="w-4 h-4" />
            丢弃
          </button>
        </div>
      </div>
    </div>
  );
}
