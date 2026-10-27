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

const LOCAL_STORAGE_UBER_TRIPS = 'mobility_uber_trips_data_v4';
const LOCAL_STORAGE_SHEETS_CONFIG = 'mobility_sheets_config_v4';
const LOCAL_STORAGE_TARIFF_PERIODS = 'mobility_tariff_periods_v4';
const LOCAL_STORAGE_AUDIT_LOGS = 'mobility_audit_logs_v4';
const LOCAL_STORAGE_ACTIVE_SCENARIO = 'mobility_active_scenario_v4';
const LOCAL_STORAGE_SAVING_TARGET = 'mobility_saving_target_v4';
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

export const OFFICIAL_GOOGLE_SHEET_ID = '1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE';

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
    sheetUrl: `https://docs.google.com/spreadsheets/d/${OFFICIAL_GOOGLE_SHEET_ID}/edit#gid=0`,
    lastSyncedAt: 'Planilha · aguardando sincronização',
    status: 'idle',
    source: 'google_sheets_live',
    autoSyncIntervalMinutes: 15,
    taxiReferenceRate: 146.06,
  };

  public static isLiveSheetsSource(): boolean {
    return this.config.source === 'google_sheets_live';
  }

  public static getDataSourceInfo(): {
    source: 'google_sheets_live' | 'local_cache';
    isLive: boolean;
    lastSyncedAt: string;
    totalTrips: number;
  } {
    return {
      source: this.config.source || 'google_sheets_live',
      isLive: this.config.source === 'google_sheets_live',
      lastSyncedAt: this.config.lastSyncedAt,
      totalTrips: this.trips.length
    };
  }

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
  // Meta de Saving Mensal (Sincronizada Globalmente em Tempo Real)
  // ==========================================

  private static targetListeners: Set<(target: SavingTargetConfig) => void> = new Set();
  private static broadcastChannel: BroadcastChannel | null = null;
  private static eventSource: EventSource | null = null;
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

  public static startTargetSync(): void {
    if (typeof window === 'undefined' || this.targetSyncStarted) return;
    this.targetSyncStarted = true;

    // 1. Canal entre abas do mesmo navegador (BroadcastChannel)
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('mobility_target_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && typeof event.data.targetValue === 'number' && event.data.targetValue !== 6000) {
            this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...event.data };
            try {
              localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
            } catch {}
            this.notifyTargetListeners(this.savingTarget);
          }
        };
      } catch (e) {
        console.warn('[SheetsService] BroadcastChannel não disponível:', e);
      }
    }

    // 2. Conexão Server-Sent Events (SSE) para atualização instantânea do servidor entre diferentes usuários
    if ('EventSource' in window) {
      try {
        this.eventSource = new EventSource('/api/mobility/target/stream');
        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && typeof data.targetValue === 'number' && data.targetValue !== 6000) {
              const hasChanged = 
                !this.savingTarget ||
                this.savingTarget.targetValue !== data.targetValue ||
                this.savingTarget.targetType !== data.targetType ||
                this.savingTarget.updatedAt !== data.updatedAt;

              if (hasChanged) {
                this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...data };
                try {
                  localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
                } catch {}
                this.notifyTargetListeners(this.savingTarget);
              }
            }
          } catch (e) {
            // Ignora mensagens que não sejam JSON (ex: keepalive)
          }
        };

        this.eventSource.onerror = () => {
          // Em caso de desconexão, o EventSource reconecta automaticamente
        };
      } catch (e) {
        console.warn('[SheetsService] EventSource falhou ao inicializar:', e);
      }
    }

    // 3. Fallback de escuta do LocalStorage para abas que não suportam BroadcastChannel
    window.addEventListener('storage', (e) => {
      if (e.key === LOCAL_STORAGE_SAVING_TARGET && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed.targetValue === 'number' && parsed.targetValue !== 6000) {
            this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...parsed };
            this.notifyTargetListeners(this.savingTarget);
          }
        } catch {}
      }
    });

    // 4. Polling periódico de segurança (a cada 20 segundos) com anti-cache
    setInterval(() => {
      this.fetchSavingTarget();
    }, 20000);

    // 5. Atualização imediata ao ganhar foco na janela/aba
    window.addEventListener('focus', () => {
      this.fetchSavingTarget();
    });

    // Carrega a meta remota imediatamente
    this.fetchSavingTarget();
  }

  public static async fetchSavingTarget(): Promise<SavingTargetConfig> {
    return this.syncTargetFromGoogleSheets();
  }

  public static async syncTargetFromGoogleSheets(sheetId = OFFICIAL_GOOGLE_SHEET_ID): Promise<SavingTargetConfig> {
    // 1. Tenta buscar diretamente da aba Config do Google Sheets (funciona em qualquer ambiente, inclusive Cloudflare Workers)
    try {
      const configUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Config&_t=${Date.now()}`;
      const response = await fetch(configUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const csv = await response.text();
        const parsedVal = SheetsService.parseTargetNumberFromCsv(csv);
        if (parsedVal && parsedVal > 0) {
          const remoteTarget: SavingTargetConfig = {
            ...DEFAULT_SAVING_TARGET,
            targetType: 'value',
            targetValue: parsedVal,
            month: this.savingTarget?.month || '2026-10',
            updatedAt: new Date().toISOString(),
            updatedBy: 'Planilha Google Sheets (Aba Config)'
          };
          const hasChanged = !this.savingTarget || this.savingTarget.targetValue !== remoteTarget.targetValue;
          this.savingTarget = remoteTarget;
          try {
            localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
          } catch {}
          if (hasChanged) {
            this.notifyTargetListeners(this.savingTarget);
          }
          return this.savingTarget;
        }
      }
    } catch (e) {
      console.warn('[SheetsService] Falha no fetch direto da aba Config do Google Sheets:', e);
    }

    // 2. Tenta via GET /api/mobility/target (se houver backend Express rodando)
    try {
      const res = await fetch(`/api/mobility/target?_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.target && typeof data.target.targetValue === 'number' && data.target.targetValue > 0) {
          const remoteTarget: SavingTargetConfig = { ...DEFAULT_SAVING_TARGET, ...data.target };
          const hasChanged = !this.savingTarget || this.savingTarget.targetValue !== remoteTarget.targetValue;
          this.savingTarget = remoteTarget;
          try {
            localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
          } catch {}
          if (hasChanged) {
            this.notifyTargetListeners(this.savingTarget);
          }
          return this.savingTarget;
        }
      }
    } catch (e) {
      console.warn('[SheetsService] Falha ao sincronizar via backend GET /target:', e);
    }

    // 3. Fallback: POST /api/mobility/target/sync-sheets
    try {
      const postRes = await fetch(`/api/mobility/target/sync-sheets?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });
      if (postRes.ok) {
        const data = await postRes.json();
        if (data && data.success && data.target && typeof data.target.targetValue === 'number' && data.target.targetValue > 0) {
          const remoteTarget: SavingTargetConfig = { ...DEFAULT_SAVING_TARGET, ...data.target };
          this.savingTarget = remoteTarget;
          try {
            localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
          } catch {}
          this.notifyTargetListeners(this.savingTarget);
          return this.savingTarget;
        }
      }
    } catch (e) {
      console.warn('[SheetsService] Falha no POST sync-sheets:', e);
    }

    return this.getSavingTarget();
  }

  private static parseTargetNumberFromCsv(csv: string): number | null {
    if (!csv) return null;
    const rawLines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parseNum = (str: string): number | null => {
      if (!str) return null;
      let clean = str.replace(/"/g, '').replace(/[R$\s]/g, '').trim();
      if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      const val = parseFloat(clean);
      return !isNaN(val) && val > 0 ? val : null;
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const cols = line.split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
      if (cols[0] && cols[0].toLowerCase().includes('meta') && cols.length > 1) {
        const val = parseNum(cols[1]);
        if (val) return val;
      }
      if (cols[0] && cols[0].toLowerCase().includes('meta') && i + 1 < rawLines.length) {
        const nextCols = rawLines[i + 1].split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
        for (const cell of nextCols) {
          const val = parseNum(cell);
          if (val) return val;
        }
      }
    }

    for (const line of rawLines) {
      const cols = line.split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
      for (const cell of cols) {
        if (/meta/i.test(cell)) continue;
        const val = parseNum(cell);
        if (val && val >= 100) return val;
      }
    }

    return null;
  }

  public static getSavingTarget(): SavingTargetConfig {
    if (this.savingTarget && this.savingTarget.targetValue > 0) {
      return this.savingTarget;
    }
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVING_TARGET);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.targetValue === 'number' && parsed.targetValue > 0) {
          this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...parsed };
          return this.savingTarget;
        }
      }
    } catch {
      // fallback
    }
    this.savingTarget = { ...DEFAULT_SAVING_TARGET };
    return this.savingTarget;
  }

  public static async setSavingTarget(target: SavingTargetConfig): Promise<SavingTargetConfig> {
    const cleanTarget: SavingTargetConfig = {
      ...target,
      targetValue: Number(target.targetValue),
      updatedAt: new Date().toISOString(),
      updatedBy: target.updatedBy || 'Gestor de Mobilidade'
    };

    this.savingTarget = cleanTarget;
    try {
      localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(cleanTarget));
    } catch {
      // storage unavailable
    }

    // Notifica listeners locais imediatamente para feedback instantâneo na UI
    this.notifyTargetListeners(cleanTarget);

    // Propaga via BroadcastChannel para outras abas no mesmo navegador
    try {
      this.broadcastChannel?.postMessage(cleanTarget);
    } catch {}

    // Persiste globalmente no backend para todos os outros usuários e navegadores
    try {
      const res = await fetch('/api/mobility/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTarget)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.target) {
          this.savingTarget = { ...this.savingTarget, ...data.target };
          try {
            localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(this.savingTarget));
          } catch {}
          this.notifyTargetListeners(this.savingTarget);
          try {
            this.broadcastChannel?.postMessage(this.savingTarget);
          } catch {}
          return this.savingTarget;
        }
      }
    } catch (err) {
      console.error('[SheetsService] Erro ao sincronizar meta com backend:', err);
    }

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
    // 1. Sincroniza a meta oficial diretamente da aba Config da planilha
    try {
      await this.fetchSavingTarget();
    } catch (e) {
      console.warn('[SheetsService] Erro ao sincronizar meta inicial:', e);
    }

    // 2. Sincroniza a base de corridas diretamente do Google Sheets (Oficial)
    try {
      const syncRes = await this.syncFromGoogleSheets(undefined, 'replace');
      if (syncRes.success && this.trips.length > 0) {
        return this.trips;
      }
    } catch (e) {
      console.warn('[SheetsService] Sync online falhou no load inicial:', e);
    }

    // 3. Fallback apenas se o dispositivo estiver offline e possuir cache prévio no navegador
    const existing = this.getTrips();
    if (existing.length > 0) {
      this.config.source = 'local_cache';
      const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      this.config.lastSyncedAt = `Cópia local desatualizada · última sincronização ${nowStr}`;
      return existing;
    }

    return this.trips;
  }

  /**
   * Converte URLs padrão de compartilhamento do Google Sheets (/edit#gid=0) em link direto de exportação CSV
   */
  public static normalizeGoogleSheetUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';

    // Se já é link direto de exportação CSV, retorna como está
    if (trimmed.includes('output=csv') || trimmed.includes('format=csv')) {
      return trimmed;
    }

    // Se é link docs.google.com/spreadsheets/d/{id}
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
      const gidParam = gidMatch && gidMatch[1] ? `&gid=${gidMatch[1]}` : '';
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
    }

    return trimmed;
  }

  public static async syncFromGoogleSheets(
    urlInput?: string,
    mode: 'merge' | 'replace' = 'replace'
  ): Promise<{ 
    success: boolean; 
    count: number; 
    newTripsCount?: number;
    dates?: string[];
    latestDate?: string;
    detectedTab?: string;
    source?: 'google_sheets_live' | 'local_cache';
    isStale?: boolean;
    error?: string 
  }> {
    const rawUrl = (urlInput || this.config.sheetUrl || '').trim();
    this.saveConfig({ status: 'syncing' });

    let sheetId = OFFICIAL_GOOGLE_SHEET_ID;
    if (rawUrl) {
      const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }
    }

    try {
      let csvContent = '';
      let detectedTab = 'Dados Uber';
      let dataSource: 'google_sheets_live' | 'local_cache' = 'google_sheets_live';

      // 1. Tenta PRIMEIRO o endpoint GViz oficial da aba "Dados Uber" direto no navegador/cliente
      // Suporta CORS para qualquer origem e roda perfeitamente em Cloudflare Workers, Dev e Prod
      try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Dados%20Uber&_t=${Date.now()}`;
        const gvizRes = await fetch(gvizUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (gvizRes.ok) {
          const text = await gvizRes.text();
          if (text && text.length > 500 && /data da solicita|valor da transa|id da viagem|uber/i.test(text)) {
            csvContent = text;
            detectedTab = 'Dados Uber';
            dataSource = 'google_sheets_live';
          }
        }
      } catch (gvizErr) {
        console.warn('[SheetsService] Falha no fetch direto via GViz:', gvizErr);
      }

      // 2. Se falhar o GViz direto, tenta o proxy do servidor Express (/api/mobility/sheets-sync)
      if (!csvContent) {
        try {
          const proxyRes = await fetch('/api/mobility/sheets-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawUrl ? { url: rawUrl } : {})
          });
          if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            if (proxyData && proxyData.csv && proxyData.csv.length > 500) {
              csvContent = proxyData.csv;
              detectedTab = proxyData.detectedTab || 'Dados Uber';
              dataSource = proxyData.source || 'google_sheets_live';
            }
          }
        } catch (e) {
          console.warn('[SheetsService] Falha na chamada POST /api/mobility/sheets-sync:', e);
        }
      }

      // 3. Fallback: export padrão CSV com gid=0
      if (!csvContent) {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0&_t=${Date.now()}`;
          const exportRes = await fetch(exportUrl, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          if (exportRes.ok) {
            const expText = await exportRes.text();
            if (expText && expText.length > 500 && /data da solicita|valor da transa|id da viagem|uber/i.test(expText)) {
              csvContent = expText;
              detectedTab = 'Dados Uber';
              dataSource = 'google_sheets_live';
            }
          }
        } catch (exportErr) {
          console.warn('[SheetsService] Falha no fetch export do Google Sheets:', exportErr);
        }
      }

      // 4. Se obtivemos o CSV da planilha com sucesso, processa e atualiza os dados
      if (csvContent) {
        const importRes = this.importFromCsvText(csvContent, mode);
        if (importRes.success) {
          const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          this.saveConfig({ 
            status: 'synced', 
            source: dataSource,
            lastSyncedAt: `Planilha · atualizado ${nowStr}` 
          });
          return {
            ...importRes,
            detectedTab,
            source: dataSource,
            isStale: false
          };
        }
      }

      // 5. Fallback offline: se o dispositivo estiver sem internet mas já possuir corridas em cache local
      const existing = this.getTrips();
      if (existing.length > 0) {
        const dates = Array.from(new Set(existing.map(t => t.requestDateLocal))).sort();
        const latestDate = dates[dates.length - 1];
        const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        this.saveConfig({ 
          status: 'error', 
          source: 'local_cache',
          lastSyncedAt: `Cópia local desatualizada · última sincronização ${nowStr}` 
        });
        return {
          success: true,
          count: existing.length,
          newTripsCount: 0,
          dates,
          latestDate,
          detectedTab: 'Dados Uber',
          source: 'local_cache',
          isStale: true
        };
      }

      throw new Error('Não foi possível conectar com a planilha Google Sheets oficial e não há dados em cache.');
    } catch (err: any) {
      const existing = this.getTrips();
      if (existing.length > 0) {
        const dates = Array.from(new Set(existing.map(t => t.requestDateLocal))).sort();
        const latestDate = dates[dates.length - 1];
        const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return {
          success: true,
          count: existing.length,
          newTripsCount: 0,
          dates,
          latestDate,
          detectedTab: 'Dados Uber',
          source: 'local_cache',
          isStale: true
        };
      }
      const errorMsg = err?.message || 'Erro ao sincronizar com Google Sheets.';
      this.saveConfig({ status: 'error', source: 'local_cache', errorMessage: errorMsg });
      return { success: false, count: 0, error: errorMsg };
    }
  }

  public static importFromCsvText(
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
    dataSourceInfo: ReturnType<typeof SheetsService.getDataSourceInfo>;
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
    const dataSourceInfo = this.getDataSourceInfo();

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
      dataSourceInfo,
    };
  }
}
