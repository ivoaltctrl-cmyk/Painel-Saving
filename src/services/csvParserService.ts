import { UberCsvTripRecord, BoardIndicators, ExecutiveBoardComparison, DailySavingRecord } from '../types/mobility';

export class CsvParserService {
  /**
   * Divide uma linha de CSV respeitando aspas duplas
   */
  public static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  /**
   * Converte texto de data MM/DD/YYYY para YYYY-MM-DD
   */
  public static parseDateToIso(dateStr: string): string {
    if (!dateStr || dateStr === '--') return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // Formato MM/DD/YYYY comum na exportação Uber
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return dateStr;
  }

  /**
   * Extrai passageiros e contagem a partir de 'Informações da parada', 'Várias paradas' e nomes
   */
  public static extractPassengerInfo(stopInfo: string, multipleStopsCol: string, guestFirst: string, guestLast: string): { count: number; names: string[] } {
    const names: string[] = [];
    let count = 1;

    if (stopInfo && stopInfo !== '--') {
      // O formato típico da parada no Uber Central é:
      // "PASSAGEIRO 1 | PASSAGEIRO 2 || Origem | Parada 1 | Destino"
      const parts = stopInfo.split('||');
      if (parts.length >= 1) {
        const rawNames = parts[0].split('|').map(n => n.trim()).filter(n => n.length > 0);
        if (rawNames.length > 0) {
          rawNames.forEach(n => names.push(n));
          count = rawNames.length;
        }
      }
    }

    if (names.length === 0) {
      const combined = `${guestFirst} ${guestLast}`.trim();
      if (combined && combined !== '--') {
        names.push(combined);
      }
    }

    // Se a coluna de paradas indicar número maior
    const parsedStops = parseInt(multipleStopsCol, 10);
    if (!isNaN(parsedStops) && parsedStops > count) {
      count = parsedStops;
    }

    return {
      count: Math.max(1, count),
      names: names.length > 0 ? names : ['Colaborador'],
    };
  }

  /**
   * Converte texto CSV completo em array tipado de UberCsvTripRecord
   */
  public static parseUberCsv(csvText: string, taxiReferenceRate = 146.06): UberCsvTripRecord[] {
    const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length < 2) return [];

    const header = this.parseCsvLine(rawLines[0]);

    // Índices de colunas chave
    const dateLocalIdx = header.indexOf('Data da solicitação (local)');
    const timeLocalIdx = header.indexOf('Hora da solicitação (local)');
    const dateUtcIdx = header.indexOf('Data da solicitação (UTC)');
    const timeUtcIdx = header.indexOf('Hora da solicitação (UTC)');
    const firstNameIdx = header.indexOf('Nome');
    const lastNameIdx = header.indexOf('Sobrenome');
    const emailIdx = header.indexOf('E-mail');
    const serviceIdx = header.indexOf('Serviço');
    const cityIdx = header.indexOf('Cidade');
    const originIdx = header.indexOf('Endereço de partida');
    const destIdx = header.indexOf('Endereço de destino');
    const valueBrlIdx = header.indexOf('Valor da transação: BRL');
    const totalBrlIdx = header.indexOf('Valor total: BRL');
    const tripIdIdx = header.indexOf('ID da viagem/Uber Eats');
    const distMiIdx = header.indexOf('Distância (mi)');
    const durationIdx = header.indexOf('Duração (min)');
    const guestFirstIdx = header.indexOf('Nome do convidado');
    const guestLastIdx = header.indexOf('Sobrenome do convidado');
    const multipleStopsIdx = header.indexOf('Várias paradas');
    const stopInfoIdx = header.indexOf('Informações da parada');

