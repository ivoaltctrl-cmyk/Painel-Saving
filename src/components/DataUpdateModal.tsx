import React, { useState } from 'react';
import { SheetsService } from '../services/sheetsService';
import { RefreshCw, CheckCircle2, AlertTriangle, X, Database } from 'lucide-react';

interface DataUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated: (latestDate?: string) => void;
}

export const DataUpdateModal: React.FC<DataUpdateModalProps> = ({ isOpen, onClose, onDataUpdated }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const cfg = SheetsService.getConfig();

  const handleSync = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await SheetsService.syncFromGoogleSheets();
      if (res.success) {
        const datesStr = (res.dates || []).map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ');
        setStatusMessage({
          type: 'success',
          text: `Planilha lida com sucesso: ${res.count} viagens. Dias na base: ${datesStr}.`,
        });
        onDataUpdated(res.latestDate);
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Não foi possível ler a planilha.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erro ao ler a planilha.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Atualizar dados</h3>
              <p className="text-xs text-slate-500">A planilha Google Sheets é a base oficial</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3.5 mx-4 mt-4 rounded-md text-xs flex items-center gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {statusMessage.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        <div className="p-5 space-y-4 text-xs">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Para incluir ou corrigir corridas, edite a aba <strong>Dados Uber</strong> da planilha. O painel lê a planilha
            automaticamente a cada 30 segundos; use o botão abaixo para ler agora.
          </p>
          <div className="text-[11px] text-slate-500">
            Última leitura: <strong>{cfg.lastSyncedAt || '—'}</strong>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSync}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Lendo planilha...' : 'Ler planilha agora'}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md">Fechar</button>
        </div>
      </div>
    </div>
  );
};
