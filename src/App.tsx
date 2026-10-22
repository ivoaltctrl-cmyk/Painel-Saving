import React, { useState, useEffect, useCallback } from 'react';
import { Header, DashboardTab } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ExecutiveReportView } from './components/ExecutiveReportView';
import { DailySavingChart } from './components/DailySavingChart';
import { TripsTable } from './components/TripsTable';
import { RealTimeQuoteTool } from './components/RealTimeQuoteTool';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { ApiIntegrationPanel } from './components/ApiIntegrationPanel';
import { ScenarioEfficiencyMatrix } from './components/ScenarioEfficiencyMatrix';
import { SheetsService } from './services/sheetsService';
import { ExecutiveBoardComparison, UberCsvTripRecord, DailySavingRecord } from './types/mobility';
import { FileSpreadsheet, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('board');
  const [trips, setTrips] = useState<UberCsvTripRecord[]>([]);
  const [dailyComparison, setDailyComparison] = useState<ExecutiveBoardComparison | null>(null);
  const [accumulatedComparison, setAccumulatedComparison] = useState<ExecutiveBoardComparison | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailySavingRecord[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-22');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('11:38');
  const [taxiReferenceRate, setTaxiReferenceRate] = useState<number>(146.06);

  const refreshData = useCallback(() => {
    const reportData = SheetsService.getBoardReports(selectedDate);
    setTrips(reportData.allTrips);
    setDailyComparison(reportData.dailyComparison);
    setAccumulatedComparison(reportData.accumulatedComparison);
    setDailyRecords(reportData.dailyRecords);
    setAvailableDates(reportData.availableDates);
    setTaxiReferenceRate(SheetsService.getTaxiReferenceRate());

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
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 600);
    }
  };

  if (!dailyComparison || !accumulatedComparison) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-mono text-xs">
        Carregando base de transporte e cálculo do saving...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onSyncApi={handleSyncClick}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Context Strip & Connected Sheet Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">Operação Aeroporto Guarulhos (GRU)</span>
            <span aria-hidden="true">/</span>
            <span>Transporte de Colaboradores</span>
            <span aria-hidden="true">/</span>
            <span className="text-slate-900 font-medium">Uber Central vs Táxi Avulso</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Base Google Sheets Conectada ({trips.length} corridas)</span>
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              Ref. Táxi: R$ {taxiReferenceRate.toFixed(2)}/pedido
            </span>
          </div>
        </div>

        {/* Global Financial Metrics Bar */}
        <MetricCards comparison={accumulatedComparison} />

        {/* Tab 1: Envio à Diretoria (Visão Oficial) */}
        {activeTab === 'board' && (
          <div className="space-y-6">
            <ExecutiveReportView
              dailyComparison={dailyComparison}
              accumulatedComparison={accumulatedComparison}
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
              }}
              onDataRefresh={refreshData}
            />

            {/* Quick Chart Strip Below the Board Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8">
                <DailySavingChart dailyRecords={dailyRecords} />
              </div>
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                      Resumo da Migração
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="space-y-2 mt-3 text-xs leading-relaxed text-slate-600">
                    <p>
                      A transição do modelo tradicional de táxi avulso para <strong>Uber Central com múltiplas paradas</strong> permitiu transportar <strong>{accumulatedComparison.uber.totalPassengers} colaboradores</strong> com um desembolso médio de apenas <strong>R$ {accumulatedComparison.uber.avgCostPerPassenger.toFixed(2)} por passageiro</strong> (contra R$ {accumulatedComparison.taxi.avgCostPerPassenger.toFixed(2)} no táxi).
                    </p>
                    <div className="pt-2 font-bold text-slate-900 flex justify-between border-t border-slate-100">
                      <span>Economia Total Acumulada:</span>
                      <span className="text-emerald-600 font-mono tabular-nums font-extrabold text-sm">
                        +R$ {(accumulatedComparison.taxi.totalCost - accumulatedComparison.uber.totalCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('trips')}
                    className="mt-4 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Ver as {trips.length} Corridas Detalhadas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Evolução do Saving & Gráficos */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <DailySavingChart dailyRecords={dailyRecords} />
            <ScenarioEfficiencyMatrix />
          </div>
        )}

        {/* Tab 3: Base de Corridas Uber Central */}
        {activeTab === 'trips' && (
          <div className="space-y-6">
            <TripsTable
              trips={trips}
              onOpenSyncModal={() => setIsSyncModalOpen(true)}
              taxiReferenceRate={taxiReferenceRate}
            />
          </div>
        )}

        {/* Tab 4: Cotação em Tempo Real */}
        {activeTab === 'quote' && (
          <div className="space-y-6">
            <RealTimeQuoteTool onTripLogged={refreshData} />
          </div>
        )}

        {/* Tab 5: Conexão Google Sheets */}
        {activeTab === 'sheets' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Integração com Google Sheets (Base Oficial)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Conexão aberta com a planilha Google Sheets para atualização contínua e avaliação de colunas
                  </p>
                </div>
                <button
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                >
                  Abrir Conector
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block mb-1">Status da Conexão</span>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Conectado e Sincronizado</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    56 atendimentos carregados em memória
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block mb-1">Custo de Referência Táxi</span>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    R$ {taxiReferenceRate.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Valor contratual por atendimento avulso
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block mb-1">Colaboradores Transportados</span>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {accumulatedComparison.uber.totalPassengers} passageiros
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Calculados via paradas múltiplas da base
                  </span>
                </div>
              </div>
            </div>
            <TripsTable
              trips={trips}
              onOpenSyncModal={() => setIsSyncModalOpen(true)}
              taxiReferenceRate={taxiReferenceRate}
            />
          </div>
        )}

        {/* Tab 6: API REST */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <ApiIntegrationPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">MobilitySaving</span>
            <span aria-hidden="true">·</span>
            <span>Processo Uber Central vs Táxi Avulso — Acompanhamento Financeiro</span>
          </div>
          <div>
            <span>Referência: R$ 146,06 por pedido de táxi · Economia de 61,5%</span>
          </div>
        </div>
      </footer>

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncCompleted={refreshData}
      />
    </div>
  );
}
