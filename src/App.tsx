import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header, DashboardTab } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ExecutiveReportView } from './components/ExecutiveReportView';
import { DailySavingChart } from './components/DailySavingChart';
import { TripsTable } from './components/TripsTable';
import { ApiIntegrationPanel } from './components/ApiIntegrationPanel';
import { TariffManagementModal } from './components/TariffManagementModal';
import { SheetsService } from './services/sheetsService';
import { 
  ExecutiveBoardComparison, 
  UberCsvTripRecord, 
  DailySavingRecord, 
  PeriodFilter,
  TaxiScenario,
  SavingTargetConfig,
  BreakdownSlice
} from './types/mobility';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumo');
  const [trips, setTrips] = useState<UberCsvTripRecord[]>([]);
  const [periodTrips, setPeriodTrips] = useState<UberCsvTripRecord[]>([]);
  const [dailyComparison, setDailyComparison] = useState<ExecutiveBoardComparison | null>(null);
  const [accumulatedComparison, setAccumulatedComparison] = useState<ExecutiveBoardComparison | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailySavingRecord[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-22');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('22/10/2026 às 11:38');
  const [taxiReferenceRate, setTaxiReferenceRate] = useState<number>(146.06);
  const [activeScenario, setActiveScenario] = useState<TaxiScenario>(1.0);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [periodFilterLabel, setPeriodFilterLabel] = useState<string>('Todo o Período');
  const [outliersData, setOutliersData] = useState<{
    top5Expensive: UberCsvTripRecord[];
    outliers: UberCsvTripRecord[];
    meanCost: number;
    threshold: number;
  }>({ top5Expensive: [], outliers: [], meanCost: 0, threshold: 0 });
  const [breakdowns, setBreakdowns] = useState<{
    byShift: BreakdownSlice[];
    byDistrict: BreakdownSlice[];
    byCostCenter: BreakdownSlice[];
  }>({ byShift: [], byDistrict: [], byCostCenter: [] });
  const [targetConfig, setTargetConfig] = useState<SavingTargetConfig>({
    targetType: 'value',
    targetValue: 6000,
    month: '2026-10',
  });
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const refreshData = useCallback(() => {
    const reportData = SheetsService.getBoardReports(selectedDate);
    setTrips(reportData.allTrips);
    setPeriodTrips(reportData.periodTrips);
    setDailyComparison(reportData.dailyComparison);
    setAccumulatedComparison(reportData.accumulatedComparison);
    setDailyRecords(reportData.dailyRecords);
    setAvailableDates(reportData.availableDates);
    setTaxiReferenceRate(reportData.nominalRate);
    setActiveScenario(reportData.activeScenario);
    setPeriodFilter(SheetsService.getPeriodFilter());
    setPeriodFilterLabel(reportData.periodFilterLabel);
    setOutliersData(reportData.outliersData);
    setBreakdowns(reportData.breakdowns);
    setTargetConfig(reportData.targetConfig);

    const cfg = SheetsService.getConfig();
    setLastSyncTime(cfg.lastSyncedAt);
  }, [selectedDate]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await SheetsService.loadInitialData();
      refreshData();
    };
    init();
  }, [refreshData]);

  const handlePeriodFilterChange = (filter: PeriodFilter, customRange?: { start: string; end: string }) => {
    SheetsService.setPeriodFilter(filter, customRange);
    refreshData();
  };

  // Handle manual sync button click in header
  const handleSyncClick = async () => {
    setIsSyncing(true);
    try {
      const cfg = SheetsService.getConfig();
      if (cfg.sheetUrl) {
        await SheetsService.syncFromGoogleSheets(cfg.sheetUrl);
      } else {
        await SheetsService.loadInitialData();
      }
      refreshData();
      setGlobalNotice('Dados recarregados e reprocessados com sucesso!');
      setTimeout(() => setGlobalNotice(null), 3500);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 600);
    }
  };

  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = SheetsService.importFromCsvText(content);
        if (res.success) {
          setGlobalNotice(`Planilha atualizada com sucesso! ${res.count} atendimentos processados.`);
          refreshData();
          setTimeout(() => setGlobalNotice(null), 4000);
        } else {
          alert(res.error || 'Erro ao processar arquivo CSV.');
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  if (!dailyComparison || !accumulatedComparison) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-mono text-xs">
        Carregando base de transporte e cálculo do saving...
      </div>
    );
  }

  const effectiveTaxiRate = taxiReferenceRate * activeScenario;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Hidden file input for header upload button */}
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleGlobalFileUpload}
        className="hidden"
      />

      {/* Top Bar Navigation (Clean, no horizontal scrollbars) */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onUploadCsv={() => fileInputRef.current?.click()}
        onSyncApi={handleSyncClick}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Global notification if active */}
        {globalNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{globalNotice}</span>
          </div>
        )}

        {/* Context Strip with Brazilian Formatting */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">Operação Aeroporto Guarulhos (GRU)</span>
            <span aria-hidden="true">/</span>
            <span>Transporte de Colaboradores</span>
            <span aria-hidden="true">/</span>
            <span className="text-slate-900 font-medium">Uber Central vs Táxi Avulso</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span>Base total: <strong>{trips.length} atendimentos</strong></span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-600">
              Ref. Táxi: {formatBRL(effectiveTaxiRate)}/pedido ({Math.round(activeScenario * 100)}% do contrato)
            </span>
          </div>
        </div>

        {/* Global Financial Metrics Cards */}
        <MetricCards comparison={accumulatedComparison} />

        {/* Tab 1: Resumo Executivo */}
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            <ExecutiveReportView
              dailyComparison={dailyComparison}
              accumulatedComparison={accumulatedComparison}
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
              onDataRefresh={refreshData}
              onOpenTariffModal={() => setIsTariffModalOpen(true)}
              lastSyncTime={lastSyncTime}
              periodFilter={periodFilter}
              onPeriodFilterChange={handlePeriodFilterChange}
              periodFilterLabel={periodFilterLabel}
              outliersData={outliersData}
              breakdowns={breakdowns}
              targetConfig={targetConfig}
            />

            {/* Quick Chart Strip Below the Resumo Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8">
                <DailySavingChart dailyRecords={dailyRecords} allTrips={periodTrips} />
              </div>
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                      Resumo da Operação
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="space-y-2 mt-3 text-xs leading-relaxed text-slate-600">
                    <p>
                      A transição do táxi avulso para <strong>Uber Central com múltiplas paradas</strong> permitiu transportar <strong>{accumulatedComparison.uber.totalPassengers} colaboradores</strong> com um desembolso médio de <strong>{formatBRL(accumulatedComparison.uber.avgCostPerPassenger)} por passageiro</strong> (contra {formatBRL(accumulatedComparison.taxi.avgCostPerPassenger)} no táxi).
                    </p>
                    <div className="pt-2 font-bold text-slate-900 flex justify-between border-t border-slate-100">
                      <span>Economia Acumulada:</span>
                      <span className="text-emerald-600 font-mono tabular-nums font-extrabold text-sm">
                        +{formatBRL(accumulatedComparison.taxi.totalCost - accumulatedComparison.uber.totalCost)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('corridas')}
                    className="mt-4 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Ver as {trips.length} Corridas na Base</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Evolução Diária */}
        {activeTab === 'evolucao' && (
          <div className="space-y-6">
            <DailySavingChart dailyRecords={dailyRecords} allTrips={periodTrips} />
          </div>
        )}

        {/* Tab 3: Base de Corridas */}
        {activeTab === 'corridas' && (
          <div className="space-y-6">
            <TripsTable
              trips={trips}
              onDataRefresh={refreshData}
              taxiReferenceRate={effectiveTaxiRate}
            />
          </div>
        )}

        {/* Tab 4: API REST */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <ApiIntegrationPanel />
          </div>
        )}
      </main>

      {/* Modal de Gestão de Tarifas e Vigências com Auditoria */}
      <TariffManagementModal
        isOpen={isTariffModalOpen}
        onClose={() => setIsTariffModalOpen(false)}
        onTariffUpdated={refreshData}
      />

      {/* Footer com Formatação Brasileira Rigorosa */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">MobilitySaving</span>
            <span aria-hidden="true">·</span>
            <span>Processo Uber Central vs Táxi Avulso — Acompanhamento Financeiro</span>
          </div>
          <div>
            <span>Referência: {formatBRL(effectiveTaxiRate)} por pedido de táxi ({Math.round(activeScenario * 100)}% contratual) · Economia de {formatPercent(accumulatedComparison.uber.costReductionPercent)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
