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
  targetValue: 50000,
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
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/edit',
    lastSyncedAt: '23/10/2026 às 11:45',
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

    // 4. Polling periódico de segurança (a cada 3 segundos) com anti-cache
    setInterval(() => {
      this.fetchSavingTarget();
    }, 3000);

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

  public static async syncTargetFromGoogleSheets(): Promise<SavingTargetConfig> {
    // 1. Tenta via backend proxy (sem qualquer restrição de CORS e com anti-cache garantido)
    try {
      const res = await fetch(`/api/mobility/target?refresh=true&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.target && typeof data.target.targetValue === 'number') {
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
      console.warn('[SheetsService] Falha ao sincronizar via backend proxy:', e);
    }

    // 2. Fallback direto da aba Config no Google Sheets via cliente (sem cabeçalhos customizados para não acionar preflight CORS)
    try {
      const directUrl = `https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/gviz/tq?tqx=out:csv&sheet=Config&tq=&_t=${Date.now()}`;
      const directRes = await fetch(directUrl);
      if (directRes.ok) {
        const csv = await directRes.text();
        const lines = csv.split('\n').map(l => l.trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (lines.length >= 2) {
          let rawVal = lines[1].replace(/"/g, '').replace('R$', '').trim();
          let parsedVal = NaN;
          if (rawVal.includes('.') && rawVal.includes(',')) {
            parsedVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
          } else if (rawVal.includes(',')) {
            parsedVal = parseFloat(rawVal.replace(',', '.'));
          } else {
            parsedVal = parseFloat(rawVal);
          }

          if (!isNaN(parsedVal) && parsedVal > 0) {
            const cleanTarget: SavingTargetConfig = {
              targetType: 'value',
              targetValue: parsedVal,
              month: this.savingTarget?.month || '2026-10',
              updatedAt: new Date().toISOString(),
              updatedBy: 'Planilha Google Sheets (Aba Config)'
            };
            this.savingTarget = cleanTarget;
            try {
              localStorage.setItem(LOCAL_STORAGE_SAVING_TARGET, JSON.stringify(cleanTarget));
            } catch {}
            this.notifyTargetListeners(cleanTarget);

            // Avisa o servidor em background
            fetch('/api/mobility/target', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cleanTarget)
            }).catch(() => {});

            return cleanTarget;
          }
        }
      }
    } catch (e) {
      console.warn('[SheetsService] Leitura direta falhou:', e);
    }

    return this.getSavingTarget();
  }

  public static getSavingTarget(): SavingTargetConfig {
    if (this.savingTarget && this.savingTarget.targetValue > 0 && this.savingTarget.targetValue !== 6000) {
      return this.savingTarget;
    }
    try {
      // Purga qualquer chave com o 6000 indesejado
      const oldKeys = ['mobility_saving_target', 'mobility_saving_target_v4'];
      for (const k of oldKeys) {
        const val = localStorage.getItem(k);
        if (val && val.includes('6000')) {
          localStorage.removeItem(k);
        }
      }

      const stored = localStorage.getItem(LOCAL_STORAGE_SAVING_TARGET);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.targetValue === 'number' && parsed.targetValue > 0 && parsed.targetValue !== 6000) {
          this.savingTarget = { ...DEFAULT_SAVING_TARGET, ...parsed };
          return this.savingTarget;
        } else if (parsed && parsed.targetValue === 6000) {
          localStorage.removeItem(LOCAL_STORAGE_SAVING_TARGET);
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
    // Sincroniza a meta compartilhada com todos os usuários a partir do backend
    await this.fetchSavingTarget();

    const existing = this.getTrips();
    const hasDay23 = existing.some(t => t.requestDateLocal === '2026-10-23');
    if (existing.length >= 80 && hasDay23) {
      return existing;
    }

    // Tenta primeiro carregar direto da planilha Google Sheets online oficial
    try {
      const syncRes = await this.syncFromGoogleSheets(this.config.sheetUrl);
      if (syncRes.success && this.trips.length > 0) {
        return this.trips;
      }
    } catch {
      // continua para fallback
    }

    // Fallback: carrega CSV base e mescla o lote oficial do dia 23
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
        }
      }
    } catch {
      // fallback
    }

    // Garante que o dia 23 esteja na base mesmo offline
    if (!this.trips.some(t => t.requestDateLocal === '2026-10-23')) {
      this.loadDay23Batch();
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

  public static async syncFromGoogleSheets(urlInput?: string): Promise<{ 
    success: boolean; 
    count: number; 
    newTripsCount?: number;
    dates?: string[];
    latestDate?: string;
    detectedTab?: string;
    error?: string 
  }> {
    const rawUrl = (urlInput || this.config.sheetUrl || 'https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/edit').trim();
    this.saveConfig({ sheetUrl: rawUrl, status: 'syncing' });

    try {
      let csvContent = '';
      let detectedTab = 'Dados Uber';

      // 1. Tenta via proxy backend do Express (resolve CORS, múltiplos tabs e redirecionamentos)
      try {
        const proxyRes = await fetch('/api/mobility/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: rawUrl })
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.csv) {
            csvContent = proxyData.csv;
            detectedTab = proxyData.detectedTab || 'Dados Uber';
          }
        }
      } catch {
        // tenta fetch direto no navegador
      }

      // 2. Se o proxy não retornou, tenta fetch direto
      if (!csvContent) {
        const directUrl = this.normalizeGoogleSheetUrl(rawUrl);
        const directRes = await fetch(directUrl);
        if (!directRes.ok) {
          throw new Error(`Falha ao obter planilha: status HTTP ${directRes.status}. Verifique se a planilha tem permissão pública de visualização.`);
        }
        csvContent = await directRes.text();
      }

      const importRes = this.importFromCsvText(csvContent, 'merge');
      if (!importRes.success) {
        throw new Error(importRes.error || 'Nenhum registro válido encontrado na planilha.');
      }

      return {
        ...importRes,
        detectedTab
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao sincronizar com Google Sheets.';
      this.saveConfig({ status: 'error', errorMessage: errorMsg });
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
   * Carga oficial do lote de viagens do dia 23/10/2026 (Operação GRU)
   */
  public static loadDay23Batch(): { 
    success: boolean; 
    count: number; 
    newTripsCount: number;
    dates: string[];
    latestDate: string;
    error?: string 
  } {
    const day23Csv = `Data da solicitação (UTC),Hora da solicitação (UTC),Nome,Sobrenome,ID do funcionário,Serviço,Cidade,Endereço de partida,Endereço de destino,Tipo de transação,Valor da transação (moeda local),Valor da transação: BRL,ID da viagem/Uber Eats,Detalhamento da despesa,Registro de data e hora da transação (UTC),Data da solicitação (local),Hora da solicitação (local),Data de chegada (UTC),Hora de chegada (UTC),Data de chegada (local),Hora de chegada (local),Compensação do fuso horário de solicitação a partir do UTC,E-mail,Grupo,Programa,País,Distância (mi),Duração (min),Código da despesa,Forma de pagamento,Preço líquido da Uber (moeda local),Promoções da Uber (moeda local),Total de impostos sobre o preço da Uber (moeda local),Preço líquido da Uber (moeda local),Preço líquido do parceiro (moeda local),Total de impostos sobre o preço do parceiro (moeda local),Preço bruto do parceiro (moeda local),Valor extra em moeda local,Outras cobranças (moeda local),Valor total (moeda local),Total de impostos (moeda local),Pagamentos feitos por colaboradores/convidados (moeda da empresa),Economia pela assinatura (moeda local),Código da moeda local,Valor extra em BRL,Valor total: BRL,Impostos totais: BRL,Pagamentos feitos por colaboradores/convidados (em BRL),Fatura de preço da Uber n.º,Data da fatura de preço da Uber,Link da fatura de preço da Uber,Nome do arquivo da fatura de preço da Uber,Fatura de preço do parceiro n.º,Data da fatura de preço do parceiro,Link da fatura de preço do parceiro,Nome do arquivo da fatura de preço do parceiro,CPF/CNPJ do parceiro,Nome do parceiro,Endereço e CEP do parceiro,Programa de vouchers,Observação de despesas do programa de vouchers,Código do voucher,Regras do voucher,ID da campanha de vouchers,Parceiro de integração,Nome do convidado,Sobrenome do convidado,Várias paradas,IsGroupOrder,Tipo de atendimento,Tipo de cancelamento,Taxa de serviço e tecnologia estimada (com tributos aplicáveis) em BRL,"Taxa de integração estimada em BRL (incluídos impostos, se houver)",Informações da parada,ID externa do convidado
10/23/2026,03:05,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua André Paperini, 414 - Pimentas, Guarulhos - SP, 07260-460, Brasil",Fare,67.45,67.45,gru-23-001,--,23/10/2026 03:35,10/23/2026,00:05,10/23/2026,03:35,10/23/2026,00:35,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,10.82,24,--,Periodic Billing,0.00,0.00,0.00,0.00,67.45,0.00,67.45,0.00,0.00,67.45,0.00,0.00,0.00,BRL,0.00,67.45,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,ESMERALDINA,FEITOSA DE ALENCAR TEIXEIRA,2,--,--,--,0.00,0.00,"ESMERALDINA FEITOSA DE ALENCAR TEIXEIRA | Caroline Santos de Paula || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Santa Gertrúdes | Rua André Paperini, 414 - Pimentas, Guarulhos - SP, 07260-460, Brasil",--
10/23/2026,03:15,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Barbacena, 361 - Bom Clima, Guarulhos - SP, 07122-160, Brasil",Fare,61.20,61.20,gru-23-002,--,23/10/2026 03:48,10/23/2026,00:15,10/23/2026,03:48,10/23/2026,00:48,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,8.74,27,--,Periodic Billing,0.00,0.00,0.00,0.00,61.20,0.00,61.20,0.00,0.00,61.20,0.00,0.00,0.00,BRL,0.00,61.20,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,JESSICA,KEVELLYN DE OLIVEIRA FRANCA,2,--,--,--,0.00,0.00,"JESSICA KEVELLYN DE OLIVEIRA FRANCA | Maikool Andres || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Ten. Campo | Rua Barbacena, 361 - Bom Clima, Guarulhos - SP, 07122-160, Brasil",--
10/23/2026,03:25,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Galáxia, 611 - Bananal, Guarulhos - SP, 07145-265, Brasil",Fare,52.10,52.10,gru-23-003,--,23/10/2026 03:52,10/23/2026,00:25,10/23/2026,03:52,10/23/2026,00:52,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,8.25,20,--,Periodic Billing,0.00,0.00,0.00,0.00,52.10,0.00,52.10,0.00,0.00,52.10,0.00,0.00,0.00,BRL,0.00,52.10,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Yuri,Santos de Andrade,--,--,--,--,0.00,0.00,"Yuri Santos de Andrade || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | Rua Galáxia, 611 - Bananal, Guarulhos - SP, 07145-265, Brasil",--
10/23/2026,03:30,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Avenida das Margaridas, 1116 - São João, Guarulhos - SP, 07091-100, Brasil",Fare,65.80,65.80,gru-23-004,--,23/10/2026 04:08,10/23/2026,00:30,10/23/2026,04:08,10/23/2026,01:08,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,12.50,31,--,Periodic Billing,0.00,0.00,0.00,0.00,65.80,0.00,65.80,0.00,0.00,65.80,0.00,0.00,0.00,BRL,0.00,65.80,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Joselanio,Lorival dos Santos,3,--,--,--,0.00,0.00,"Joselanio Lorival dos Santos | Tiago Rodrigo | GIOVANNA CARNEIRO DA SILVA || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. dos Eucaliptos | R. Taipu | Avenida das Margaridas, 1116 - São João, Guarulhos - SP, 07091-100, Brasil",--
10/23/2026,03:40,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Capitão Zineu Simionato, 434 - Morros, Guarulhos - SP, 07135-050, Brasil",Fare,64.15,64.15,gru-23-005,--,23/10/2026 04:15,10/23/2026,00:40,10/23/2026,04:15,10/23/2026,01:15,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,9.50,26,--,Periodic Billing,0.00,0.00,0.00,0.00,64.15,0.00,64.15,0.00,0.00,64.15,0.00,0.00,0.00,BRL,0.00,64.15,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,PALOMA,DA SILVA NEVES,3,--,--,--,0.00,0.00,"PALOMA DA SILVA NEVES | ALEXSANDRO LEONARDO MORAES NUNES | Nayarah Cristine Meneses || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Nelsom Fuchs | Rua Capitão Zineu Simionato, 434 - Morros, Guarulhos - SP, 07135-050, Brasil",--
10/23/2026,03:55,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Mena, 287 - Picanço, Guarulhos - SP, 02365-130, Brasil",Fare,68.40,68.40,gru-23-006,--,23/10/2026 04:36,10/23/2026,00:55,10/23/2026,04:36,10/23/2026,01:36,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,11.45,35,--,Periodic Billing,0.00,0.00,0.00,0.00,68.40,0.00,68.40,0.00,0.00,68.40,0.00,0.00,0.00,BRL,0.00,68.40,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,RHAMON,DIAS ANDRADE,2,--,--,--,0.00,0.00,"RHAMON DIAS ANDRADE | Patrick Lojan || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | Rua Miguel Tavares | Rua Mena, 287 - Picanço, Guarulhos - SP, 02365-130, Brasil",--
10/23/2026,04:12,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Tancredo de Almeida Neves, 212 - Cabuçu, Guarulhos - SP, 07144-490, Brasil",Fare,66.30,66.30,gru-23-007,--,23/10/2026 04:50,10/23/2026,01:12,10/23/2026,04:50,10/23/2026,01:50,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,9.45,30,--,Periodic Billing,0.00,0.00,0.00,0.00,66.30,0.00,66.30,0.00,0.00,66.30,0.00,0.00,0.00,BRL,0.00,66.30,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,CINTIA,RIBEIRO SILVA PAIXÃO,3,--,--,--,0.00,0.00,"CINTIA RIBEIRO SILVA PAIXÃO | Vitor miguel | Guilherme Wochyton || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Fabiana Batista | R. Pouso Alegre | Rua Tancredo de Almeida Neves, 212 - Cabuçu, Guarulhos - SP, 07144-490, Brasil",--
10/23/2026,04:20,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Avenida Antônio Carlos, 326 - Morros, Guarulhos - SP, 07134-000, Brasil",Fare,58.70,58.70,gru-23-008,--,23/10/2026 04:55,10/23/2026,01:20,10/23/2026,04:55,10/23/2026,01:55,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,10.40,26,--,Periodic Billing,0.00,0.00,0.00,0.00,58.70,0.00,58.70,0.00,0.00,58.70,0.00,0.00,0.00,BRL,0.00,58.70,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Talita,Gentili Borges  Tupinamba,2,--,--,--,0.00,0.00,"Talita Gentili Borges  Tupinamba | ANA LUYZA NUNES BATISTA || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Nossa Sra. Aparecida | Avenida Antônio Carlos, 326 - Morros, Guarulhos - SP, 07134-000, Brasil",--
10/23/2026,04:35,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Ana Soares Barcelos, 249 - Ponte Grande, Guarulhos - SP, 07031-070, Brasil",Fare,73.50,73.50,gru-23-009,--,23/10/2026 05:15,10/23/2026,01:35,10/23/2026,05:15,10/23/2026,02:15,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,10.25,29,--,Periodic Billing,0.00,0.00,0.00,0.00,73.50,0.00,73.50,0.00,0.00,73.50,0.00,0.00,0.00,BRL,0.00,73.50,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,PATRICK,BARROS,2,--,--,--,0.00,0.00,"PATRICK BARROS | CLAUDIO ANTONIO ALVES DE SOUZA || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Cavadas | Rua Ana Soares Barcelos, 249 - Ponte Grande, Guarulhos - SP, 07031-070, Brasil",--
10/23/2026,04:45,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil","Rua Kazuko Fuji Chimizu, 551 - Fortaleza, Guarulhos - SP, 07153-120, Brasil",Fare,109.80,109.80,gru-23-010,--,23/10/2026 05:38,10/23/2026,01:45,10/23/2026,05:38,10/23/2026,02:38,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,16.80,45,--,Periodic Billing,0.00,0.00,0.00,0.00,109.80,0.00,109.80,0.00,0.00,109.80,0.00,0.00,0.00,BRL,0.00,109.80,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,MARIA ABERLANDIA,SOUSA NASCIMENTO,3,--,--,--,0.00,0.00,"MARIA ABERLANDIA SOUSA NASCIMENTO | ANA BEATRIZ SILVA DE JESUS | Erasmo Almeida || Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil | R. Beira Rio | Av. José Brumatti | Rua Kazuko Fuji Chimizu, 551 - Fortaleza, Guarulhos - SP, 07153-120, Brasil",--
10/23/2026,05:10,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Avenida Torres Tibagy, 784 - Gopouva, Guarulhos - SP, 07062-000, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,47.20,47.20,gru-23-011,--,23/10/2026 05:35,10/23/2026,02:10,10/23/2026,05:35,10/23/2026,02:35,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,10.20,18,--,Periodic Billing,0.00,0.00,0.00,0.00,47.20,0.00,47.20,0.00,0.00,47.20,0.00,0.00,0.00,BRL,0.00,47.20,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Laiane,Xavier Oliveira Souza,--,--,--,--,0.00,0.00,"Laiane Xavier Oliveira Souza || Avenida Torres Tibagy, 784 - Gopouva, Guarulhos - SP, 07062-000, Brasil | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,05:15,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Rua Coronel Macedo, 146 - Taboão, Guarulhos - SP, 07143-540, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,34.80,34.80,gru-23-012,--,23/10/2026 05:42,10/23/2026,02:15,10/23/2026,05:42,10/23/2026,02:42,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,7.30,17,--,Periodic Billing,0.00,0.00,0.00,0.00,34.80,0.00,34.80,0.00,0.00,34.80,0.00,0.00,0.00,BRL,0.00,34.80,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,ELIANE,ROSENDO DA SILVA,--,--,--,--,0.00,0.00,"ELIANE ROSENDO DA SILVA || Rua Coronel Macedo, 146 - Taboão, Guarulhos - SP, 07143-540, Brasil | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,05:25,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Travessa Oziel Alves, 15 - Bonsucesso, Guarulhos - SP, 07179-867, Brasil","Terminal 1, Aeroporto Internacional de São Paulo (GRU) - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,51.80,51.80,gru-23-013,--,23/10/2026 05:52,10/23/2026,02:25,10/23/2026,05:52,10/23/2026,02:52,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,9.90,16,--,Periodic Billing,0.00,0.00,0.00,0.00,51.80,0.00,51.80,0.00,0.00,51.80,0.00,0.00,0.00,BRL,0.00,51.80,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Shelen lorayne,Alves sousa,--,--,--,--,0.00,0.00,"Shelen lorayne Alves sousa || Travessa Oziel Alves, 15 - Bonsucesso, Guarulhos - SP, 07179-867, Brasil | Terminal 1, Aeroporto Internacional de São Paulo (GRU) - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,05:40,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"R. Padre Celestino, 579 - Centro, Guarulhos - SP, 07013-100, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,40.10,40.10,gru-23-014,--,23/10/2026 06:10,10/23/2026,02:40,10/23/2026,06:10,10/23/2026,03:10,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,7.95,22,--,Periodic Billing,0.00,0.00,0.00,0.00,40.10,0.00,40.10,0.00,0.00,40.10,0.00,0.00,0.00,BRL,0.00,40.10,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,INDRID,ARAUJO DE CARVALHO,2,--,--,--,0.00,0.00,"INDRID ARAUJO DE CARVALHO | Andreza Silva Lima || R. Padre Celestino, 579 - Centro, Guarulhos - SP, 07013-100, Brasil | R. Tapaua | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,06:05,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"R. Francisco De Paula Pereira Pacheco N, 172 - Taboão, Guarulhos - SP, 07144-001, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,56.80,56.80,gru-23-015,--,23/10/2026 06:44,10/23/2026,03:05,10/23/2026,06:44,10/23/2026,03:44,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,9.50,33,--,Periodic Billing,0.00,0.00,0.00,0.00,56.80,0.00,56.80,0.00,0.00,56.80,0.00,0.00,0.00,BRL,0.00,56.80,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,VIVIANE,DE OLIVEIRA SOUSA,3,--,--,--,0.00,0.00,"VIVIANE DE OLIVEIRA SOUSA | Guilherme Rosa Pereira | RITA DE CASSIA MARTINS || R. Francisco De Paula Pereira Pacheco N, 172 - Taboão, Guarulhos - SP, 07144-001, Brasil | R. Dr. Roberto Domingos João Rósia | Estr. Elenco | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,06:20,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Rua Teresa Ackel, 431 - Pimentas, Guarulhos - SP, 07260-100, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,62.50,62.50,gru-23-016,--,23/10/2026 06:55,10/23/2026,03:20,10/23/2026,06:55,10/23/2026,03:55,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,14.90,29,--,Periodic Billing,0.00,0.00,0.00,0.00,62.50,0.00,62.50,0.00,0.00,62.50,0.00,0.00,0.00,BRL,0.00,62.50,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,CAMILA HERRERA SILVA,HERRERA SILVA,2,--,--,--,0.00,0.00,"CAMILA HERRERA SILVA HERRERA SILVA | ANA PAULA Monteiro Silva || Rua Teresa Ackel, 431 - Pimentas, Guarulhos - SP, 07260-100, Brasil | Bloco 32 - Av. River | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,06:35,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Rua Antônio Nunes Mineiro, 121 - Picanço, Guarulhos - SP, 07083-000, Brasil","Terminal 2 - R. Interna do Aeroporto Internacional de Guarulhos, s/nº - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,49.20,49.20,gru-23-017,--,23/10/2026 07:12,10/23/2026,03:35,10/23/2026,07:12,10/23/2026,04:12,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,9.10,31,--,Periodic Billing,0.00,0.00,0.00,0.00,49.20,0.00,49.20,0.00,0.00,49.20,0.00,0.00,0.00,BRL,0.00,49.20,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Pamella,Antunes,3,--,--,--,0.00,0.00,"Pamella Antunes | Andressa da silva Xavier | Rayssa Maiara de Souza || Rua Antônio Nunes Mineiro, 121 - Picanço, Guarulhos - SP, 07083-000, Brasil | R. Maria Zintl | R. Manaus | Terminal 2 - R. Interna do Aeroporto Internacional de Guarulhos, s/nº - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,06:45,Henderson,de Moraes,--,Central | UberX,Sao Paulo,"Rua Geraldo José de Moura, 12 - Taboão, Guarulhos - SP, 07144-110, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,37.50,37.50,gru-23-018,--,23/10/2026 07:14,10/23/2026,03:45,10/23/2026,07:14,10/23/2026,04:14,-03:00:00,henderson.moraes@sats.com.sg,Central,Uber Central,Brazil,7.70,18,--,Periodic Billing,0.00,0.00,0.00,0.00,37.50,0.00,37.50,0.00,0.00,37.50,0.00,0.00,0.00,BRL,0.00,37.50,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Natanael,Guedes,--,--,--,--,0.00,0.00,"Natanael Guedes || Rua Geraldo José de Moura, 12 - Taboão, Guarulhos - SP, 07144-110, Brasil | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--
10/23/2026,07:05,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Avenida Rouxinol, 344 - Morros, Guarulhos - SP, 07124-600, Brasil","Rod. Hélio Smidt - Aeroporto Internacional, Guarulhos - SP, 07190, Brasil",Fare,51.40,51.40,gru-23-019,--,23/10/2026 07:38,10/23/2026,04:05,10/23/2026,07:38,10/23/2026,04:38,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,10.70,28,--,Periodic Billing,0.00,0.00,0.00,0.00,51.40,0.00,51.40,0.00,0.00,51.40,0.00,0.00,0.00,BRL,0.00,51.40,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,MATHEUS,MATHIAS,3,--,--,--,0.00,0.00,"MATHEUS MATHIAS | WEEYLLA SILVA FREITAS LEITE | Andréia carla Alves || Avenida Rouxinol, 344 - Morros, Guarulhos - SP, 07124-600, Brasil | R. João Batista Vaz | R. Dr. Carlos Aparecido Rabêlo de Freitas | Rod. Hélio Smidt - Aeroporto Internacional, Guarulhos - SP, 07190, Brasil",--
10/23/2026,07:20,Paulo,Ricardo Santos Ribeiro,--,Central | UberX,Sao Paulo,"Avenida das Margaridas, 330 - São João, Guarulhos - SP, 07161-460, Brasil","Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",Fare,62.10,62.10,gru-23-020,--,23/10/2026 07:52,10/23/2026,04:20,10/23/2026,07:52,10/23/2026,04:52,-03:00:00,paulo.ribeiro@sats.com.sg,Central,Uber Central,Brazil,11.10,24,--,Periodic Billing,0.00,0.00,0.00,0.00,62.10,0.00,62.10,0.00,0.00,62.10,0.00,0.00,0.00,BRL,0.00,62.10,0.00,0.00,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,Kauã,Elias de Sá,2,--,--,--,0.00,0.00,"Kauã Elias de Sá | Lucas Morais da Silva || Avenida das Margaridas, 330 - São João, Guarulhos - SP, 07161-460, Brasil | Av. José Brumatti | Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP, 07190-100, Brasil",--`;

    const res = this.importFromCsvText(day23Csv, 'merge');
    return {
      success: res.success,
      count: res.count,
      newTripsCount: res.newTripsCount,
      dates: res.dates,
      latestDate: '2026-10-23',
      error: res.error,
    };
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
