import { 
  UberCsvTripRecord, 
  GoogleSheetsConfig, 
  ExecutiveBoardComparison, 
  DailySavingRecord,
  ContractTariffPeriod,
  TariffAuditLog,
  TaxiScenario,
  SavingTargetConfig,
  PeriodFilter,
  BreakdownSlice
} from '../types/mobility';
import { CsvParserService } from './csvParserService';

const LOCAL_STORAGE_UBER_TRIPS = 'mobility_uber_trips_data_v3';
const LOCAL_STORAGE_SHEETS_CONFIG = 'mobility_sheets_config_v3';
const LOCAL_STORAGE_TARIFF_PERIODS = 'mobility_tariff_periods_v3';
const LOCAL_STORAGE_AUDIT_LOGS = 'mobility_audit_logs_v3';
const LOCAL_STORAGE_ACTIVE_SCENARIO = 'mobility_active_scenario_v3';
const LOCAL_STORAGE_SAVING_TARGET = 'mobility_saving_target_v3';
const LOCAL_STORAGE_PERIOD_FILTER = 'mobility_period_filter_v3';

export const DEFAULT_TARIFF_PERIODS: ContractTariffPeriod[] = [
  {
    id: 'tariff-2026-v1',
    rate: 146.06,
    startDate: '2026-01-01',
    contractSource: 'Contrato Fornecedor Táxi GRU nº 2025/11 - Cláusula 4.1',
    notes: 'Valor tabelado fixo contratual por pedido de atendimento avulso',
  }
];

export const DEFAULT_AUDIT_LOGS: TariffAuditLog[] = [
  {
    id: 'audit-init-01',
    timestamp: '21/10/2026 00:00',
    author: 'Ivo Emmanuel Firmino de Lima',
    previousValue: 0,
    newValue: 146.06,
    reason: 'Tarifa contratual de referência pactuada para apuração de saving Uber Central',
  }
];

export const DEFAULT_SAVING_TARGET: SavingTargetConfig = {
  targetType: 'value',
  targetValue: 6000,
  month: '2026-10',
};

export class SheetsService {
  private static trips: UberCsvTripRecord[] = [];
  private static rawCsvCache: string = '';
  private static tariffPeriods: ContractTariffPeriod[] = [];
  private static auditLogs: TariffAuditLog[] = [];
  private static activeScenario: TaxiScenario = 1.0;
  private static savingTarget: SavingTargetConfig = DEFAULT_SAVING_TARGET;
  private static periodFilter: PeriodFilter = 'all';
  private static customDateRange: { start: string; end: string } = { start: '', end: '' };

  private static config: GoogleSheetsConfig = {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_SavingTransporteAvulso/pub?output=csv',
    lastSyncedAt: '22/10/2026 às 11:38',
    status: 'synced',
    autoSyncIntervalMinutes: 15,
    taxiReferenceRate: 146.06,
  };

  // ==========================================
  // Gestão das Vigências da Tarifa Contratual
  // ==========================================

