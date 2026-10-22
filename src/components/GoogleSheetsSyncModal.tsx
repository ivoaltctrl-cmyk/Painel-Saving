import React, { useState } from 'react';
import { SheetsService } from '../services/sheetsService';
import { 
  FileSpreadsheet, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Table,
  Check
} from 'lucide-react';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted: () => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const currentConfig = SheetsService.getConfig();
  const [sheetUrl, setSheetUrl] = useState(currentConfig.sheetUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSyncUrl = async () => {
    if (!sheetUrl) return;
    setIsSyncing(true);
    setSyncStatus(null);

    const result = await SheetsService.syncFromGoogleSheets(sheetUrl);
    setIsSyncing(false);

    if (result.success) {
      setSyncStatus({
        type: 'success',
        message: `Planilha sincronizada com sucesso! ${result.count} corridas carregadas e calculadas.`,
      });
      onSyncCompleted();
    } else {
      setSyncStatus({
        type: 'error',
        message: result.error || 'Erro ao sincronizar planilha.',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = SheetsService.importFromCsvText(content);
        if (res.success) {
          setSyncStatus({
            type: 'success',
            message: `Arquivo CSV "${file.name}" importado com sucesso! ${res.count} atendimentos processados.`,
          });
          onSyncCompleted();
        } else {
          setSyncStatus({
            type: 'error',
            message: res.error || 'Erro ao ler arquivo CSV.',
          });
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const detectedColumns = [
    { col: 'Data da solicitação (local)', role: 'Data do atendimento (ex: 21/10/2026, 22/10/2026)', status: 'Mapeado' },
    { col: 'Hora da solicitação (local)', role: 'Horário do embarque / solicitação', status: 'Mapeado' },
    { col: 'Nome / Sobrenome', role: 'Solicitante (ex: Paulo Ricardo, Henderson de Moraes)', status: 'Mapeado' },
    { col: 'Valor total: BRL', role: 'Valor real efetivo da corrida Uber (BRL)', status: 'Mapeado' },
    { col: 'Endereço de partida', role: 'Origem (ex: Terminal 3 GRU, Terminal 1 GRU)', status: 'Mapeado' },
    { col: 'Endereço de destino', role: 'Destino final do colaborador / equipe', status: 'Mapeado' },
    { col: 'Informações da parada', role: 'Relação de passageiros múltiplos e rotas intermediárias', status: 'Mapeado' },
    { col: 'Várias paradas', role: 'Contagem de paradas (1, 2 ou 3 passageiros)', status: 'Mapeado' },
    { col: 'Distância (mi) / Duração', role: 'Quilometragem e tempo de deslocamento', status: 'Mapeado' },
    { col: 'ID da viagem/Uber Eats', role: 'Identificador único da transação', status: 'Mapeado' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Conexão Direta com Google Sheets & Base CSV
              </h3>
              <p className="text-xs text-slate-500">
                Sincronização em tempo real das corridas Uber Central para cálculo do saving
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 px-2 py-1 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* Status Alert if any */}
          {syncStatus && (
            <div
              className={`p-3 rounded-md flex items-center gap-2 ${
                syncStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {syncStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{syncStatus.message}</span>
            </div>
          )}

          {/* Option 1: Google Sheets URL */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Link da Planilha Google Sheets
              </span>
              <span className="text-[11px] text-slate-500">
                Última sincronização: {currentConfig.lastSyncedAt}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Cole o link da sua planilha compartilhada do Google Sheets. O sistema converterá automaticamente para o formato de extração em tempo real:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1XyZ.../edit"
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-slate-800"
              />
              <button
                onClick={handleSyncUrl}
                disabled={isSyncing || !sheetUrl}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
              </button>
            </div>
          </div>

          {/* Option 2: Upload CSV */}
          <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center space-y-2 hover:border-slate-400 transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mx-auto" />
            <div className="text-slate-800 font-semibold">
              Ou faça upload direto de arquivo .csv extraído
            </div>
            <p className="text-slate-500 text-[11px]">
              Suporta exportações nativas do Uber Central, Google Sheets e relatórios corporativos
            </p>
            <label className="inline-block cursor-pointer mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md text-xs transition-colors">
              <span>Selecionar Arquivo .CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Column Mapping Review */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Table className="w-4 h-4 text-slate-500" />
                Mapeamento Automático de Colunas da Planilha
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                10 colunas essenciais verificadas
              </span>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Coluna na Planilha / CSV</th>
                    <th className="py-2 px-3 font-semibold">Função no Painel</th>
                    <th className="py-2 px-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detectedColumns.map((col, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">
                        {col.col}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {col.role}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <Check className="w-3 h-3" />
                          <span>{col.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
