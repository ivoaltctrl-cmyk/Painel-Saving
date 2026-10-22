import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  Table2, 
  Code2, 
  RefreshCw,
  Upload
} from 'lucide-react';

export type DashboardTab = 'resumo' | 'evolucao' | 'corridas' | 'api';

interface HeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onUploadCsv: () => void;
  onSyncApi: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onUploadCsv,
  onSyncApi,
  isSyncing,
  lastSyncTime,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              MS
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                MobilitySaving
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline whitespace-nowrap">
                Uber Central vs Táxi Avulso
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links - Compact, Single-line, No scrollbar */}
          <nav className="flex items-center gap-1.5 py-1">
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
            <button
              onClick={onSyncApi}
              disabled={isSyncing}
              title={`Última sincronização: ${lastSyncTime}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Atualizando...' : 'Recarregar'}</span>
            </button>

            <button
              onClick={onUploadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
              title="Carregar nova exportação de planilha .CSV"
            >
              <Upload className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden sm:inline">Upload CSV</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