    const records: UberCsvTripRecord[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cols = this.parseCsvLine(rawLines[i]);
      if (cols.length < 10) continue;

      const rawVal = cols[totalBrlIdx >= 0 ? totalBrlIdx : valueBrlIdx] || cols[11] || '0';
      const valueBrl = parseFloat(rawVal.replace(',', '.')) || 0;

      // Pula registros zerados ou cancelados sem custo se houver
      if (valueBrl <= 0) continue;

      const rawDateLocal = cols[dateLocalIdx >= 0 ? dateLocalIdx : 15] || cols[0];
      const isoDate = this.parseDateToIso(rawDateLocal);
      const timeLocal = cols[timeLocalIdx >= 0 ? timeLocalIdx : 16] || cols[1] || '00:00';

      const booker = `${cols[firstNameIdx >= 0 ? firstNameIdx : 2] || ''} ${cols[lastNameIdx >= 0 ? lastNameIdx : 3] || ''}`.trim();

      const stopInfo = cols[stopInfoIdx >= 0 ? stopInfoIdx : 72] || '';
      const multipleStops = cols[multipleStopsIdx >= 0 ? multipleStopsIdx : 67] || '';
      const guestFirst = cols[guestFirstIdx >= 0 ? guestFirstIdx : 65] || '';
      const guestLast = cols[guestLastIdx >= 0 ? guestLastIdx : 66] || '';

      const passengerInfo = this.extractPassengerInfo(stopInfo, multipleStops, guestFirst, guestLast);

      const distMi = parseFloat(cols[distMiIdx >= 0 ? distMiIdx : 26] || '0') || 0;
      const durationMin = parseInt(cols[durationIdx >= 0 ? durationIdx : 27] || '0', 10) || 0;

      const saving = Math.round((taxiReferenceRate - valueBrl) * 100) / 100;
      const savingPercent = taxiReferenceRate > 0 ? Math.round((saving / taxiReferenceRate) * 1000) / 10 : 0;

      records.push({
        id: cols[tripIdIdx >= 0 ? tripIdIdx : 12] || `TRIP-${i}`,
        requestDateUtc: cols[dateUtcIdx >= 0 ? dateUtcIdx : 0] || '',
        requestTimeUtc: cols[timeUtcIdx >= 0 ? timeUtcIdx : 1] || '',
        requestDateLocal: isoDate,
        requestTimeLocal: timeLocal,
        bookerName: booker || 'Paulo Ricardo Santos Ribeiro',
        email: cols[emailIdx >= 0 ? emailIdx : 22] || '',
        service: cols[serviceIdx >= 0 ? serviceIdx : 5] || 'Central | UberX',
        city: cols[cityIdx >= 0 ? cityIdx : 6] || 'Sao Paulo',
        origin: cols[originIdx >= 0 ? originIdx : 7] || '',
        destination: cols[destIdx >= 0 ? destIdx : 8] || '',
        valueBrl,
        distanceMiles: distMi,
        distanceKm: Math.round((distMi * 1.60934) * 10) / 10,
        durationMin,
        passengerCount: passengerInfo.count,
        passengerNames: passengerInfo.names,
        stopInfo,
        multipleStops: parseInt(multipleStops, 10) || passengerInfo.count,
        taxiReferenceCost: taxiReferenceRate,
        saving,
        savingPercent,
      });
    }