  public static getTariffPeriods(): ContractTariffPeriod[] {
    if (this.tariffPeriods.length > 0) return this.tariffPeriods;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_TARIFF_PERIODS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tariffPeriods = parsed;
          return this.tariffPeriods;
        }
      }
    } catch {
      // fallback
    }
    this.tariffPeriods = [...DEFAULT_TARIFF_PERIODS];
    this.saveTariffPeriods();
    return this.tariffPeriods;
  }

  public static saveTariffPeriods(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_TARIFF_PERIODS, JSON.stringify(this.tariffPeriods));
    } catch {
      // storage unavailable
    }
  }

  public static getCurrentReferenceRate(): number {
    const periods = this.getTariffPeriods();
    return periods[periods.length - 1]?.rate || 146.06;
  }

  // ==========================================
  // Log de Auditoria de Tarifas
  // ==========================================

  public static getAuditLogs(): TariffAuditLog[] {
    if (this.auditLogs.length > 0) return this.auditLogs;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_AUDIT_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.auditLogs = parsed;
          return this.auditLogs;
        }
      }
    } catch {
      // fallback
    }
    this.auditLogs = [...DEFAULT_AUDIT_LOGS];
    this.saveAuditLogs();
    return this.auditLogs;
  }

  public static saveAuditLogs(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS, JSON.stringify(this.auditLogs));
    } catch {
      // storage unavailable
    }
  }

  /**
   * Adiciona ou atualiza vigência de tarifa com auditoria obrigatória
   */
  public static addTariffPeriodWithAudit(params: {
    rate: number;
    startDate: string;
    endDate?: string;
    contractSource: string;
    notes?: string;
    author: string;
    reason: string;
  }): void {
    const periods = this.getTariffPeriods();
    const previousRate = this.getCurrentReferenceRate();

    const newPeriod: ContractTariffPeriod = {
      id: `tariff-${Date.now()}`,
      rate: params.rate,
      startDate: params.startDate,
      endDate: params.endDate,
      contractSource: params.contractSource,
      notes: params.notes,
    };

    this.tariffPeriods = [...periods, newPeriod];
    this.saveTariffPeriods();

    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const auditEntry: TariffAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp,
      author: params.author.trim() || 'Gestor de Mobilidade',
      previousValue: previousRate,
      newValue: params.rate,
      reason: params.reason.trim(),
    };

    this.auditLogs = [auditEntry, ...this.getAuditLogs()];
    this.saveAuditLogs();

    // Recalcula todas as corridas com a nova vigência
    this.reprocessTrips();
  }

  // ==========================================
  // Cenário Conservador do Táxi (100%, 80%, 70%, 50%)
  // ==========================================

  public static getActiveScenario(): TaxiScenario {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SCENARIO);
      if (stored) {
        const val = parseFloat(stored);
        if ([1.0, 0.8, 0.7, 0.5].includes(val)) {
          this.activeScenario = val as TaxiScenario;
          return this.activeScenario;
        }
      }
    } catch {
      // fallback
    }
    return this.activeScenario;
  }

  public static setActiveScenario(scenario: TaxiScenario): void {
    this.activeScenario = scenario;
    try {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_SCENARIO, scenario.toString());
    } catch {
      // storage unavailable
    }
    this.reprocessTrips();
  }

  // ==========================================
  // Meta de Saving Mensal
  // ==========================================

  public static getSavingTarget(): SavingTargetConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVING_TARGET);
      if (stored) {
        this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...JSON.parse(stored) };
        return this.savingTarget;
      }
    } catch {
      // fallback
    }
    return this.savingTarget;
  }

  public static setSavingTarget(target: SavingTargetConfig): void {
    this.savingTarget = target;
    try {
      localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(target));
    } catch {
      // storage unavailable
    }
  }

  // ==========================================
  // Filtro de Período Global
  // ==========================================

  public static getPeriodFilter(): PeriodFilter {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PERIOD_FILTER);
      if (stored && ['all', 'today', 'week', 'month', 'custom'].includes(stored)) {
        this.periodFilter = stored as PeriodFilter;
        return this.periodFilter;
      }
    } catch {
      // fallback
    }
    return this.periodFilter;
  }

  public static setPeriodFilter(filter: PeriodFilter, customRange?: { start: string; end: string }): void {
    this.periodFilter = filter;
    if (customRange) {
      this.customDateRange = customRange;
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_PERIOD_FILTER, filter);
    } catch {
      // storage unavailable
    }
  }

  public static getCustomDateRange() {
    return this.customDateRange;
  }

  // ==========================================
  // Trips & Sincronização
  // ==========================================

  public static getConfig(): GoogleSheetsConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SHEETS_CONFIG);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    this.config.taxiReferenceRate = this.getCurrentReferenceRate();
    return this.config;
  }

  public static saveConfig(cfg: Partial<GoogleSheetsConfig>): void {
    this.config = { ...this.config, ...cfg };
    try {
      localStorage.setItem(LOCAL_STORAGE_SHEETS_CONFIG, JSON.stringify(this.config));
    } catch {
      // fallback
    }
  }

  public static getTrips(): UberCsvTripRecord[] {
    if (this.trips.length > 0) return this.trips;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_UBER_TRIPS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.trips = parsed;
          return this.trips;
        }
      }
    } catch {
      // fallback
    }
    return this.trips;
  }

  public static saveTrips(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_UBER_TRIPS, JSON.stringify(this.trips));
    } catch {
      // fallback
    }
  }

  public static reprocessTrips(): void {
    if (this.rawCsvCache) {
      const periods = this.getTariffPeriods();
      const scenario = this.getActiveScenario();
      const parsed = CsvParserService.parseUberCsv(this.rawCsvCache, periods, scenario);
      if (parsed.length > 0) {
        this.trips = parsed;
        this.saveTrips();
        return;
      }
    }

    // Se não tem rawCsvCache, recalcula os existentes
    const periods = this.getTariffPeriods();
    const scenario = this.getActiveScenario();
    this.trips = this.trips.map(t => {
      const { rate: nominalRate } = CsvParserService.findTariffForDate(t.requestDateLocal, periods);
      const effectiveTaxiRate = Math.round((nominalRate * scenario) * 100) / 100;
      const saving = Math.round((effectiveTaxiRate - t.valueBrl) * 100) / 100;
      const savingPercent = effectiveTaxiRate > 0 ? Math.round((saving / effectiveTaxiRate) * 1000) / 10 : 0;

      return {
        ...t,
        taxiReferenceCost: effectiveTaxiRate,
        nominalTaxiRate: nominalRate,
        saving,
        savingPercent,
      };
    });
    this.saveTrips();
  }

  public static async loadInitialData(): Promise<UberCsvTripRecord[]> {
    const existing = this.getTrips();
    if (existing.length >= 50) {
      return existing;
    }

    try {
      const response = await fetch('/assets/aistudio/SavingTransporteAvulso_-_Dados_Uber_fb6e558e.csv');
      if (response.ok) {
        const text = await response.text();
        this.rawCsvCache = text;
        const periods = this.getTariffPeriods();
        const scenario = this.getActiveScenario();
        const parsed = CsvParserService.parseUberCsv(text, periods, scenario);
        if (parsed.length > 0) {
          this.trips = parsed;
          this.saveTrips();
          return this.trips;
        }
      }
    } catch {
      // fallback
    }

    return this.trips;
  }

  public static async syncFromGoogleSheets(urlInput: string): Promise<{ success: boolean; count: number; error?: string }> {
    const directUrl = urlInput.trim();
    this.saveConfig({ sheetUrl: urlInput, status: 'syncing' });

    try {
      let csvContent = '';
      try {
        const proxyRes = await fetch('/api/mobility/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: directUrl })
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          csvContent = proxyData.csv;
        }
      } catch {
        // tenta direto
      }

      if (!csvContent) {
        const directRes = await fetch(directUrl);
        if (!directRes.ok) {
          throw new Error(`Falha ao obter planilha: status HTTP ${directRes.status}`);
        }
        csvContent = await directRes.text();
      }

      this.rawCsvCache = csvContent;
      const periods = this.getTariffPeriods();
      const scenario = this.getActiveScenario();
      const parsed = CsvParserService.parseUberCsv(csvContent, periods, scenario);

      if (parsed.length === 0) {
        throw new Error('Nenhum registro válido encontrado na planilha.');
      }

      this.trips = parsed;
      this.saveTrips();

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      this.saveConfig({
        status: 'synced',
        lastSyncedAt: timestamp,
        errorMessage: undefined,
      });

      return { success: true, count: parsed.length };
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao sincronizar com Google Sheets.';
      this.saveConfig({ status: 'error', errorMessage: errorMsg });
      return { success: false, count: 0, error: errorMsg };
    }
  }

  public static importFromCsvText(csvText: string): { success: boolean; count: number; error?: string } {
    try {
      this.rawCsvCache = csvText;
      const periods = this.getTariffPeriods();
      const scenario = this.getActiveScenario();
      const parsed = CsvParserService.parseUberCsv(csvText, periods, scenario);
      if (parsed.length === 0) {
        return { success: false, count: 0, error: 'O arquivo não continha registros válidos.' };
      }

      this.trips = parsed;
      this.saveTrips();

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.saveConfig({ status: 'synced', lastSyncedAt: timestamp });

      return { success: true, count: parsed.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Erro ao processar arquivo CSV.' };
    }
  }

  /**
   * Filtra viagens de acordo com o filtro de período ativo
   */
  public static filterTripsByPeriod(trips: UberCsvTripRecord[]): { filtered: UberCsvTripRecord[]; label: string } {
    const filter = this.getPeriodFilter();
    if (filter === 'all' || trips.length === 0) {
      return { filtered: trips, label: 'Todo o Período' };
    }

    const sortedDates = Array.from(new Set(trips.map(t => t.requestDateLocal).filter(Boolean))).sort();
    const latestDate = sortedDates[sortedDates.length - 1] || '2026-10-22';

    if (filter === 'today') {
      const filtered = trips.filter(t => t.requestDateLocal === latestDate);
      const parts = latestDate.split('-');
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : latestDate;
      return { filtered, label: `Dia mais recente (${formatted})` };
    }

    if (filter === 'week') {
      // Últimos 7 dias em relação à data mais recente
      const cutoff = new Date(latestDate);
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const filtered = trips.filter(t => t.requestDateLocal >= cutoffStr && t.requestDateLocal <= latestDate);
      return { filtered, label: 'Últimos 7 dias' };
    }

    if (filter === 'month') {
      const targetMonth = latestDate.substring(0, 7); // YYYY-MM
      const filtered = trips.filter(t => t.requestDateLocal.startsWith(targetMonth));
      const parts = targetMonth.split('-');
      return { filtered, label: `Mês de ${parts[1]}/${parts[0]}` };
    }

    if (filter === 'custom' && this.customDateRange.start && this.customDateRange.end) {
      const filtered = trips.filter(t => 
        t.requestDateLocal >= this.customDateRange.start && 
        t.requestDateLocal <= this.customDateRange.end
      );
      return { 
        filtered, 
        label: `${this.customDateRange.start} até ${this.customDateRange.end}` 
      };
    }

    return { filtered: trips, label: 'Todo o Período' };
  }

  /**
   * Identifica as top 5 corridas mais caras e outliers
   */
  public static getOutlierTrips(trips: UberCsvTripRecord[]): {
    top5Expensive: UberCsvTripRecord[];
    outliers: UberCsvTripRecord[];
    meanCost: number;
    threshold: number;
  } {
    if (trips.length === 0) {
      return { top5Expensive: [], outliers: [], meanCost: 0, threshold: 0 };
    }

    const sortedByCost = [...trips].sort((a, b) => b.valueBrl - a.valueBrl);
    const top5Expensive = sortedByCost.slice(0, 5);

    const meanCost = trips.reduce((acc, t) => acc + t.valueBrl, 0) / trips.length;
    const variance = trips.reduce((acc, t) => acc + Math.pow(t.valueBrl - meanCost, 2), 0) / trips.length;
    const stdDev = Math.sqrt(variance);
    const threshold = meanCost + 2 * stdDev;

    const outliers = trips.filter(t => t.valueBrl > threshold);

    return {
      top5Expensive,
      outliers,
      meanCost: Math.round(meanCost * 100) / 100,
      threshold: Math.round(threshold * 100) / 100,
    };
  }

  /**
   * Gera cortes por Turno, Destino e Centro de Custo
   */
  public static getBreakdowns(trips: UberCsvTripRecord[]) {
    return {
      byShift: CsvParserService.calculateBreakdown(trips, 'shift'),
      byDistrict: CsvParserService.calculateBreakdown(trips, 'destinationDistrict'),
      byCostCenter: CsvParserService.calculateBreakdown(trips, 'costCenter'),
    };
  }

  /**
   * Gera o relatório oficial executivo da aba Resumo
   */
  public static getBoardReports(selectedDate = '2026-10-22'): {
    dailyComparison: ExecutiveBoardComparison;
    accumulatedComparison: ExecutiveBoardComparison;
    allTrips: UberCsvTripRecord[];
    periodTrips: UberCsvTripRecord[];
    availableDates: string[];
    dailyRecords: DailySavingRecord[];
    activeScenario: TaxiScenario;
    nominalRate: number;
    scenarioRate: number;
    periodFilterLabel: string;
    outliersData: ReturnType<typeof SheetsService.getOutlierTrips>;
    breakdowns: ReturnType<typeof SheetsService.getBreakdowns>;
    targetConfig: SavingTargetConfig;
  } {
    const allTrips = this.getTrips();
    const nominalRate = this.getCurrentReferenceRate();
    const scenario = this.getActiveScenario();
    const scenarioRate = Math.round((nominalRate * scenario) * 100) / 100;

    // Datas disponíveis
    const datesSet = new Set<string>();
    allTrips.forEach(t => {
      if (t.requestDateLocal) datesSet.add(t.requestDateLocal);
    });
    const availableDates = Array.from(datesSet).sort();
    const activeDate = datesSet.has(selectedDate) ? selectedDate : (availableDates[availableDates.length - 1] || '2026-10-22');

    // Trips do dia selecionado
    const dayTrips = allTrips.filter(t => t.requestDateLocal === activeDate);
    const dayParts = activeDate.split('-');
    const dayFormatted = dayParts.length === 3 ? `${dayParts[2]}/${dayParts[1]}/${dayParts[0]}` : activeDate;

    const dailyComparison = CsvParserService.calculateBoardIndicators(
      dayTrips,
      nominalRate,
      scenario,
      `Indicadores comparativos — Táxi x Uber | ${dayFormatted}`,
      `Dia ${dayFormatted}`
    );

    // Trips filtradas pelo período global
    const { filtered: periodTrips, label: periodFilterLabel } = this.filterTripsByPeriod(allTrips);

    const accTitle = availableDates.length > 1
      ? `Acumulado — ${availableDates.map(d => d.split('-')[2] + '/' + d.split('-')[1]).join(' e ')}`
      : `Acumulado — Período Completo`;

    const accumulatedComparison = CsvParserService.calculateBoardIndicators(
      periodTrips,
      nominalRate,
      scenario,
      accTitle,
      periodFilterLabel
    );

    const dailyRecords = CsvParserService.calculateDailyRecords(periodTrips);
    const outliersData = this.getOutlierTrips(periodTrips);
    const breakdowns = this.getBreakdowns(periodTrips);
    const targetConfig = this.getSavingTarget();

    return {
      dailyComparison,
      accumulatedComparison,
      allTrips,
      periodTrips,
      availableDates,
      dailyRecords,
      activeScenario: scenario,
      nominalRate,
      scenarioRate,
      periodFilterLabel,
      outliersData,
      breakdowns,
      targetConfig,
    };
  }
}
