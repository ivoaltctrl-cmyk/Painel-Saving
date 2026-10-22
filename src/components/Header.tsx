import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  Table2, 
  Calculator, 
  FileSpreadsheet, 
  Code2, 
  RefreshCw,
  Plus
} from 'lucide-react';

export type DashboardTab = 'board' | 'overview' | 'trips' | 'quote' | 'sheets' | 'api';

interface HeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onOpenSyncModal: () => void;
  onSyncApi: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenSyncModal,
  onSyncApi,
  isSyncing,
  lastSyncTime,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
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
                Uber Central vs Táxi Avulso · Gestão SATS
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
            <button
              onClick={() => onTabChange('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'board'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Envio à Diretoria</span>
            </button>

            <button
              onClick={() => onTabChange('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Evolução do Saving</span>
            </button>

            <button
              onClick={() => onTabChange('trips')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'trips'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Base de Corridas</span>
            </button>

            <button
              onClick={() => onTabChange('quote')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'quote'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Cotação em Tempo Real</span>
            </button>

            <button
              onClick={() => onTabChange('sheets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'sheets'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conexão Sheets</span>
            </button>

            <button
              onClick={() => onTabChange('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === 'api'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>

            <button
              onClick={onOpenSyncModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar Planilha</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => onTabChange('board')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'board' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            Diretoria
          </button>
          <button
            onClick={() => onTabChange('overview')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'overview' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            Evolução
          </button>
          <button
            onClick={() => onTabChange('trips')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'trips' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            Base Uber
          </button>
          <button
            onClick={() => onTabChange('quote')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'quote' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            Cotação
          </button>
          <button
            onClick={() => onTabChange('sheets')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'sheets' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            Sheets
          </button>
          <button
            onClick={() => onTabChange('api')}
            className={`px-2.5 py-1 rounded whitespace-nowrap font-medium ${
              activeTab === 'api' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