    return records;
  }

  /**
   * Calcula a mediana de um array de números
   */
  public static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }

  /**
   * Gera os indicadores executivos do quadro oficial de diretoria para um conjunto de registros
   */
  public static calculateBoardIndicators(trips: UberCsvTripRecord[], taxiReferenceRate = 146.06, scopeTitle = ''): ExecutiveBoardComparison {
    const tripCount = trips.length;

    if (tripCount === 0) {
      const emptyIndicators: BoardIndicators = {
        tripCount: 0,
        avgCostPerTrip: 0,
        totalCost: 0,
        economyPerTrip: 0,
        costReductionPercent: 0,
        medianCost: 0,
        totalPassengers: 0,
        avgCostPerPassenger: 0,
      };
      return {
        scopeTitle,
        taxiReferenceRate,
        taxi: { ...emptyIndicators, avgCostPerTrip: taxiReferenceRate, medianCost: taxiReferenceRate },
        uber: emptyIndicators,
      };
    }

    // Uber values
    const uberTotal = Math.round(trips.reduce((acc, t) => acc + t.valueBrl, 0) * 100) / 100;
    const uberAvg = Math.round((uberTotal / tripCount) * 100) / 100;
    const uberMedian = this.calculateMedian(trips.map(t => t.valueBrl));

    // Taxi values (Reference)
    const taxiTotal = Math.round((tripCount * taxiReferenceRate) * 100) / 100;
    const taxiAvg = taxiReferenceRate;
    const taxiMedian = taxiReferenceRate;

    // Total de passageiros
    const totalPassengers = trips.reduce((acc, t) => acc + t.passengerCount, 0);

    // Economia
    const totalEconomy = Math.round((taxiTotal - uberTotal) * 100) / 100;
    const economyPerTrip = Math.round((totalEconomy / tripCount) * 100) / 100;
    const costReductionPercent = taxiTotal > 0 ? Math.round((totalEconomy / taxiTotal) * 1000) / 10 : 0;

    // Médias por passageiro
    const taxiAvgPerPassenger = totalPassengers > 0 ? Math.round((taxiTotal / totalPassengers) * 100) / 100 : 0;
    const uberAvgPerPassenger = totalPassengers > 0 ? Math.round((uberTotal / totalPassengers) * 100) / 100 : 0;

    return {
      scopeTitle,
      taxiReferenceRate,
      taxi: {
        tripCount,
        avgCostPerTrip: taxiAvg,
        totalCost: taxiTotal,
        economyPerTrip: 0,
        costReductionPercent: 0,
        medianCost: taxiMedian,
        totalPassengers,
        avgCostPerPassenger: taxiAvgPerPassenger,
      },
      uber: {
        tripCount,
        avgCostPerTrip: uberAvg,
        totalCost: uberTotal,
        economyPerTrip,
        costReductionPercent,
        medianCost: uberMedian,
        totalPassengers,
        avgCostPerPassenger: uberAvgPerPassenger,
      },
    };
  }

  /**
   * Agrupa e gera a evolução diária de saving
   */
  public static calculateDailyRecords(trips: UberCsvTripRecord[], taxiReferenceRate = 146.06): DailySavingRecord[] {
    const dateMap = new Map<string, UberCsvTripRecord[]>();

    trips.forEach(t => {
      const dateKey = t.requestDateLocal || 'Indefinido';
      const list = dateMap.get(dateKey) || [];
      list.push(t);
      dateMap.set(dateKey, list);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    let cumulative = 0;

    return sortedDates.map(dateKey => {
      const dayTrips = dateMap.get(dateKey)!;
      const count = dayTrips.length;
      const uberSpend = Math.round(dayTrips.reduce((acc, t) => acc + t.valueBrl, 0) * 100) / 100;
      const taxiSpend = Math.round((count * taxiReferenceRate) * 100) / 100;
      const saving = Math.round((taxiSpend - uberSpend) * 100) / 100;
      const savingPercent = taxiSpend > 0 ? Math.round((saving / taxiSpend) * 1000) / 10 : 0;
      const passengers = dayTrips.reduce((acc, t) => acc + t.passengerCount, 0);
      cumulative += saving;

      const parts = dateKey.split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateKey;

      return {
        date: dateKey,
        displayDate,
        uberSpend,
        taxiSpend,
        saving,
        savingPercent,
        tripCount: count,
        passengerCount: passengers,
        avgUberPerPassenger: passengers > 0 ? Math.round((uberSpend / passengers) * 100) / 100 : 0,
        avgTaxiPerPassenger: passengers > 0 ? Math.round((taxiSpend / passengers) * 100) / 100 : 0,
        cumulativeSaving: Math.round(cumulative * 100) / 100,
      };
    });
  }
}
