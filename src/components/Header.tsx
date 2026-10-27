import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  Table2, 
  Code2, 
  RefreshCw
} from 'lucide-react';

export type DashboardTab = 'resumo' | 'evolucao' | 'corridas' | 'api';

interface HeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
  dataSourceInfo?: {
    source: 'google_sheets_live' | 'local_cache';
    isLive: boolean;
    lastSyncedAt: string;
    totalTrips: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onSync,
  isSyncing,
  lastSyncTime,
  dataSourceInfo,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 h-16 sm:h-18">
          {/* Zone 1: WFS Brand & Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/assets/aistudio/wfs-logo.svg_fbe187c8.png"
              alt="WFS - A SATS Company"
              className="h-10 sm:h-11 w-auto object-contain transition-all drop-shadow-xs"
            />
            <div className="h-8 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                  MobilitySaving
                </span>
                <span className="text-slate-300 font-normal hidden md:inline">·</span>
                <span className="text-xs font-semibold text-slate-700 hidden md:inline">
                  Operação GRU
                </span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline whitespace-nowrap">
                Uber Central vs Táxi Avulso
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links - Compact, Single-line, No scrollbar */}
          <nav className="flex items-center gap-1 py-1">
            <button
              onClick={() => onTabChange('resumo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'resumo'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Resumo</span>
            </button>

            <button
              onClick={() => onTabChange('evolucao')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'evolucao'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Evolução Diária</span>
            </button>

            <button
              onClick={() => onTabChange('corridas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'corridas'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Base de Corridas</span>
            </button>

            <button
              onClick={() => onTabChange('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'api'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>API REST</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Sheets vs Cached Status Indicator */}
            {dataSourceInfo && (
              dataSourceInfo.isLive ? (
                <div 
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                  title="Base oficial Google Sheets sincronizada em tempo real"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">Planilha Oficial</span>
                  <span className="text-emerald-400">·</span>
                  <span className="text-emerald-700 font-mono text-[10px]">{dataSourceInfo.lastSyncedAt || lastSyncTime}</span>
                </div>
              ) : (
                <div 
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-300"
                  title="Exibindo cópia local em cache. Clique em Recarregar para buscar da planilha oficial"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-bold">⚠️ Cópia Local Desatualizada</span>
                  <span className="text-amber-400">·</span>
                  <span className="text-amber-700 font-mono text-[10px]">{dataSourceInfo.lastSyncedAt || lastSyncTime}</span>
                </div>
              )
            )}

            <button
              onClick={onSync}
              disabled={isSyncing}
              title={`Atualizar dados diretamente da planilha oficial (última sincronização: ${lastSyncTime})`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Atualizando...' : 'Atualizar Dados'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
