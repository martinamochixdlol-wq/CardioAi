import { Heart, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onResetChat: () => void;
}

export default function Header({ onResetChat }: HeaderProps) {
  return (
    <header
      id="main-header"
      className="bg-white border-b border-slate-200 sticky top-0 z-30"
    >
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
            <Heart className="w-4 h-4 fill-white/20" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              CardioBot
            </h1>
            <p className="text-[11px] text-slate-500">
              Asistente de Cardiología
            </p>
          </div>
        </div>

        <button
          type="button"
          id="reset-chat-btn"
          onClick={onResetChat}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Limpiar chat"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpiar chat</span>
        </button>
      </div>
    </header>
  );
}
