import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Eye } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  photoNokUrl?: string;
  photoOkUrl?: string;
  title: string;
  nokDate?: string;
  okDate?: string;
  className?: string;
  actionTitle?: string;
}

export const FiveSNokOkComparison: React.FC<Props> = ({
  photoNokUrl,
  photoOkUrl,
  title,
  nokDate,
  okDate,
  className,
  actionTitle
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const hasBoth = Boolean(photoNokUrl && photoOkUrl);

  return (
    <div className={clsx("bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs", className)}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <h4 className="font-semibold text-gray-900 text-sm truncate">{title}</h4>
          {actionTitle && (
            <p className="text-xs text-blue-600 font-medium truncate mt-0.5">
              Acción: {actionTitle}
            </p>
          )}
        </div>

        {hasBoth && (
          <div className="flex bg-gray-200 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('side-by-side')}
              className={clsx(
                "px-2.5 py-1 rounded-md transition-all",
                viewMode === 'side-by-side' ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Lado a lado
            </button>
            <button
              type="button"
              onClick={() => setViewMode('slider')}
              className={clsx(
                "px-2.5 py-1 rounded-md transition-all",
                viewMode === 'slider' ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Deslizador
            </button>
          </div>
        )}
      </div>

      {viewMode === 'slider' && hasBoth ? (
        <div className="relative h-64 sm:h-80 select-none overflow-hidden bg-gray-950 group">
          {/* OK Image (Background) */}
          <img
            src={photoOkUrl}
            alt="Estado OK"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 bg-emerald-600/90 text-white text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-xs">
            <CheckCircle2 size={13} /> ESTADO OK
          </div>

          {/* NOK Image (Clipped Foreground) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={photoNokUrl}
              alt="Estado NOK"
              className="absolute inset-0 w-full h-full object-cover max-w-none"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div className="absolute top-3 left-3 bg-rose-600/90 text-white text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-xs">
              <XCircle size={13} /> ANTES (NOK)
            </div>
          </div>

          {/* Slider bar & handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize flex items-center justify-center"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-white shadow-md border-2 border-blue-600 flex items-center justify-center text-blue-600 font-bold text-xs -translate-x-1/2">
              ↔
            </div>
          </div>

          {/* Range input overlay */}
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {/* NOK Section */}
          <div className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  <XCircle size={13} /> ANTES / NOK
                </span>
                {nokDate && <span className="text-[11px] text-gray-400">{nokDate}</span>}
              </div>

              {photoNokUrl ? (
                <div className="relative group/nok rounded-xl overflow-hidden bg-gray-100 aspect-4/3 cursor-pointer" onClick={() => setZoomUrl(photoNokUrl)}>
                  <img
                    src={photoNokUrl}
                    alt="Estado inicial NOK"
                    className="w-full h-full object-cover group-hover/nok:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/nok:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                    <Eye size={16} /> Ver ampliada
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-4/3 flex flex-col items-center justify-center text-gray-400 text-xs p-4 text-center bg-gray-50/50">
                  <XCircle size={24} className="text-gray-300 mb-1" />
                  Sin evidencia fotográfica NOK
                </div>
              )}
            </div>
          </div>

          {/* OK Section */}
          <div className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 size={13} /> DESPUÉS / OK
                </span>
                {okDate && <span className="text-[11px] text-gray-400">{okDate}</span>}
              </div>

              {photoOkUrl ? (
                <div className="relative group/ok rounded-xl overflow-hidden bg-gray-100 aspect-4/3 cursor-pointer" onClick={() => setZoomUrl(photoOkUrl)}>
                  <img
                    src={photoOkUrl}
                    alt="Estado final OK"
                    className="w-full h-full object-cover group-hover/ok:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/ok:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                    <Eye size={16} /> Ver ampliada
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-4/3 flex flex-col items-center justify-center text-gray-400 text-xs p-4 text-center bg-gray-50/50">
                  <CheckCircle2 size={24} className="text-gray-300 mb-1" />
                  Pendiente de evidencia OK (resolución)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal image zoom */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img src={zoomUrl} alt="Evidencia ampliada" className="rounded-2xl max-h-[85vh] object-contain shadow-2xl" />
            <button
              onClick={() => setZoomUrl(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
