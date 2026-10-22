import React, { useState } from 'react';
import { ExecutiveBoardComparison, UberCsvTripRecord } from '../types/mobility';
import { SheetsService } from '../services/sheetsService';
import { Copy, Check, Printer, Edit3, Save, RotateCcw, FileText, CheckCircle2 } from 'lucide-react';

interface ExecutiveReportViewProps {
  dailyComparison: ExecutiveBoardComparison;
  accumulatedComparison: ExecutiveBoardComparison;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onDataRefresh: () => void;
}

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  dailyComparison,
  accumulatedComparison,
  availableDates,
  selectedDate,
  onSelectDate,
  onDataRefresh,
}) => {
  const [taxiRateInput, setTaxiRateInput] = useState<string>(
    dailyComparison.taxiReferenceRate.toString()
  );
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const formatPercent = (val: number) => {
    return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const handleSaveTaxiRate = () => {
    const parsed = parseFloat(taxiRateInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      SheetsService.setTaxiReferenceRate(parsed);
      setIsEditingRate(false);
      onDataRefresh();
    }
  };

  const handleResetTaxiRate = () => {
    setTaxiRateInput('146.06');
    SheetsService.setTaxiReferenceRate(146.06);
    setIsEditingRate(false);
    onDataRefresh();
  };

  // Gerar texto formatado idêntico ao e-mail enviado à diretoria
  const generateEmailText = () => {
    const d = dailyComparison;
    const a = accumulatedComparison;

    return `RES: Acompanhamento Processo Uber - 10/2026

Segue visão do dia ${selectedDate.split('-')[2]}/${selectedDate.split('-')[1]} e acumulado dos dois dias.

Considerando o custo de referência de ${formatBRL(a.taxiReferenceRate)} por pedido de táxi, o mesmo volume de ${a.uber.tripCount} atendimentos acumulados nos dias ${availableDates.map(dt => dt.split('-')[2] + '/' + dt.split('-')[1]).join(' e ')} representaria um desembolso estimado de ${formatBRL(a.taxi.totalCost)}.

A comparação com o custo real de ${formatBRL(a.uber.totalCost)} pela Uber demonstra uma economia estimada de ${formatBRL(a.taxi.totalCost - a.uber.totalCost)}, equivalente a uma redução de ${formatPercent(a.uber.costReductionPercent)} nos custos.

${d.scopeTitle}
Indicador\tTáxi\tUber
Quantidade de pedidos/registros\t${d.taxi.tripCount}\t${d.uber.tripCount}
Custo médio por pedido/registro\t${formatBRL(d.taxi.avgCostPerTrip)}\t${formatBRL(d.uber.avgCostPerTrip)}
Custo total\t${formatBRL(d.taxi.totalCost)}\t${formatBRL(d.uber.totalCost)}
Economia por pedido\t—\t${formatBRL(d.uber.economyPerTrip)}
Redução de custo\t—\t${formatPercent(d.uber.costReductionPercent)}
Custo mediano por registro\t${formatBRL(d.taxi.medianCost)}\t${formatBRL(d.uber.medianCost)}
Total de passageiros\t${d.taxi.totalPassengers}\t${d.uber.totalPassengers}
Custo médio por passageiro\t${formatBRL(d.taxi.avgCostPerPassenger)}\t${formatBRL(d.uber.avgCostPerPassenger)}

${a.scopeTitle}
Indicador\tTáxi\tUber
Quantidade de pedidos/registros\t${a.taxi.tripCount}\t${a.uber.tripCount}
Custo médio por pedido/registro\t${formatBRL(a.taxi.avgCostPerTrip)}\t${formatBRL(a.uber.avgCostPerTrip)}
Custo total\t${formatBRL(a.taxi.totalCost)}\t${formatBRL(a.uber.totalCost)}
Economia por pedido\t—\t${formatBRL(a.uber.economyPerTrip)}
Redução de custo\t—\t${formatPercent(a.uber.costReductionPercent)}
Custo mediano por registro\t${formatBRL(a.taxi.medianCost)}\t${formatBRL(a.uber.medianCost)}
Total de passageiros\t${a.taxi.totalPassengers}\t${a.uber.totalPassengers}
Custo médio por passageiro\t${formatBRL(a.taxi.avgCostPerPassenger)}\t${formatBRL(a.uber.avgCostPerPassenger)}`;
  };

  const handleCopyEmail = () => {
    const text = generateEmailText();
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderComparisonTable = (comp: ExecutiveBoardComparison) => {
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">
            {comp.scopeTitle}
          </h3>
          <span className="text-xs text-emerald-400 font-mono tabular-nums font-semibold">
            Economia: {formatPercent(comp.uber.costReductionPercent)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-4 font-bold text-slate-900">Indicador</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900 w-36">Táxi</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900 w-36 bg-emerald-50/50">Uber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Quantidade de pedidos/registros</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{comp.taxi.tripCount}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 bg-emerald-50/30">{comp.uber.tripCount}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo médio por pedido/registro</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.avgCostPerTrip)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30">{formatBRL(comp.uber.avgCostPerTrip)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo total</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.totalCost)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30">{formatBRL(comp.uber.totalCost)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Economia por pedido</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-400">—</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-600 bg-emerald-50/30">+{formatBRL(comp.uber.economyPerTrip)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50 bg-emerald-50/20">
                <td className="py-2.5 px-4 font-bold text-slate-900">Redução de custo</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-400">—</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-extrabold text-emerald-700 bg-emerald-50/50">{formatPercent(comp.uber.costReductionPercent)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo mediano por registro</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.medianCost)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 bg-emerald-50/30">{formatBRL(comp.uber.medianCost)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Total de passageiros</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{comp.taxi.totalPassengers}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 bg-emerald-50/30">{comp.uber.totalPassengers}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo médio por passageiro</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.avgCostPerPassenger)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30">{formatBRL(comp.uber.avgCostPerPassenger)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const totalAccumulatedEconomy = accumulatedComparison.taxi.totalCost - accumulatedComparison.uber.totalCost;

  return (
    <div className="space-y-6">
      {/* Top Banner & Copy Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h2 className="text-base font-bold text-slate-900">
                Relatório Executivo para a Diretoria
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Formato oficial consolidado para apresentação do saving obtido na migração do Táxi Avulso para Uber Central
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Selector for Table 1 */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Dia analisado:</span>
              <select
                value={selectedDate}
                onChange={(e) => onSelectDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
              >
                {availableDates.map((dateStr) => {
                  const parts = dateStr.split('-');
                  const label = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
                  return (
                    <option key={dateStr} value={dateStr}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyEmail}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                copiedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
              }`}
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Formato E-mail</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
              title="Imprimir relatório"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Custo de Referência do Táxi Configurator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 text-xs gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 font-medium">Custo de referência por pedido de táxi:</span>
            {isEditingRate ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-500">R$</span>
                <input
                  type="text"
                  value={taxiRateInput}
                  onChange={(e) => setTaxiRateInput(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  onClick={handleSaveTaxiRate}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  title="Salvar taxa"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingRate(false)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                  title="Cancelar"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <strong className="font-mono tabular-nums text-slate-900 font-bold text-sm bg-slate-100 px-2 py-0.5 rounded">
                  {formatBRL(dailyComparison.taxiReferenceRate)}
                </strong>
                <button
                  onClick={() => setIsEditingRate(true)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                  title="Alterar taxa de referência do táxi"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {dailyComparison.taxiReferenceRate !== 146.06 && (
                  <button
                    onClick={handleResetTaxiRate}
                    className="text-[11px] text-slate-400 hover:underline ml-1"
                  >
                    Restaurar R$ 146,06
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="text-slate-500 text-[11px]">
            Base de cálculo: Valor padrão contratual de táxi avulso por atendimento
          </div>
        </div>
      </div>

      {/* Official Executive Text Card (Matching the Board Submission) */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
        <div className="border-b border-slate-200 pb-3 mb-4 text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">De:</span>
            <span>Ivo Emmanuel Firmino de Lima</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Assunto:</span>
            <span className="font-semibold text-slate-900">RES: Acompanhamento Processo Uber - 10/2026</span>
          </div>
        </div>

        {/* Narrative Paragraph with Highlighted Numbers */}
        <div className="text-sm text-slate-800 leading-relaxed space-y-3 font-sans">
          <p>
            Segue visão do dia{' '}
            <strong>
              {selectedDate.split('-')[2]}/{selectedDate.split('-')[1]}
            </strong>{' '}
            e acumulado dos dois dias.
          </p>

          <p>
            Considerando o custo de referência de{' '}
            <strong className="font-mono tabular-nums">
              {formatBRL(accumulatedComparison.taxiReferenceRate)}
            </strong>{' '}
            por pedido de táxi, o mesmo volume de{' '}
            <strong className="font-mono tabular-nums">
              {accumulatedComparison.uber.tripCount} atendimentos acumulados
            </strong>{' '}
            nos dias{' '}
            <strong>
              {availableDates.map((d) => `${d.split('-')[2]}/${d.split('-')[1]}`).join(' e ')}
            </strong>{' '}
            representaria um desembolso estimado de{' '}
            <strong className="font-mono tabular-nums">
              {formatBRL(accumulatedComparison.taxi.totalCost)}
            </strong>
            .
          </p>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 font-medium leading-relaxed">
            A comparação com o custo real de{' '}
            <strong className="font-mono tabular-nums font-bold">
              {formatBRL(accumulatedComparison.uber.totalCost)}
            </strong>{' '}
            pela Uber demonstra uma economia estimada de{' '}
            <mark className="bg-yellow-200 px-1.5 py-0.5 rounded font-mono tabular-nums font-bold text-slate-950">
              {formatBRL(totalAccumulatedEconomy)}
            </mark>
            , equivalente a uma redução de{' '}
            <mark className="bg-yellow-200 px-1.5 py-0.5 rounded font-mono tabular-nums font-bold text-slate-950">
              {formatPercent(accumulatedComparison.uber.costReductionPercent)}
            </mark>{' '}
            nos custos.
          </div>
        </div>

        {/* Two Official Tables Side by Side or Stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Table 1: Selected Day */}
          <div>
            {renderComparisonTable(dailyComparison)}
          </div>

          {/* Table 2: Accumulated */}
          <div>
            {renderComparisonTable(accumulatedComparison)}
          </div>
        </div>

        {/* Extra Executive Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Colaboradores Transportados</span>
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {accumulatedComparison.uber.totalPassengers} pessoas
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Em {accumulatedComparison.uber.tripCount} viagens com paradas otimizadas
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Custo Médio por Colaborador</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono tabular-nums text-emerald-600">
                {formatBRL(accumulatedComparison.uber.avgCostPerPassenger)}
              </span>
              <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                {formatBRL(accumulatedComparison.taxi.avgCostPerPassenger)}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Economia de {formatBRL(accumulatedComparison.taxi.avgCostPerPassenger - accumulatedComparison.uber.avgCostPerPassenger)} por passageiro
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-0.5">Economia Média por Pedido</span>
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-600">
              {formatBRL(accumulatedComparison.uber.economyPerTrip)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Custo mediano Uber: {formatBRL(accumulatedComparison.uber.medianCost)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
