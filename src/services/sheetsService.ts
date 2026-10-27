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

const LOCAL_STORAGE_SHEETS_CONFIG = 'mobility_sheets_config_v4';
const LOCAL_STORAGE_PERIOD_FILTER = 'mobility_period_filter_v4';

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
  targetValue: 100000,
  month: '2026-10',
  updatedBy: 'Planilha Google Sheets (Aba Config)',
};

// Back-end oficial: Google Sheets via Apps Script (Web App). Definir VITE_SHEETS_API_URL no build.
const SHEETS_API_URL: string = (import.meta as any).env?.VITE_SHEETS_API_URL || '';
const POLL_MS = 30000;
// Caches antigos de corridas/meta que ficavam salvos em cada navegador (causavam dados divergentes)
const STALE_LOCAL_KEYS = ['mobility_uber_trips_data_v4', 'mobility_saving_target_v4', 'mobility_tariff_periods_v4', 'mobility_audit_logs_v4', 'mobility_active_scenario_v4'];

interface SheetPayload {
  meta: number | null;
  type: 'value' | 'percent';
  csv: string;
  scenario: number | null;
  tariffPeriods: ContractTariffPeriod[] | null;
  auditLogs: TariffAuditLog[] | null;
}

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
    sheetUrl: '',
    lastSyncedAt: '—',
    status: 'idle',
    autoSyncIntervalMinutes: 15,
    taxiReferenceRate: 146.06,
  };

  // ==========================================
  // Gestão das Vigências da Tarifa Contratual
  // ==========================================

  /** Tarifas e auditoria vêm da aba Config da planilha (sem cache local). */
  public static getTariffPeriods(): ContractTariffPeriod[] {
    if (this.tariffPeriods.length === 0) this.tariffPeriods = [...DEFAULT_TARIFF_PERIODS];
    return this.tariffPeriods;
  }

  public static saveTariffPeriods(): void {
    // intencionalmente vazio: a gravação é feita por pushConfig
  }

  public static getCurrentReferenceRate(): number {
    const periods = this.getTariffPeriods();
    return periods[periods.length - 1]?.rate || 146.06;
  }

  // ==========================================
  // Log de Auditoria de Tarifas
  // ==========================================

  public static getAuditLogs(): TariffAuditLog[] {
    if (this.auditLogs.length === 0) this.auditLogs = [...DEFAULT_AUDIT_LOGS];
    return this.auditLogs;
  }

  public static saveAuditLogs(): void {
    // intencionalmente vazio: a gravação é feita por pushConfig
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
    this.pushConfig({ tariffPeriods: this.tariffPeriods, auditLogs: this.auditLogs });
  }

  // ==========================================
  // Cenário Conservador do Táxi (100%, 80%, 70%, 50%)
  // ==========================================

  public static getActiveScenario(): TaxiScenario {
    return this.activeScenario;
  }

  public static setActiveScenario(scenario: TaxiScenario): void {
    this.activeScenario = scenario;
    this.reprocessTrips();
    this.pushConfig({ scenario });
  }

  // ==========================================
  // Meta de Saving Mensal (Sincronizada Globalmente em Tempo Real)
  // ==========================================

  private static targetListeners: Set<(target: SavingTargetConfig) => void> = new Set();
  private static targetSyncStarted = false;

  public static subscribeTarget(listener: (target: SavingTargetConfig) => void): () => void {
    this.targetListeners.add(listener);
    // Dispara imediatamente com o valor atual em cache ou memória
    listener(this.getSavingTarget());
    this.startTargetSync();

    return () => {
      this.targetListeners.delete(listener);
    };
  }

  private static notifyTargetListeners(target: SavingTargetConfig): void {
    this.targetListeners.forEach(listener => {
      try {
        listener(target);
      } catch (err) {
        console.error('[SheetsService] Erro no listener de meta:', err);
      }
    });
  }

  private static dataListeners: Set<() => void> = new Set();
  private static syncTimer: ReturnType<typeof setInterval> | null = null;
  private static inflight: Promise<SheetPayload> | null = null;

  public static subscribeData(listener: () => void): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  /** Uma única chamada ao Apps Script devolve meta + corridas (evita requisições duplicadas). */
  private static fetchAll() {
    if (!SHEETS_API_URL) {
      return Promise.reject(new Error('VITE_SHEETS_API_URL não configurada (URL do Web App do Apps Script).'));
    }
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const res = await fetch(`${SHEETS_API_URL}?action=all&_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Planilha respondeu HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Erro no Apps Script');
        const meta = Number(data.meta);
        return {
          meta: meta > 0 ? meta : null,
          type: (data.targetType === 'percent' ? 'percent' : 'value') as 'value' | 'percent',
          csv: String(data.csv || ''),
          scenario: Number(data.scenario) || null,
          tariffPeriods: Array.isArray(data.tariffPeriods) && data.tariffPeriods.length > 0 ? data.tariffPeriods : null,
          auditLogs: Array.isArray(data.auditLogs) && data.auditLogs.length > 0 ? data.auditLogs : null
        };
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  private static applyMeta(meta: number | null, type: 'value' | 'percent'): void {
    if (!meta) return;
    const changed = this.savingTarget.targetValue !== meta || this.savingTarget.targetType !== type;
    this.savingTarget = {
      ...this.savingTarget,
      targetType: type,
      targetValue: meta,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Planilha Google Sheets (Aba Config)'
    };
    if (changed) this.notifyTargetListeners(this.savingTarget);
  }

  /** Aplica cenário, tarifas e auditoria vindos da planilha. Devolve true se algo que afeta o cálculo mudou. */
  private static applyExtras(
    scenario: number | null,
    tariffs: ContractTariffPeriod[] | null,
    audits: TariffAuditLog[] | null
  ): boolean {
    let changed = false;
    if (scenario && [1, 0.8, 0.7, 0.5].includes(scenario) && scenario !== this.activeScenario) {
      this.activeScenario = scenario as TaxiScenario;
      changed = true;
    }
    if (tariffs && JSON.stringify(tariffs) !== JSON.stringify(this.tariffPeriods)) {
      this.tariffPeriods = tariffs;
      changed = true;
    }
    if (audits && JSON.stringify(audits) !== JSON.stringify(this.auditLogs)) {
      this.auditLogs = audits;
    }
    return changed;
  }

  /** Grava cenário/tarifas/auditoria na aba Config (todos os aparelhos leem de lá). */
  private static pushConfig(payload: Record<string, unknown>): void {
    if (!SHEETS_API_URL) return;
    fetch(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(d => {
        if (d.status !== 'success') throw new Error(d.message || 'Falha ao gravar na planilha.');
      })
      .catch(e => this.saveConfig({ status: 'error', errorMessage: e?.message || 'Falha ao gravar na planilha.' }));
  }

  /** Lê a planilha e atualiza meta + extras + corridas em memória; avisa a tela se algo mudou. */
  public static async refreshFromSheet(): Promise<{ changed: boolean }> {
    const { meta, type, csv, scenario, tariffPeriods, auditLogs } = await this.fetchAll();
    this.applyMeta(meta, type);
    const extrasChanged = this.applyExtras(scenario, tariffPeriods, auditLogs);
    let changed = false;
    if (csv && csv !== this.rawCsvCache) {
      const r = this.importFromCsvText(csv, 'replace');
      changed = r.success;
    } else if (extrasChanged) {
      this.reprocessTrips();
      changed = true;
    }
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    this.saveConfig({ status: 'synced', errorMessage: undefined, lastSyncedAt: `${nowStr} (Planilha Google Sheets)` });
    if (changed) this.dataListeners.forEach(l => l());
    return { changed };
  }

  public static startTargetSync(): void {
    if (typeof window === 'undefined' || this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      this.refreshFromSheet().catch(e => console.warn('[SheetsService] Falha no polling da planilha:', e));
    }, POLL_MS);
  }

  public static async fetchSavingTarget(): Promise<SavingTargetConfig> {
    return this.syncTargetFromGoogleSheets();
  }

  public static async syncTargetFromGoogleSheets(): Promise<SavingTargetConfig> {
    const { meta, type } = await this.fetchAll();
    this.applyMeta(meta, type);
    return this.savingTarget;
  }

  public static getSavingTarget(): SavingTargetConfig {
    return this.savingTarget;
  }

  /** Grava a meta direto na aba Config (A2 = valor, B2 = tipo) via Apps Script. */
  public static async setSavingTarget(target: SavingTargetConfig): Promise<SavingTargetConfig> {
    if (!SHEETS_API_URL) throw new Error('VITE_SHEETS_API_URL não configurada (URL do Web App do Apps Script).');
    const value = Number(target.targetValue);
    if (!(value > 0)) throw new Error('Meta inválida.');
    const type = target.targetType === 'percent' ? 'percent' : 'value';
    const res = await fetch(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ targetValue: value, targetType: type })
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Falha ao gravar a meta na planilha.');
    this.applyMeta(Number(data.targetValue) || value, type);
    return this.savingTarget;
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
    return this.trips;
  }

  /** Sem cache local: a planilha é a única fonte oficial. */
  public static saveTrips(): void {
    // intencionalmente vazio
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

  /**
   * Carga inicial: meta (aba Config) + corridas (aba Dados Uber) numa única chamada à planilha.
   * Sem cache local: se a planilha não responder, o erro é exibido (nunca dados antigos).
   */
  public static async loadInitialData(): Promise<UberCsvTripRecord[]> {
    try {
      STALE_LOCAL_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignora
    }
    try {
      await this.refreshFromSheet();
    } catch (e: any) {
      this.saveConfig({ status: 'error', errorMessage: e?.message || 'Falha ao ler a planilha.' });
      throw e;
    }
    return this.trips;
  }

  public static async syncFromGoogleSheets(
    _urlInput?: string,
    _mode: 'merge' | 'replace' = 'replace'
  ): Promise<{
    success: boolean;
    count: number;
    newTripsCount?: number;
    dates?: string[];
    latestDate?: string;
    detectedTab?: string;
    error?: string
  }> {
    this.saveConfig({ status: 'syncing' });
    const before = this.trips.length;
    try {
      await this.refreshFromSheet();
      const dates = Array.from(new Set(this.trips.map(t => t.requestDateLocal).filter(Boolean))).sort();
      return {
        success: this.trips.length > 0,
        count: this.trips.length,
        newTripsCount: Math.max(0, this.trips.length - before),
        dates,
        latestDate: dates[dates.length - 1],
        detectedTab: 'Dados Uber',
        error: this.trips.length > 0 ? undefined : 'A aba de corridas está vazia ou não foi reconhecida.'
      };
    } catch (e: any) {
      const msg = e?.message || 'Erro ao sincronizar com Google Sheets.';
      this.saveConfig({ status: 'error', errorMessage: msg });
      return { success: false, count: 0, error: msg };
    }
  }

  /** Uso interno: só processa o texto que veio da planilha (nunca de upload manual). */
  private static importFromCsvText(
    csvText: string, 
    mode: 'merge' | 'replace' = 'merge'
  ): { 
    success: boolean; 
    count: number; 
    newTripsCount: number;
    dates: string[];
    latestDate?: string;
    error?: string 
  } {
    try {
      this.rawCsvCache = csvText;
      const periods = this.getTariffPeriods();
      const scenario = this.getActiveScenario();
      const parsed = CsvParserService.parseUberCsv(csvText, periods, scenario);
      if (parsed.length === 0) {
        return { 
          success: false, 
          count: 0, 
          newTripsCount: 0, 
          dates: [], 
          error: 'O arquivo não continha registros válidos ou as colunas não foram reconhecidas.' 
        };
      }

      const existing = this.getTrips();
      let finalTrips: UberCsvTripRecord[] = [];
      let newCount = 0;

      if (mode === 'replace') {
        finalTrips = parsed;
        newCount = parsed.length;
      } else {
        // Merge inteligente preservando registros prévios e adicionando novas viagens
        const existingMap = new Map<string, UberCsvTripRecord>();
        existing.forEach(t => existingMap.set(t.id, t));

        parsed.forEach(t => {
          if (!existingMap.has(t.id)) {
            newCount++;
          }
          existingMap.set(t.id, t);
        });

        finalTrips = Array.from(existingMap.values());
      }

      // Ordena por data e horário
      finalTrips.sort((a, b) => {
        const da = `${a.requestDateLocal}T${a.requestTimeLocal}`;
        const db = `${b.requestDateLocal}T${b.requestTimeLocal}`;
        return db.localeCompare(da);
      });

      this.trips = finalTrips;
      this.saveTrips();

      const uniqueDates = Array.from(new Set(finalTrips.map(t => t.requestDateLocal).filter(Boolean))).sort();
      const latestDate = uniqueDates[uniqueDates.length - 1];

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.saveConfig({ status: 'synced', lastSyncedAt: timestamp });

      return { 
        success: true, 
        count: finalTrips.length, 
        newTripsCount: newCount,
        dates: uniqueDates,
        latestDate 
      };
    } catch (err: any) {
      return { 
        success: false, 
        count: 0, 
        newTripsCount: 0, 
        dates: [], 
        error: err?.message || 'Erro ao processar arquivo CSV.' 
      };
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
