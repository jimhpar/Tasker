import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, FileText, Film } from 'lucide-react';

export default function MediaViewerModal({ isOpen, onClose, file }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, file]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const fileName = file.name || 'attachment';
  const fileUrl = file.dataUrl || file.url || '';
  const fileType = file.type || '';

  const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  const isVideo = fileType.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(fileName);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.3, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.3, 0.5));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fadeIn p-2 sm:p-4 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 z-20">
          <div className="flex items-center gap-2 truncate pr-2">
            {isImage ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            ) : isVideo ? (
              <Film className="w-4 h-4 text-purple-400" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400" />
            )}
            <span className="text-sm font-semibold text-slate-200 truncate">{fileName}</span>
            {file.size && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isImage && (
              <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-700/50">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition text-xs flex items-center gap-1"
                  title="Reset Zoom"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">{Math.round(scale * 100)}%</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shadow-sm active:scale-95"
              title="Download File"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Media Content Area */}
        <div
          className="relative flex-1 min-h-[300px] max-h-[78vh] flex items-center justify-center p-4 bg-slate-950/60 overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {isImage ? (
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75 cursor-grab active:cursor-grabbing"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-[72vh] object-contain rounded select-none pointer-events-none shadow-lg"
                draggable={false}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full max-w-2xl max-h-[72vh] flex items-center justify-center">
              <video
                src={fileUrl}
                controls
                autoPlay
                className="w-full max-h-[70vh] rounded-lg shadow-xl bg-black"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-900/60 border border-slate-800 rounded-2xl max-w-md w-full">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                <FileText size={32} />
              </div>
              <h4 className="text-base font-semibold text-slate-200 mb-1 break-all">{fileName}</h4>
              <p className="text-xs text-slate-400 mb-6">
                {fileType || 'Generic Document'} {file.size ? `• ${(file.size / 1024).toFixed(1)} KB` : ''}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition shadow-md active:scale-95"
              >
                <Download size={16} />
                Download Attachment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
