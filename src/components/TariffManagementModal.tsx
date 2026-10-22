import React, { useState } from 'react';
import { ContractTariffPeriod, TariffAuditLog } from '../types/mobility';
import { SheetsService } from '../services/sheetsService';
import { 
  ShieldCheck, 
  History, 
  Plus, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  Check, 
  X,
  Lock
} from 'lucide-react';

interface TariffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTariffUpdated: () => void;
}

export const TariffManagementModal: React.FC<TariffManagementModalProps> = ({
  isOpen,
  onClose,
  onTariffUpdated,
}) => {
  const [periods, setPeriods] = useState<ContractTariffPeriod[]>(SheetsService.getTariffPeriods());
  const [auditLogs, setAuditLogs] = useState<TariffAuditLog[]>(SheetsService.getAuditLogs());

  // Form de nova vigência com proteção e auditoria
  const [showAddForm, setShowAddForm] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [contractSourceInput, setContractSourceInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const handleSaveNewTariff = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedRate = parseFloat(rateInput.replace(',', '.'));
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setErrorMsg('Informe um valor de tarifa válido maior que zero.');
      return;
    }

    if (!contractSourceInput.trim()) {
      setErrorMsg('Informe a fonte contratual ou documento de respaldo (obrigatório).');
      return;
    }

    if (!authorInput.trim()) {
      setErrorMsg('Informe o nome do responsável pela alteração (obrigatório).');
      return;
    }

    if (!reasonInput.trim()) {
      setErrorMsg('O motivo da alteração é obrigatório para o registro de auditoria.');
      return;
    }

    const confirmAction = window.confirm(
      `Confirma a aplicação da nova tarifa de ${formatBRL(parsedRate)} a partir de ${startDateInput}?\nEsta alteração ficará registrada no log de auditoria permanente.`
    );

    if (!confirmAction) return;

    SheetsService.addTariffPeriodWithAudit({
      rate: parsedRate,
      startDate: startDateInput,
      contractSource: contractSourceInput.trim(),
      author: authorInput.trim(),
      reason: reasonInput.trim(),
    });

    setPeriods(SheetsService.getTariffPeriods());
    setAuditLogs(SheetsService.getAuditLogs());
    setShowAddForm(false);
    setRateInput('');
    setReasonInput('');
    setContractSourceInput('');
    onTariffUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Gestão das Vigências da Tarifa de Táxi Avulso
              </h3>
              <p className="text-xs text-slate-500">
                Tabela oficial de vigências contratuais e log de auditoria com justificativa obrigatória
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 text-xs">
          {/* Tabela de Vigências Ativas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                Vigências Contratuais Cadastradas
              </span>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Nova Vigência</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2 px-3">Tarifa de Referência</th>
                    <th className="py-2 px-3">Período de Vigência</th>
                    <th className="py-2 px-3">Documento Contratual / Respaldo</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periods.map((p, idx) => {
                    const isLatest = idx === periods.length - 1;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-sm">
                          {formatBRL(p.rate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">
                          {p.startDate.split('-').reverse().join('/')} até {p.endDate ? p.endDate.split('-').reverse().join('/') : 'Vigente'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {p.contractSource}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isLatest ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              <Check className="w-3 h-3" />
                              <span>Vigente</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Encerrado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form protegido de adição com motivo obrigatório */}
          {showAddForm && (
            <form onSubmit={handleSaveNewTariff} className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Atualização Protegida de Tarifa de Táxi
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancelar
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Novo Valor da Tarifa (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 146,06 ou 152,00"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Data de Início da Vigência *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Documento Contratual / Fonte do Respaldo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Contrato Táxi GRU Aditivo 02/2026 - Cláusula 5"
                  value={contractSourceInput}
                  onChange={(e) => setContractSourceInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Responsável pela Alteração *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ivo Emmanuel Firmino de Lima"
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Justificativa / Motivo da Alteração *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Reajuste anual acordado em termo aditivo"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded shadow-xs"
                >
                  Confirmar e Registrar Alteração
                </button>
              </div>
            </form>
          )}

          {/* Histórico de Alterações e Auditoria */}
          <div className="space-y-3 pt-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              Histórico de Alterações (Log de Auditoria)
            </span>

            <div className="border border-slate-200 rounded-md overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold sticky top-0">
                    <th className="py-2 px-3">Data e Hora</th>
                    <th className="py-2 px-3">Responsável</th>
                    <th className="py-2 px-3">De ➔ Para</th>
                    <th className="py-2 px-3">Motivo Registrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {log.author}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                        <span className="text-slate-400 line-through mr-1">{formatBRL(log.previousValue)}</span>
                        ➔ <strong className="text-emerald-700">{formatBRL(log.newValue)}</strong>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {log.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
          <span className="text-[11px] text-slate-500">
            Regra de cálculo: cada corrida é comparada com a tarifa contratual vigente na sua data.
          </span>
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
