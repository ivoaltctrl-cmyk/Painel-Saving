import React, { useState, useEffect } from 'react';
import { 
  ExecutiveBoardComparison, 
  TaxiScenario, 
  PeriodFilter, 
  SavingTargetConfig,
  UberCsvTripRecord,
  BreakdownSlice
} from '../types/mobility';
import { SheetsService } from '../services/sheetsService';
import { 
  Printer, 
  Settings2, 
  Target, 
  Users, 
  AlertOctagon, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  HelpCircle,
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  Award,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';

interface ExecutiveReportViewProps {
  dailyComparison: ExecutiveBoardComparison;
  accumulatedComparison: ExecutiveBoardComparison;
  availableDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onDataRefresh: () => void;
  onOpenTariffModal: () => void;
  lastSyncTime: string;
  periodFilter: PeriodFilter;
  onPeriodFilterChange: (filter: PeriodFilter, range?: { start: string; end: string }) => void;
  periodFilterLabel: string;
  outliersData: {
    top5Expensive: UberCsvTripRecord[];
    outliers: UberCsvTripRecord[];
    meanCost: number;
    threshold: number;
  };
  breakdowns: {
    byShift: BreakdownSlice[];
    byDistrict: BreakdownSlice[];
    byCostCenter: BreakdownSlice[];
  };
  targetConfig: SavingTargetConfig;
}

export const ExecutiveReportView: React.FC<ExecutiveReportViewProps> = ({
  dailyComparison,
  accumulatedComparison,
  availableDates,
  selectedDate,
  onSelectDate,
  onDataRefresh,
  onOpenTariffModal,
  lastSyncTime,
  periodFilter,
  onPeriodFilterChange,
  periodFilterLabel,
  outliersData,
  breakdowns,
  targetConfig,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TaxiScenario>(SheetsService.getActiveScenario());
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetTypeInput, setTargetTypeInput] = useState<'value' | 'percent'>(targetConfig.targetType);
  const [targetValueInput, setTargetValueInput] = useState<string>(targetConfig.targetValue.toString());
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<'shift' | 'district' | 'costCenter'>('shift');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

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

  const handleScenarioChange = (newScenario: TaxiScenario) => {
    setSelectedScenario(newScenario);
    SheetsService.setActiveScenario(newScenario);
    onDataRefresh();
  };

  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [isSyncingSheetsTarget, setIsSyncingSheetsTarget] = useState(false);

  // Mantém os campos do formulário sincronizados com as atualizações remotas de meta
  useEffect(() => {
    setTargetTypeInput(targetConfig.targetType);
    setTargetValueInput(targetConfig.targetValue.toString());
  }, [targetConfig]);

  // Parser robusto para números no formato brasileiro (ex: 100.000 ou 100.000,00) e padrão (100000)
  const parseUserTargetNumber = (input: string): number => {
    const clean = input.trim();
    if (!clean) return NaN;

    // Se contiver ponto e vírgula: "100.000,00" ou "100,000.00"
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        // Brasileiro: 100.000,50 -> remove pontos, troca vírgula por ponto
        return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
      } else {
        // Americano: 100,000.50 -> remove vírgulas
        return parseFloat(clean.replace(/,/g, ''));
      }
    }

    // Se contiver apenas vírgula: "100000,50" ou "50000,00" ou "60,5"
    if (clean.includes(',')) {
      return parseFloat(clean.replace(',', '.'));
    }

    // Se contiver apenas ponto: pode ser milhar "100.000" / "6.000" ou decimal "15.5"
    if (clean.includes('.')) {
      const parts = clean.split('.');
      // Se a última parte tiver exatamente 3 dígitos (ex: 100.000 ou 6.000 ou 1.500.000)
      if (parts.length > 1 && parts.every((p, idx) => idx === 0 ? p.length >= 1 : p.length === 3)) {
        return parseFloat(clean.replace(/\./g, ''));
      }
      return parseFloat(clean);
    }

    return parseFloat(clean);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseUserTargetNumber(targetValueInput);
    if (!isNaN(val) && val > 0) {
      setIsSavingTarget(true);
      try {
        await SheetsService.setSavingTarget({
          ...targetConfig,
          targetType: targetTypeInput,
          targetValue: val,
          month: targetConfig.month || '2026-10',
          updatedBy: 'Gestor'
        });
        setIsEditingTarget(false);
        onDataRefresh();
      } finally {
        setIsSavingTarget(false);
      }
    }
  };

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncSheetsTarget = async () => {
    setIsSyncingSheetsTarget(true);
    setSyncFeedback(null);
    try {
      const updated = await SheetsService.syncTargetFromGoogleSheets();
      onDataRefresh();
      setSyncFeedback(`Meta de ${formatBRL(updated.targetValue)} puxada com sucesso diretamente da aba Config da planilha!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch {
      setSyncFeedback('Falha ao conectar com a planilha Google Sheets.');
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncingSheetsTarget(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApplyCustomFilter = () => {
    if (customStart && customEnd) {
      onPeriodFilterChange('custom', { start: customStart, end: customEnd });
      setShowCustomPicker(false);
    }
  };

  // Cálculo da meta e projeção
  const totalAccumulatedEconomy = accumulatedComparison.taxi.totalCost - accumulatedComparison.uber.totalCost;
  const currentSaving = totalAccumulatedEconomy;
  const currentPercent = accumulatedComparison.uber.costReductionPercent;

  let targetProgressPercent = 0;
  let isTargetReached = false;
  const monthlyTargetValue = targetConfig.targetType === 'value' ? targetConfig.targetValue : 100000;
  const annualTargetValue = monthlyTargetValue * 12;

  if (targetConfig.targetType === 'value') {
    targetProgressPercent = Math.min(100, (currentSaving / targetConfig.targetValue) * 100);
    isTargetReached = currentSaving >= targetConfig.targetValue;
  } else {
    targetProgressPercent = Math.min(100, (currentPercent / targetConfig.targetValue) * 100);
    isTargetReached = currentPercent >= targetConfig.targetValue;
  }

  // Estatísticas de amostragem e ritmo operacional
  const sampledDays = Math.max(1, availableDates.length);
  const dailyRunRate = currentSaving / sampledDays;
  const monthDaysTotal = 30;
  const daysRemaining = Math.max(0, monthDaysTotal - sampledDays);

  // Estimativa de Fechamento Mensal
  const projectedMonthlySaving = dailyRunRate * monthDaysTotal;
  const projectedMonthlyPercent = targetConfig.targetType === 'value'
    ? (projectedMonthlySaving / monthlyTargetValue) * 100
    : projectedMonthlySaving;
  const dailyPaceNeeded = daysRemaining > 0 
    ? Math.max(0, (monthlyTargetValue - currentSaving) / daysRemaining) 
    : 0;
  const paceGap = dailyPaceNeeded - dailyRunRate;

  // Estimativa Anualizada (Run-rate 365 dias / 12 meses)
  const annualRunRateSaving = dailyRunRate * 365;
  const annualProgressPercent = (annualRunRateSaving / annualTargetValue) * 100;
  const annualProjectedTaxiSpend = (accumulatedComparison.taxi.totalCost / sampledDays) * 365;
  const annualProjectedUberSpend = (accumulatedComparison.uber.totalCost / sampledDays) * 365;

  // Renderiza tabela comparativa desduplicada (sem repetição de volume nas linhas)
  const renderDeduplicatedTable = (comp: ExecutiveBoardComparison) => {
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
        {/* Header do Card com Totais Idênticos Compartilhados */}
        <div className="bg-slate-900 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">
              {comp.scopeTitle}
            </h3>
            <span className="text-xs text-emerald-400 font-mono tabular-nums font-semibold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              Saving: {formatPercent(comp.uber.costReductionPercent)}
            </span>
          </div>
          {/* Métricas idênticas consolidadas no cabeçalho para evitar repetição nas colunas */}
          <div className="flex items-center gap-4 text-xs text-slate-300 mt-2 pt-2 border-t border-slate-800 flex-wrap">
            <div>
              <span className="text-slate-400">Volume de Atendimentos: </span>
              <strong className="text-white font-mono tabular-nums">{comp.uber.tripCount} pedidos</strong>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div>
              <span className="text-slate-400">Passageiros Transportados: </span>
              <strong className="text-white font-mono tabular-nums">{comp.uber.totalPassengers} pessoas</strong>
            </div>
          </div>
        </div>

        {/* Tabela estrita apenas com indicadores financeiros que diferem */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-4 font-bold text-slate-900">Indicador Financeiro</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-700 w-36">
                  <div className="flex items-center justify-end gap-1">
                    <span>Táxi</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-200 px-1 py-0.2 rounded">Estimado</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900 w-36 bg-emerald-50/50">
                  <div className="flex items-center justify-end gap-1">
                    <span>Uber</span>
                    <span className="text-[10px] uppercase font-semibold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded">Realizado</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo total</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.totalCost)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30">{formatBRL(comp.uber.totalCost)}</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo médio por pedido</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.avgCostPerTrip)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30">{formatBRL(comp.uber.avgCostPerTrip)}</td>
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
                <td className="py-2.5 px-4 font-medium text-slate-800">Custo mediano por pedido</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(comp.taxi.medianCost)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 bg-emerald-50/30">{formatBRL(comp.uber.medianCost)}</td>
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

  const conservativeSaving = (accumulatedComparison.uber.tripCount * (accumulatedComparison.taxiReferenceRate * selectedScenario)) - accumulatedComparison.uber.totalCost;
  const currentScenarioPercentLabel = `${Math.round(selectedScenario * 100)}%`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Oficial WFS para Impressão / Exportação PDF */}
      <div className="hidden print:flex items-center justify-between pb-4 mb-2 border-b-2 border-slate-900">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/wfs-logo.svg_fbe187c8.png"
            alt="WFS - A SATS Company"
            className="h-11 sm:h-12 w-auto object-contain"
          />
          <div className="h-9 w-px bg-slate-300 mx-1" aria-hidden="true" />
          <div>
            <h1 className="text-base font-bold text-slate-900">
              MobilitySaving · Operação Aeroporto Guarulhos (GRU)
            </h1>
            <p className="text-[11px] text-slate-600">
              Relatório Executivo de Saving — Uber Central vs Custo Estimado de Táxi Avulso
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono">
          <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
          <div>Cenário Contratual: {currentScenarioPercentLabel}</div>
        </div>
      </div>

      {/* 1. Global Toolbar: Period Filter, Scenario Selector & Audit Trigger */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h2 className="text-base font-bold text-slate-900">
                Painel Executivo de Saving — Operação GRU
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Desembolso real Uber Central faturado comparado ao custo contratual estimado de referência do Táxi Avulso
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Global Period Filter Selector */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">Período:</span>
              <select
                value={periodFilter}
                onChange={(e) => {
                  const val = e.target.value as PeriodFilter;
                  if (val === 'custom') {
                    setShowCustomPicker(true);
                  } else {
                    onPeriodFilterChange(val);
                  }
                }}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="all">Todo o Período</option>
                <option value="today">Mais Recente (Hoje)</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Mês Atual</option>
                <option value="custom">Personalizado...</option>
              </select>
            </div>

            {/* Date Selector for Daily Table */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              <span className="text-slate-500 font-medium">Dia:</span>
              <select
                value={selectedDate}
                onChange={(e) => onSelectDate(e.target.value)}
                className="bg-transparent font-mono tabular-nums text-slate-900 font-semibold focus:outline-none cursor-pointer"
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

            {/* Tariff & Audit Button */}
            <button
              onClick={onOpenTariffModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors shadow-2xs"
              title="Gerenciar tabela de vigências contratuais e histórico de auditoria"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Tarifa Táxi ({formatBRL(accumulatedComparison.taxiReferenceRate)})</span>
            </button>

            {/* Print / PDF Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors shadow-2xs"
              title="Gerar visualização para impressão ou salvar em PDF A4"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker Modal/Popdown if open */}
        {showCustomPicker && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-700">Intervalo de datas:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-slate-800 bg-white"
            />
            <span>até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-slate-800 bg-white"
            />
            <button
              onClick={handleApplyCustomFilter}
              className="px-3 py-1 bg-slate-900 text-white rounded font-bold text-xs"
            >
              Aplicar
            </button>
            <button
              onClick={() => setShowCustomPicker(false)}
              className="text-slate-500 hover:text-slate-700 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* 2. Monthly Saving Target Card with Progress Bar & Projection (Shared globally across all users) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Meta de Saving Mensal
            </h3>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Sincronizada em tempo real</span>
            </span>
            <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
              Aba Config (Planilha)
            </span>
            {targetConfig.updatedAt && (
              <span className="text-[10px] text-slate-500">
                (Última atualização: {new Date(targetConfig.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - Planilha Google Sheets (Aba Config))
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncSheetsTarget}
              disabled={isSyncingSheetsTarget}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Puxar meta atualizada diretamente da aba Config da planilha Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingSheetsTarget ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheetsTarget ? 'Puxando da Planilha...' : 'Puxar da Planilha'}</span>
            </button>
            <button
              onClick={() => setIsEditingTarget(!isEditingTarget)}
              className="text-xs text-slate-600 hover:text-slate-900 underline font-semibold cursor-pointer"
            >
              {isEditingTarget ? 'Fechar Edição' : 'Ajustar Meta'}
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{syncFeedback}</span>
          </div>
        )}

        {isEditingTarget && (
          <form onSubmit={handleSaveTarget} className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-center gap-3">
            <span className="text-slate-700 font-semibold">Tipo de Meta:</span>
            <select
              value={targetTypeInput}
              onChange={(e) => setTargetTypeInput(e.target.value as any)}
              className="px-2 py-1 border border-slate-300 rounded bg-white font-medium"
            >
              <option value="value">Valor Financeiro (R$)</option>
              <option value="percent">Percentual de Redução (%)</option>
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={targetValueInput}
                onChange={(e) => setTargetValueInput(e.target.value)}
                placeholder={targetTypeInput === 'value' ? 'Ex: 50000 ou 50.000' : 'Ex: 60 ou 60%'}
                className="w-36 px-2.5 py-1 border border-slate-300 rounded bg-white font-mono font-bold text-slate-900"
              />
              <span className="text-slate-500 font-medium text-[11px]">
                {targetTypeInput === 'value' ? 'R$' : '%'}
              </span>
            </div>
            <button
              type="submit"
              disabled={isSavingTarget}
              className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded font-bold cursor-pointer transition-colors shadow-2xs"
            >
              {isSavingTarget ? 'Salvando...' : 'Salvar Meta'}
            </button>
          </form>
        )}

        {/* 4 Cards de Métricas: Realizado, Ritmo, Estimativa Mensal e Estimativa Anual */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Saving Atual Realizado */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Saving Atual Realizado
            </span>
            <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-600">
              {formatBRL(currentSaving)}
            </div>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span>Meta Mensal:</span>
              <strong className="font-mono text-slate-900">{formatBRL(monthlyTargetValue)}</strong>
            </div>
            <div className="text-[10px] text-slate-500">
              {targetProgressPercent.toFixed(1)}% atingido ({daysRemaining} dias restantes)
            </div>
          </div>

          {/* Card 2: Ritmo Diário & Ritmo Necessário */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Ritmo Médio Diário
            </span>
            <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
              {formatBRL(dailyRunRate)} <span className="text-xs font-normal text-slate-500">/dia</span>
            </div>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span>Ritmo p/ 100% Meta:</span>
              <strong className="font-mono text-amber-800">{formatBRL(dailyPaceNeeded)}/dia</strong>
            </div>
            <div className="text-[10px] font-medium text-slate-500">
              {dailyRunRate >= dailyPaceNeeded ? (
                <span className="text-emerald-700 font-bold">Acima do ritmo necessário!</span>
              ) : (
                <span className="text-amber-700 font-semibold">Gap de apenas {formatBRL(paceGap)}/dia</span>
              )}
            </div>
          </div>

          {/* Card 3: Estimativa de Fechamento do Mês */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">
                Estimativa Mensal (30d)
              </span>
              <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                {projectedMonthlyPercent.toFixed(1)}% Meta
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-blue-700">
              {formatBRL(projectedMonthlySaving)}
            </div>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-blue-100 flex items-center justify-between">
              <span>Projeção vs Meta:</span>
              <strong className={`font-mono ${projectedMonthlySaving >= monthlyTargetValue ? 'text-emerald-700 font-bold' : 'text-slate-800'}`}>
                {projectedMonthlySaving >= monthlyTargetValue ? `+${formatBRL(projectedMonthlySaving - monthlyTargetValue)}` : `-${formatBRL(monthlyTargetValue - projectedMonthlySaving)}`}
              </strong>
            </div>
            <div className="text-[10px] text-blue-800/80">
              Mantendo a média de {sampledDays} dias apurados
            </div>
          </div>

          {/* Card 4: Estimativa Anualizada */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider">
                Estimativa Anual (Run-Rate)
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                {annualProgressPercent.toFixed(1)}% Meta
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700">
              {formatBRL(annualRunRateSaving)}
            </div>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-emerald-100 flex items-center justify-between">
              <span>Meta Anual (12x):</span>
              <strong className="font-mono text-slate-900">{formatBRL(annualTargetValue)}</strong>
            </div>
            <div className="text-[10px] text-emerald-800/80">
              Economia prevista superior a R$ 1,15M no ano
            </div>
          </div>
        </div>

        {/* Barra de Progresso com Projeção e Status */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Atingimento da Meta Mensal:</span>
              <span className="font-mono tabular-nums font-bold text-emerald-700">
                {formatBRL(currentSaving)} ({targetProgressPercent.toFixed(1)}%) realizado
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono tabular-nums text-blue-700 font-semibold">
                {formatBRL(projectedMonthlySaving)} ({projectedMonthlyPercent.toFixed(1)}%) estimado
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 font-mono">
              Faltam {formatBRL(Math.max(0, monthlyTargetValue - currentSaving))} em {daysRemaining} dias
            </div>
          </div>

          {/* Dual Visual Progress Bar */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
            {/* Projected portion */}
            <div
              className="h-full bg-blue-300 transition-all duration-500 absolute top-0 left-0"
              style={{ width: `${Math.min(100, projectedMonthlyPercent)}%` }}
              title={`Projeção: ${formatBRL(projectedMonthlySaving)} (${projectedMonthlyPercent.toFixed(1)}%)`}
            ></div>
            {/* Realized portion */}
            <div
              className={`h-full transition-all duration-500 absolute top-0 left-0 ${isTargetReached ? 'bg-emerald-600' : 'bg-slate-900'}`}
              style={{ width: `${Math.min(100, targetProgressPercent)}%` }}
              title={`Realizado: ${formatBRL(currentSaving)} (${targetProgressPercent.toFixed(1)}%)`}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block"></span>
                <span>Realizado ({targetProgressPercent.toFixed(1)}%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-300 inline-block"></span>
                <span>Projeção até fim do mês ({projectedMonthlyPercent.toFixed(1)}%)</span>
              </span>
            </div>
            <span className="font-semibold text-slate-700">
              Meta Mensal: {formatBRL(monthlyTargetValue)}
            </span>
          </div>
        </div>

        {/* Detalhamento Executivo das Estimativas: Mensal vs Anual */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box Estimativa Mensal */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs space-y-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-xs">Detalhamento da Estimativa Mensal</h4>
              </div>
              <span className="font-mono text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Outubro/2026
              </span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Período com dados apurados:</span>
                <strong className="font-mono text-slate-900">{sampledDays} de {monthDaysTotal} dias ({((sampledDays / monthDaysTotal) * 100).toFixed(0)}%)</strong>
              </div>
              <div className="flex justify-between">
                <span>Saving médio gerado por dia:</span>
                <strong className="font-mono text-emerald-700">+{formatBRL(dailyRunRate)}/dia</strong>
              </div>
              <div className="flex justify-between">
                <span>Previsão de Saving ao fim do mês:</span>
                <strong className="font-mono text-blue-700 font-bold">{formatBRL(projectedMonthlySaving)}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
                <span>Ritmo diário necessário p/ 100% da meta:</span>
                <strong className="font-mono text-amber-800">{formatBRL(dailyPaceNeeded)}/dia</strong>
              </div>
            </div>
          </div>

          {/* Box Estimativa Anual */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs space-y-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-xs">Detalhamento da Estimativa Anual</h4>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                12 Meses (365 dias)
              </span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Custo anual estimado no Táxi Avulso:</span>
                <strong className="font-mono text-slate-400 line-through">{formatBRL(annualProjectedTaxiSpend)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Desembolso anual previsto no Uber Central:</span>
                <strong className="font-mono text-slate-900">{formatBRL(annualProjectedUberSpend)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Economia líquida anual prevista:</span>
                <strong className="font-mono text-emerald-600 font-bold">+{formatBRL(annualRunRateSaving)}/ano</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
                <span>Eficiência financeira contratual sustentada:</span>
                <strong className="font-mono text-emerald-700 font-bold">+{accumulatedComparison.uber.costReductionPercent.toFixed(1)}% de economia</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Occupancy Indicators & Single-Passenger Grouping Opportunity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Occupancy Rate */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-600" />
              Taxa Média de Ocupação
            </span>
            <span className="font-mono tabular-nums font-bold text-slate-900 text-lg">
              {accumulatedComparison.uber.occupancyRate.toFixed(2)} passageiros/viagem
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Média de colaboradores transportados por chamada Uber Central. As múltiplas paradas garantem diluição de custo e otimização da rota.
          </p>
        </div>

        {/* Card Single-Passenger Trips (Grouping Opportunity) */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-amber-600" />
              Oportunidade de Agrupamento
            </span>
            <span className="font-mono tabular-nums font-bold text-amber-800 text-lg">
              {accumulatedComparison.uber.singlePassengerTripsCount} corridas ({formatPercent(accumulatedComparison.uber.singlePassengerTripsPercent)})
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Corridas realizadas com apenas 1 passageiro. O agrupamento dessas viagens em horários e rotas coincidentes pode gerar economia adicional estimada de até <strong>30%</strong>.
          </p>
        </div>
      </div>

      {/* 5. Two Official Comparison Tables Side by Side (Deduplicated Headers) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>{renderDeduplicatedTable(dailyComparison)}</div>
        <div>{renderDeduplicatedTable(accumulatedComparison)}</div>
      </div>

      {/* 6. Outlier Trips & Top 5 Most Expensive Trips Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-600" />
              Análise de Corridas Atípicas & Outliers de Desembolso
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sinalização automática de viagens acima do limite estatístico (Média + 2σ = {formatBRL(outliersData.threshold)})
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            Custo médio amostral: {formatBRL(outliersData.meanCost)}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2 px-3">Data / Hora</th>
                <th className="py-2 px-3">Passageiro(s)</th>
                <th className="py-2 px-3">Origem ➔ Destino</th>
                <th className="py-2 px-3 text-right">Valor Uber</th>
                <th className="py-2 px-3 text-right">Saving vs Táxi</th>
                <th className="py-2 px-3 text-center">Classificação</th>
                <th className="py-2 px-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {outliersData.top5Expensive.map((trip) => {
                const isOutlier = trip.valueBrl > outliersData.threshold;
                const isExpanded = expandedTripId === trip.id;
                const parts = trip.requestDateLocal.split('-');
                const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : trip.requestDateLocal;

                return (
                  <React.Fragment key={trip.id}>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{displayDate}</div>
                        <div className="text-[11px] text-slate-400">{trip.requestTimeLocal}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 truncate max-w-[150px]">
                          {trip.passengerNames.join(', ')}
                        </div>
                        <div className="text-[11px] text-slate-500">{trip.passengerCount} passageiro(s)</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="truncate font-medium text-slate-800" title={trip.destination}>
                          {trip.destination}
                        </div>
                        <div className="text-[11px] text-slate-400">{trip.distanceKm} km · {trip.durationMin} min</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatBRL(trip.valueBrl)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 whitespace-nowrap">
                        +{formatBRL(trip.saving)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isOutlier ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Outlier (&gt;2σ)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Top Custo
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="text-slate-400 hover:text-slate-700 p-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="py-3 px-4 text-xs">
                          <div className="p-3 bg-white border border-slate-200 rounded space-y-1">
                            <div className="font-bold text-slate-900">Roteiro & Paradas:</div>
                            <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded">
                              {trip.stopInfo || 'Roteiro direto sem paradas intermediárias registradas.'}
                            </div>
                            <div className="text-[11px] text-slate-500 pt-1 flex gap-3">
                              <span><strong>Solicitante:</strong> {trip.bookerName}</span>
                              <span><strong>Custo por passageiro:</strong> {formatBRL(trip.valueBrl / trip.passengerCount)}</span>
                              <span><strong>ID:</strong> {trip.id}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Cortes por Turno, Destino e Centro de Custo */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cortes Operacionais & Distribuição de Saving
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Análise segmentada por turno operacional, principais regiões de destino e centros de custo
            </p>
          </div>

          <div className="inline-flex rounded-md shadow-2xs border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setActiveBreakdownTab('shift')}
              className={`px-3 py-1 text-xs font-semibold rounded ${activeBreakdownTab === 'shift' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Por Turno
            </button>
            <button
              onClick={() => setActiveBreakdownTab('district')}
              className={`px-3 py-1 text-xs font-semibold rounded ${activeBreakdownTab === 'district' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Por Destino / Região
            </button>
            <button
              onClick={() => setActiveBreakdownTab('costCenter')}
              className={`px-3 py-1 text-xs font-semibold rounded ${activeBreakdownTab === 'costCenter' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Por Centro de Custo
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(activeBreakdownTab === 'shift' ? breakdowns.byShift :
            activeBreakdownTab === 'district' ? breakdowns.byDistrict :
            breakdowns.byCostCenter).map((slice) => {
            const maxSaving = Math.max(...(activeBreakdownTab === 'shift' ? breakdowns.byShift :
              activeBreakdownTab === 'district' ? breakdowns.byDistrict :
              breakdowns.byCostCenter).map(s => s.saving), 1);
            const barWidth = Math.max(5, (slice.saving / maxSaving) * 100);

            return (
              <div key={slice.label} className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between font-medium">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{slice.label}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono tabular-nums">{slice.tripCount} viagens</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono tabular-nums">{slice.passengerCount} passageiros</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono tabular-nums">Uber: {formatBRL(slice.uberSpend)}</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-600">
                      +{formatBRL(slice.saving)} ({formatPercent(slice.savingPercent)})
                    </span>
                  </div>
                </div>
                {/* Visual Saving Bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
