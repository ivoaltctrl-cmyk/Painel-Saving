import React, { useState, useRef } from 'react';
import { SheetsService } from '../services/sheetsService';
import { 
  Upload, 
  FileSpreadsheet, 
  Clipboard, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface DataUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUpdated: (latestDate?: string) => void;
}

export const DataUpdateModal: React.FC<DataUpdateModalProps> = ({
  isOpen,
  onClose,
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'sheets'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState(SheetsService.getConfig().sheetUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (content) {
          const res = SheetsService.importFromCsvText(content, importMode);
          if (res.success) {
            const datesStr = res.dates.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ');
            setStatusMessage({
              type: 'success',
              text: `Planilha importada com sucesso! ${res.count} atendimentos processados (${res.newTripsCount} novas corridas adicionadas). Dias na base: ${datesStr}.`,
            });
            onDataUpdated(res.latestDate);
          } else {
            setStatusMessage({
              type: 'error',
              text: res.error || 'Erro ao processar as colunas do arquivo CSV.',
            });
          }
        }
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setStatusMessage({ type: 'error', text: 'Cole os dados da planilha antes de processar.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const res = SheetsService.importFromCsvText(pastedText, importMode);
      if (res.success) {
        const datesStr = res.dates.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ');
        setStatusMessage({
          type: 'success',
          text: `Dados processados com sucesso! ${res.count} viagens registradas (${res.newTripsCount} novas viagens adicionadas). Dias na base: ${datesStr}.`,
        });
        setPastedText('');
        onDataUpdated(res.latestDate);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Não foi possível reconhecer o formato das colunas.',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncGoogleSheets = async () => {
    if (!sheetsUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Informe a URL da planilha Google Sheets.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const res = await SheetsService.syncFromGoogleSheets(sheetsUrl);
      if (res.success) {
        const datesStr = res.dates ? res.dates.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ') : '';
        const tabInfo = res.detectedTab ? ` (Aba identificada: ${res.detectedTab})` : '';
        setStatusMessage({
          type: 'success',
          text: `Planilha sincronizada online com sucesso! ${res.count} viagens carregadas${tabInfo}. Dias na base: ${datesStr}.`,
        });
        onDataUpdated(res.latestDate);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Erro ao conectar com a planilha Google Sheets. Verifique o compartilhamento.',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Atualização Diária de Dados
              </h3>
              <p className="text-xs text-slate-500">
                Suba o arquivo CSV do dia, cole registros da planilha ou sincronize online
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message Notification */}
        {statusMessage && (
          <div className={`p-3.5 mx-4 mt-4 rounded-md text-xs flex items-center gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-4 pt-3 border-b border-slate-200 flex gap-2 overflow-x-auto text-xs bg-white">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Arquivo CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'paste'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Colar Linhas da Planilha</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Sheets URL</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Mode Selector: Merge vs Replace */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 block">Modo de Importação:</span>
                <span className="text-[11px] text-slate-500">
                  {importMode === 'merge' 
                    ? 'Mesclar novas viagens mantendo os dias anteriores' 
                    : 'Substituir toda a base pelos registros deste arquivo'}
                </span>
              </div>
            </div>
            <div className="inline-flex rounded border border-slate-300 bg-white p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                  importMode === 'merge' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Mesclar (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                  importMode === 'replace' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Substituir
              </button>
            </div>
          </div>

          {/* TAB 1: UPLOAD CSV FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="font-bold text-slate-800 text-xs">
                  Clique para selecionar o arquivo .CSV
                </div>
                <div className="text-[11px] text-slate-500 max-w-sm leading-normal">
                  Suporta arquivos com vírgula (<code>,</code>) ou ponto-e-vírgula (<code>;</code>) e datas em formato brasileiro ou americano.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="font-semibold text-slate-700 block">
                Copie as linhas da planilha Uber e cole abaixo:
              </label>
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Cole aqui o conteúdo do arquivo CSV ou as linhas copiadas do Google Sheets..."
                className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              ></textarea>
              <div className="flex justify-end">
                <button
                  onClick={handleProcessPastedText}
                  disabled={isProcessing || !pastedText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>Processar Dados Colados</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS SYNC */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800">Planilha Conectada: SavingTransporteAvulso</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Pública</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O sistema agora detecta automaticamente as abas: mesmo se você copiar o link enquanto visualiza a aba de resumo <strong>Dados Taxi Moover</strong>, o sincronizador localiza e processa automaticamente as viagens detalhadas da aba <strong>Dados Uber</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">
                  Link da Planilha Google Sheets (Visualização ou Exportação):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/edit"
                    className="flex-1 px-2.5 py-2 font-mono text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setSheetsUrl('https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/edit')}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors shrink-0"
                    title="Restaurar link oficial da planilha SavingTransporteAvulso"
                  >
                    Link Oficial
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Atualização diária instantânea via conexão com o Google Sheets.
                </span>
                <button
                  onClick={handleSyncGoogleSheets}
                  disabled={isProcessing || !sheetsUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Sincronizar Planilha Agora</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500">
          <span>Ao importar, o dia mais recente é selecionado automaticamente no painel.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
