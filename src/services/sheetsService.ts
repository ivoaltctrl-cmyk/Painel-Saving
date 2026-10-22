import { UberCsvTripRecord, GoogleSheetsConfig, ExecutiveBoardComparison, DailySavingRecord } from '../types/mobility';
import { CsvParserService } from './csvParserService';

const LOCAL_STORAGE_UBER_TRIPS = 'mobility_uber_trips_data_v2';
const LOCAL_STORAGE_SHEETS_CONFIG = 'mobility_sheets_config_v2';
const LOCAL_STORAGE_TAXI_RATE = 'mobility_taxi_ref_rate_v2';

export const DEFAULT_TAXI_RATE = 146.06;

export class SheetsService {
  private static trips: UberCsvTripRecord[] = [];
  private static taxiRate: number = DEFAULT_TAXI_RATE;
  private static config: GoogleSheetsConfig = {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_SavingTransporteAvulso/pub?output=csv',
    lastSyncedAt: '22/10/2026 11:38',
    status: 'synced',
    autoSyncIntervalMinutes: 15,
    taxiReferenceRate: DEFAULT_TAXI_RATE,
  };

  /**
   * Converte uma URL comum do Google Sheets para o link direto de exportação CSV
   */
  public static normalizeGoogleSheetsUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();

    // Se já for link de exportação ou pub?output=csv
    if (trimmed.includes('export?format=csv') || trimmed.includes('output=csv')) {
      return trimmed;
    }

    // Padrão: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid={GID}
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      const gidMatch = trimmed.match(/[#&]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }

    return trimmed;
  }

  public static getTaxiReferenceRate(): number {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_TAXI_RATE);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed > 0) {
          this.taxiRate = parsed;
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return this.taxiRate;
  }

  public static setTaxiReferenceRate(newRate: number): void {
    this.taxiRate = newRate;
    try {
      localStorage.setItem(LOCAL_STORAGE_TAXI_RATE, newRate.toString());
    } catch {
      // fallback
    }
    // Atualiza os registros com a nova taxa
    this.trips = this.trips.map(t => {
      const saving = Math.round((newRate - t.valueBrl) * 100) / 100;
      const savingPercent = newRate > 0 ? Math.round((saving / newRate) * 1000) / 10 : 0;
      return {
        ...t,
        taxiReferenceCost: newRate,
        saving,
        savingPercent,
      };
    });
    this.saveTrips();
  }

  public static getConfig(): GoogleSheetsConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SHEETS_CONFIG);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    this.config.taxiReferenceRate = this.getTaxiReferenceRate();
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
    if (this.trips.length > 0) {
      return this.trips;
    }

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

  /**
   * Carrega a base padrão inicial a partir do arquivo CSV local
   */
  public static async loadInitialData(): Promise<UberCsvTripRecord[]> {
    const currentRate = this.getTaxiReferenceRate();

    // Se já existem registros em cache com a contagem esperada
    const existing = this.getTrips();
    if (existing.length >= 50) {
      return existing;
    }

    try {
      const response = await fetch('/assets/aistudio/SavingTransporteAvulso_-_Dados_Uber_fb6e558e.csv');
      if (response.ok) {
        const text = await response.text();
        const parsed = CsvParserService.parseUberCsv(text, currentRate);
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

  /**
   * Sincroniza via URL de Google Sheets ou arquivo
   */
  public static async syncFromGoogleSheets(urlInput: string): Promise<{ success: boolean; count: number; error?: string }> {
    const directUrl = this.normalizeGoogleSheetsUrl(urlInput);
    this.saveConfig({ sheetUrl: urlInput, status: 'syncing' });

    try {
      // Tenta via backend proxy para evitar problemas de CORS
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

      const rate = this.getTaxiReferenceRate();
      const parsed = CsvParserService.parseUberCsv(csvContent, rate);

      if (parsed.length === 0) {
        throw new Error('Nenhum registro válido encontrado no arquivo ou planilha.');
      }

      this.trips = parsed;
      this.saveTrips();

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
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

  /**
   * Importa a partir de texto CSV enviado pelo usuário (upload de arquivo)
   */
  public static importFromCsvText(csvText: string): { success: boolean; count: number; error?: string } {
    try {
      const rate = this.getTaxiReferenceRate();
      const parsed = CsvParserService.parseUberCsv(csvText, rate);
      if (parsed.length === 0) {
        return { success: false, count: 0, error: 'O arquivo não continha registros válidos de corrida.' };
      }

      this.trips = parsed;
      this.saveTrips();

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      this.saveConfig({ status: 'synced', lastSyncedAt: timestamp });

      return { success: true, count: parsed.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Erro ao processar arquivo CSV.' };
    }
  }

  /**
   * Gera o relatório oficial executivo para o e-mail da Diretoria
   */
  public static getBoardReports(selectedDate = '2026-10-22'): {
    dailyComparison: ExecutiveBoardComparison;
    accumulatedComparison: ExecutiveBoardComparison;
    allTrips: UberCsvTripRecord[];
    availableDates: string[];
    dailyRecords: DailySavingRecord[];
  } {
    const trips = this.getTrips();
    const rate = this.getTaxiReferenceRate();

    // Datas disponíveis
    const datesSet = new Set<string>();
    trips.forEach(t => {
      if (t.requestDateLocal) datesSet.add(t.requestDateLocal);
    });
    const availableDates = Array.from(datesSet).sort();

    // Se a data selecionada não existir, usa a mais recente
    const activeDate = datesSet.has(selectedDate) ? selectedDate : (availableDates[availableDates.length - 1] || '2026-10-22');

    // Trips do dia
    const dayTrips = trips.filter(t => t.requestDateLocal === activeDate);
    const dayParts = activeDate.split('-');
    const dayFormatted = dayParts.length === 3 ? `${dayParts[2]}/${dayParts[1]}/${dayParts[0]}` : activeDate;

    const dailyComparison = CsvParserService.calculateBoardIndicators(
      dayTrips,
      rate,
      `Indicadores comparativos — Táxi x Uber | ${dayFormatted}`
    );

    // Accumulated (todas as corridas)
    const accTitle = availableDates.length > 1
      ? `Acumulado — ${availableDates.map(d => d.split('-')[2] + '/' + d.split('-')[1]).join(' e ')}`
      : `Acumulado — Período Completo`;

    const accumulatedComparison = CsvParserService.calculateBoardIndicators(
      trips,
      rate,
      accTitle
    );

    const dailyRecords = CsvParserService.calculateDailyRecords(trips, rate);

    return {
      dailyComparison,
      accumulatedComparison,
      allTrips: trips,
      availableDates,
      dailyRecords,
    };
  }
}
