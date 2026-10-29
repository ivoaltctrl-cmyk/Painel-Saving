import { 
  UberCsvTripRecord, 
  BoardIndicators, 
  ExecutiveBoardComparison, 
  DailySavingRecord,
  ContractTariffPeriod,
  TaxiScenario,
  BreakdownSlice
} from '../types/mobility';

export class CsvParserService {
  /**
   * Detecta se o CSV utiliza ponto-e-vírgula (padrão Excel Brasil) ou vírgula
   */
  public static detectDelimiter(firstLine: string): string {
    let inQuotes = false;
    let commas = 0;
    let semicolons = 0;

    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes) {
        if (char === ';') semicolons++;
        else if (char === ',') commas++;
      }
    }
    return semicolons > commas ? ';' : ',';
  }

  /**
   * Divide uma linha de CSV respeitando aspas duplas e o delimitador detectado
   */
  public static parseCsvLine(line: string, delimiter: string = ','): string[] {
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
      } else if (char === delimiter && !inQuotes) {
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
   * Converte texto de data (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, com ou sem horário) para YYYY-MM-DD
   */
  public static parseDateToIso(dateStr: string): string {
    if (!dateStr || dateStr === '--') return '';
    const trimmed = dateStr.trim();
    // Remove parte de horário se presente (ex: "23/10/2026 04:00" -> "23/10/2026")
    const dateOnly = trimmed.split(/[ T]/)[0];

    if (dateOnly.includes('/')) {
      const parts = dateOnly.split('/');
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let year = parts[2].trim();
        if (year.length === 2) year = `20${year}`;

        // Se o primeiro número for > 12, com certeza é DIA (ex: 23/10/2026)
        if (p0 > 12) {
          const day = String(p0).padStart(2, '0');
          const month = String(p1).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        // Se o segundo número for > 12, com certeza é DIA e o primeiro é MÊS (ex: 10/23/2026)
        if (p1 > 12) {
          const month = String(p0).padStart(2, '0');
          const day = String(p1).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        // Se ambos <= 12 e o ano tem 4 dígitos: no Brasil, se veio de exportação Uber em PT-BR,
        // pode ser DD/MM/YYYY ou MM/DD/YYYY. Se o mês 10/21/2026 era MM/DD/YYYY nos arquivos anteriores:
        // Mantemos coerência: se p0 for 10 e p1 for <= 31, no Uber original era MM/DD/YYYY.
        // Mas se for 23, p0 > 12 cai na regra acima garantindo 2026-10-23!
        const month = String(p0).padStart(2, '0');
        const day = String(p1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    if (dateOnly.includes('-')) {
      const parts = dateOnly.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          // DD-MM-YYYY
          const p0 = parseInt(parts[0], 10);
          const p1 = parseInt(parts[1], 10);
          const year = parts[2].trim();
          if (p0 > 12) {
            return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
          }
          return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        }
      }
    }

    return dateOnly;
  }

  /**
   * Determina o turno com base no horário local (HH:mm)
   */
  public static determineShift(timeStr: string): 'Madrugada' | 'Manhã' | 'Tarde' | 'Noite' {
    if (!timeStr) return 'Madrugada';
    const hour = parseInt(timeStr.split(':')[0], 10);
    if (isNaN(hour)) return 'Madrugada';

    if (hour >= 0 && hour < 6) return 'Madrugada';
    if (hour >= 6 && hour < 12) return 'Manhã';
    if (hour >= 12 && hour < 18) return 'Tarde';
    return 'Noite';
  }

  /**
   * Extrai o bairro ou região a partir do endereço de destino
   */
  public static extractDistrict(destination: string): string {
    if (!destination) return 'Outros';

    // Ex: "Rua André Paperini, 414 - Pimentas, Guarulhos - SP, 07260-460, Brasil"
    const hyphenParts = destination.split('-');
    if (hyphenParts.length >= 2) {
      const candidate = hyphenParts[1].split(',')[0].trim();
      if (candidate && candidate.length > 2 && candidate.length < 35 && !candidate.includes('SP')) {
        return candidate;
      }
    }

    // Se tiver paradas múltiplas ou formato alternativo
    const commaParts = destination.split(',');
    if (commaParts.length >= 2) {
      const candidate = commaParts[1].trim();
      if (candidate && !candidate.startsWith('s/n') && !candidate.startsWith('nº')) {
        return candidate;
      }
    }

    return 'Guarulhos / Região';
  }

  /**
   * Extrai passageiros e contagem a partir de 'Informações da parada', 'Várias paradas' e nomes
   */
  /**
   * Extrai passageiros e contagem a partir de 'Informações da parada', 'Várias paradas', nomes de convidados e coluna Total Passageiro
   */
  public static extractPassengerInfo(
    stopInfo: string, 
    multipleStopsCol: string, 
    guestFirst: string, 
    guestLast: string,
    totalPassengerCol?: string
  ): { count: number; names: string[] } {
    const names: string[] = [];
    let count = 1;

    if (stopInfo && stopInfo !== '--') {
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

    const parsedStops = parseInt(multipleStopsCol, 10);
    if (!isNaN(parsedStops) && parsedStops > count) {
      count = parsedStops;
    }

    if (totalPassengerCol) {
      const cleanPass = totalPassengerCol.replace(',', '.').trim();
      const parsedPass = parseInt(cleanPass, 10);
      if (!isNaN(parsedPass) && parsedPass > count) {
        count = parsedPass;
      }
    }

    return {
      count: Math.max(1, count),
      names: names.length > 0 ? names : ['Colaborador'],
    };
  }

  /**
   * Busca a tarifa de referência da vigência aplicável à data da corrida
   */
  public static findTariffForDate(dateIso: string, periods: ContractTariffPeriod[]): { rate: number; periodSource: string } {
    if (!periods || periods.length === 0) {
      return { rate: 146.06, periodSource: 'Tarifa Contratual Padrão' };
    }

    for (const p of periods) {
      const startMatch = !p.startDate || dateIso >= p.startDate;
      const endMatch = !p.endDate || dateIso <= p.endDate;
      if (startMatch && endMatch) {
        return { rate: p.rate, periodSource: p.contractSource };
      }
    }

    // Se nenhuma bateu, retorna a mais recente
    const last = periods[periods.length - 1];
    return { rate: last.rate, periodSource: last.contractSource };
  }

  /**
   * Converte texto CSV completo em array tipado de UberCsvTripRecord.
   * Suporta dinamicamente o novo padrão de colunas Uber (ID Viagem na Col 0, Valor na Col 6, etc.),
   * o formato anterior da Uber e planilhas com cabeçalhos duplos.
   */
  public static parseUberCsv(
    csvText: string, 
    periods: ContractTariffPeriod[],
    scenario: TaxiScenario = 1.0
  ): UberCsvTripRecord[] {
    const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length < 2) return [];

    const delimiter = this.detectDelimiter(rawLines[0]);

    // Identifica linhas que são cabeçalhos no topo do arquivo (ex.: quando há cabeçalho antigo e novo simultaneamente)
    const isHeaderLine = (cols: string[]): boolean => {
      if (!cols || cols.length === 0) return false;
      const first = (cols[0] || '').trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(first)) return false; // É UUID de viagem
      if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(first)) return false; // É data

      const joined = cols.slice(0, 20).join(' ').toLowerCase();
      return (
        joined.includes('data da solicita') ||
        joined.includes('hora da solicita') ||
        joined.includes('id da viagem') ||
        joined.includes('endereço') ||
        joined.includes('endereco') ||
        joined.includes('serviço') ||
        joined.includes('servico') ||
        joined.includes('valor total') ||
        joined.includes('valor da transa') ||
        joined.includes('tipo de transa') ||
        joined.includes('informações da parada') ||
        joined.includes('total passageiro')
      );
    };

    const headerIndices: number[] = [];
    for (let i = 0; i < Math.min(5, rawLines.length); i++) {
      const cols = this.parseCsvLine(rawLines[i], delimiter);
      if (isHeaderLine(cols)) {
        headerIndices.push(i);
      }
    }

    // Se encontramos cabeçalho, selecionamos o mais próximo dos dados (o último)
    const activeHeaderIdx = headerIndices.length > 0 ? headerIndices[headerIndices.length - 1] : 0;
    const headerCols = this.parseCsvLine(rawLines[activeHeaderIdx], delimiter);
    const normalizedHeader = headerCols.map(h => h.trim().toLowerCase());

    const findCol = (...candidates: string[]) => {
      for (const cand of candidates) {
        const lower = cand.toLowerCase();
        const idx = normalizedHeader.indexOf(lower);
        if (idx >= 0) return idx;
      }
      for (const cand of candidates) {
        const lower = cand.toLowerCase();
        const partialIdx = normalizedHeader.findIndex(h => h && h.includes(lower));
        if (partialIdx >= 0) return partialIdx;
      }
      return -1;
    };

    // Mapeamento dinâmico baseado no cabeçalho
    const dynTripIdIdx = findCol('id da viagem/uber eats', 'id da viagem', 'id viagem');
    const dynDateLocalIdx = findCol('data da solicitação (local)', 'data da solicitacao (local)', 'data (local)');
    const dynTimeLocalIdx = findCol('hora da solicitação (local)', 'hora da solicitacao (local)', 'hora (local)');
    const dynDateUtcIdx = findCol('data da solicitação (utc)', 'data da solicitacao (utc)', 'data (utc)');
    const dynTimeUtcIdx = findCol('hora da solicitação (utc)', 'hora da solicitacao (utc)', 'hora (utc)');
    const dynFirstNameIdx = findCol('nome');
    const dynLastNameIdx = findCol('sobrenome');
    const dynEmailIdx = findCol('e-mail', 'email');
    const dynServiceIdx = findCol('serviço', 'servico');
    const dynCityIdx = findCol('cidade');
    const dynOriginIdx = findCol('endereço de partida', 'endereco de partida', 'origem');
    const dynDestIdx = findCol('endereço de destino', 'endereco de destino', 'destino');
    const dynTotalBrlIdx = findCol('valor total: brl', 'valor total (brl)', 'valor total');
    const dynValueBrlIdx = findCol('valor da transação: brl', 'valor da transacao: brl', 'valor: brl');
    const dynDistMiIdx = findCol('distância (mi)', 'distancia (mi)', 'distância', 'distancia');
    const dynDurationIdx = findCol('duração (min)', 'duracao (min)', 'duração', 'duracao');
    const dynCostCenterIdx = findCol('código da despesa', 'codigo da despesa', 'centro de custo');
    const dynGroupIdx = findCol('grupo');
    const dynGuestFirstIdx = findCol('nome do convidado', 'nome convidado');
    const dynGuestLastIdx = findCol('sobrenome do convidado', 'sobrenome convidado');
    const dynMultipleStopsIdx = findCol('várias paradas', 'varias paradas');
    const dynStopInfoIdx = findCol('informações da parada', 'informacoes da parada', 'paradas');
    const dynPassengerCountIdx = findCol('total passageiro', 'total passageiros', 'passageiros');

    const parseNum = (str: string | undefined): number => {
      if (!str) return 0;
      let clean = str.replace(/[R$\s]/g, '').trim();
      if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      const val = parseFloat(clean);
      return !isNaN(val) ? val : 0;
    };

    const records: UberCsvTripRecord[] = [];
    const dataStartLine = headerIndices.length > 0 ? (headerIndices[headerIndices.length - 1] + 1) : 1;

    for (let i = dataStartLine; i < rawLines.length; i++) {
      const cols = this.parseCsvLine(rawLines[i], delimiter);
      if (cols.length < 5) continue;

      // Descarta linhas de cabeçalho
      if (isHeaderLine(cols)) continue;

      const firstCol = (cols[0] || '').trim();

      // Uma linha só é considerada vazia residual se NÃO possuir nenhuma informação de viagem
      // (linhas em branco no fim da planilha onde uma fórmula na coluna final gera 0,00).
      // Se a linha tem ID de viagem, Endereço de partida, Destino ou Data, ela é uma corrida REAL.
      const hasTripIdentity = Boolean(
        (firstCol && firstCol.length > 3 && firstCol !== '--') ||
        (cols[4] && cols[4].trim().length > 3) ||
        (cols[5] && cols[5].trim().length > 3) ||
        (cols[7] && cols[7].trim().length >= 6)
      );
      if (!hasTripIdentity) continue;

      const isUuidStart = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(firstCol) || (firstCol.length > 10 && firstCol.includes('-') && !firstCol.includes('/'));
      const isDateStart = /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(firstCol);

      // Determina se esta linha segue o NOVO padrão (ID na Col 0, Valor na Col 6, etc.) ou o padrão ANTERIOR
      const isNewLayout = isUuidStart || dynTripIdIdx === 0 || (dynTotalBrlIdx === 6);

      // 1. Valor da corrida (BRL)
      let valueBrl = 0;
      if (isNewLayout) {
        valueBrl = parseNum(cols[dynTotalBrlIdx >= 0 ? dynTotalBrlIdx : 6]);
        if (valueBrl <= 0 && dynValueBrlIdx >= 0) valueBrl = parseNum(cols[dynValueBrlIdx]);
        if (valueBrl <= 0) valueBrl = parseNum(cols[6]);
      } else {
        valueBrl = parseNum(cols[dynTotalBrlIdx >= 0 && parseNum(cols[dynTotalBrlIdx]) > 0 ? dynTotalBrlIdx : (dynValueBrlIdx >= 0 ? dynValueBrlIdx : 11)]);
        if (valueBrl <= 0 && cols[45]) valueBrl = parseNum(cols[45]);
        if (valueBrl <= 0 && cols[11]) valueBrl = parseNum(cols[11]);
      }

      // Descarta apenas estornos/créditos negativos de fatura
      if (valueBrl < 0) continue;

      // Se o valor for exatamente 0, verifica se é uma corrida cancelada não realizada
      const cancelType = (isNewLayout ? cols[13] : cols[70]) || '';
      if (valueBrl === 0 && cancelType && cancelType !== '--' && !cols[4]) continue;

      // 2. Data e Horário Local
      let rawDateLocal = '';
      let timeLocal = '';

      if (isNewLayout) {
        rawDateLocal = cols[dynDateLocalIdx >= 0 ? dynDateLocalIdx : 7] || cols[7] || '';
        timeLocal = cols[dynTimeLocalIdx >= 0 ? dynTimeLocalIdx : 8] || cols[8] || '00:00';
      } else {
        rawDateLocal = cols[dynDateLocalIdx >= 0 ? dynDateLocalIdx : 15] || cols[15] || cols[0] || '';
        timeLocal = cols[dynTimeLocalIdx >= 0 ? dynTimeLocalIdx : 16] || cols[16] || cols[1] || '00:00';
      }

      // Validação de fallback para data e hora
      if (!rawDateLocal || (!rawDateLocal.includes('/') && !rawDateLocal.includes('-'))) {
        if (cols[7] && (cols[7].includes('/') || cols[7].includes('-'))) rawDateLocal = cols[7];
        else if (cols[15] && (cols[15].includes('/') || cols[15].includes('-'))) rawDateLocal = cols[15];
        else if (cols[0] && (cols[0].includes('/') || cols[0].includes('-'))) rawDateLocal = cols[0];
      }
      if (!timeLocal || !timeLocal.includes(':')) {
        if (cols[8] && cols[8].includes(':')) timeLocal = cols[8];
        else if (cols[16] && cols[16].includes(':')) timeLocal = cols[16];
        else if (cols[1] && cols[1].includes(':')) timeLocal = cols[1];
        else timeLocal = '00:00';
      }

      const isoDate = this.parseDateToIso(rawDateLocal);
      if (!isoDate) continue;

      // 3. ID da viagem
      const tripId = isNewLayout
        ? (cols[dynTripIdIdx >= 0 ? dynTripIdIdx : 0] || cols[0] || `TRIP-${i}`)
        : (cols[dynTripIdIdx >= 0 ? dynTripIdIdx : 12] || cols[12] || `TRIP-${i}`);

      // 4. Solicitante / Colaborador
      const firstName = isNewLayout
        ? (cols[dynFirstNameIdx >= 0 ? dynFirstNameIdx : 1] || cols[1] || '')
        : (cols[dynFirstNameIdx >= 0 ? dynFirstNameIdx : 2] || cols[2] || '');
      const lastName = isNewLayout
        ? (cols[dynLastNameIdx >= 0 ? dynLastNameIdx : 2] || cols[2] || '')
        : (cols[dynLastNameIdx >= 0 ? dynLastNameIdx : 3] || cols[3] || '');
      const booker = `${firstName} ${lastName}`.trim() || 'Paulo Ricardo Santos Ribeiro';

      // 5. Origem, Destino e Bairro
      const origin = isNewLayout
        ? (cols[dynOriginIdx >= 0 ? dynOriginIdx : 4] || cols[4] || '')
        : (cols[dynOriginIdx >= 0 ? dynOriginIdx : 7] || cols[7] || '');
      const destination = isNewLayout
        ? (cols[dynDestIdx >= 0 ? dynDestIdx : 5] || cols[5] || '')
        : (cols[dynDestIdx >= 0 ? dynDestIdx : 8] || cols[8] || '');
      const district = this.extractDistrict(destination);
      const shift = this.determineShift(timeLocal);

      // 6. Serviço e Cidade
      const service = isNewLayout
        ? (cols[dynServiceIdx >= 0 ? dynServiceIdx : 3] || cols[3] || 'Central | UberX')
        : (cols[dynServiceIdx >= 0 ? dynServiceIdx : 5] || cols[5] || 'Central | UberX');
      const city = isNewLayout
        ? (cols[dynCityIdx >= 0 ? dynCityIdx : 24] || cols[24] || 'Sao Paulo')
        : (cols[dynCityIdx >= 0 ? dynCityIdx : 6] || cols[6] || 'Sao Paulo');

      // 7. E-mail e Centro de Custo
      const email = isNewLayout
        ? (cols[dynEmailIdx >= 0 ? dynEmailIdx : 20] || cols[20] || '')
        : (cols[dynEmailIdx >= 0 ? dynEmailIdx : 22] || cols[22] || '');

      const rawCostCenter = isNewLayout
        ? (cols[dynCostCenterIdx >= 0 ? dynCostCenterIdx : 28] || cols[28] || cols[dynGroupIdx >= 0 ? dynGroupIdx : 22] || '--')
        : (cols[dynCostCenterIdx >= 0 ? dynCostCenterIdx : 28] || cols[28] || cols[dynGroupIdx >= 0 ? dynGroupIdx : 23] || '--');
      const costCenter = (rawCostCenter && rawCostCenter !== '--') ? rawCostCenter : 'Operações GRU';

      // 8. Distância e Duração
      const rawDist = isNewLayout
        ? (cols[dynDistMiIdx >= 0 ? dynDistMiIdx : 26] || cols[26] || '0')
        : (cols[dynDistMiIdx >= 0 ? dynDistMiIdx : 26] || cols[26] || '0');
      const distMi = parseNum(rawDist);

      const rawDur = isNewLayout
        ? (cols[dynDurationIdx >= 0 ? dynDurationIdx : 27] || cols[27] || '0')
        : (cols[dynDurationIdx >= 0 ? dynDurationIdx : 27] || cols[27] || '0');
      const durationMin = Math.round(parseNum(rawDur));

      // 9. Passageiros e Paradas
      const stopInfo = isNewLayout
        ? (cols[dynStopInfoIdx >= 0 ? dynStopInfoIdx : 11] || cols[11] || '')
        : (cols[dynStopInfoIdx >= 0 ? dynStopInfoIdx : 73] || cols[73] || '');
      const multipleStops = isNewLayout
        ? (cols[dynMultipleStopsIdx >= 0 ? dynMultipleStopsIdx : 70] || cols[70] || '')
        : (cols[dynMultipleStopsIdx >= 0 ? dynMultipleStopsIdx : 67] || cols[67] || '');
      const guestFirst = isNewLayout
        ? (cols[dynGuestFirstIdx >= 0 ? dynGuestFirstIdx : 68] || cols[68] || '')
        : (cols[dynGuestFirstIdx >= 0 ? dynGuestFirstIdx : 65] || cols[65] || '');
      const guestLast = isNewLayout
        ? (cols[dynGuestLastIdx >= 0 ? dynGuestLastIdx : 69] || cols[69] || '')
        : (cols[dynGuestLastIdx >= 0 ? dynGuestLastIdx : 66] || cols[66] || '');
      const totalPassengerCol = isNewLayout
        ? (cols[dynPassengerCountIdx >= 0 ? dynPassengerCountIdx : 75] || cols[75] || '')
        : (cols[dynPassengerCountIdx >= 0 ? dynPassengerCountIdx : 75] || cols[75] || '');

      const passengerInfo = this.extractPassengerInfo(stopInfo, multipleStops, guestFirst, guestLast, totalPassengerCol);

      // 10. Cálculos de Saving com a vigência aplicável
      const { rate: nominalRate } = this.findTariffForDate(isoDate, periods);
      const effectiveTaxiRate = Math.round((nominalRate * scenario) * 100) / 100;
      const saving = Math.round((effectiveTaxiRate - valueBrl) * 100) / 100;
      const savingPercent = effectiveTaxiRate > 0 ? Math.round((saving / effectiveTaxiRate) * 1000) / 10 : 0;

      const dateUtc = isNewLayout
        ? (cols[dynDateUtcIdx >= 0 ? dynDateUtcIdx : 15] || cols[15] || '')
        : (cols[dynDateUtcIdx >= 0 ? dynDateUtcIdx : 0] || cols[0] || '');
      const timeUtc = isNewLayout
        ? (cols[dynTimeUtcIdx >= 0 ? dynTimeUtcIdx : 16] || cols[16] || '')
        : (cols[dynTimeUtcIdx >= 0 ? dynTimeUtcIdx : 1] || cols[1] || '');

      records.push({
        id: tripId,
        requestDateUtc: dateUtc,
        requestTimeUtc: timeUtc,
        requestDateLocal: isoDate,
        requestTimeLocal: timeLocal,
        bookerName: booker,
        email,
        service,
        city,
        origin,
        destination,
        destinationDistrict: district,
        shift,
        costCenter,
        valueBrl,
        distanceMiles: distMi,
        distanceKm: Math.round((distMi * 1.60934) * 10) / 10,
        durationMin,
        passengerCount: passengerInfo.count,
        passengerNames: passengerInfo.names,
        stopInfo,
        multipleStops: parseInt(multipleStops, 10) || passengerInfo.count,
        taxiReferenceCost: effectiveTaxiRate,
        nominalTaxiRate: nominalRate,
        saving,
        savingPercent,
      });
    }

    // Se não encontrou registros pelo formato detalhado de viagens da Uber,
    // verifica se é o formato de resumo diário (ex.: aba Dados Taxi Moover)
    if (records.length === 0) {
      const summaryDateIdx = findCol('data', 'dia', 'periodo', 'período');
      const qtyIdx = findCol('quantidade', 'qtd', 'pedidos', 'viagens', 'corridas');
      const passIdx = findCol('total passageiro', 'total passageiros', 'passageiros', 'colaboradores');
      const taxiCostIdx = findCol('custo estimado táxi', 'custo estimado taxi', 'custo taxi', 'valor táxi', 'valor taxi');

      if (summaryDateIdx >= 0 && qtyIdx >= 0) {
        for (let i = 1; i < rawLines.length; i++) {
          const cols = this.parseCsvLine(rawLines[i], delimiter);
          if (cols.length < 2) continue;

          const dateStr = cols[summaryDateIdx];
          const isoDate = this.parseDateToIso(dateStr);
          if (!isoDate) continue;

          const qty = parseInt(cols[qtyIdx], 10) || 0;
          if (qty <= 0) continue;

          let rawPass = passIdx >= 0 ? cols[passIdx] : '';
          const totalPassengers = parseInt(rawPass, 10) || qty;

          let rawTaxiCost = taxiCostIdx >= 0 ? cols[taxiCostIdx] : '';
          if (rawTaxiCost.includes(',') && rawTaxiCost.includes('.')) {
            rawTaxiCost = rawTaxiCost.replace(/\./g, '').replace(',', '.');
          } else if (rawTaxiCost.includes(',')) {
            rawTaxiCost = rawTaxiCost.replace(',', '.');
          }

          const { rate: nominalRate } = this.findTariffForDate(isoDate, periods);
          const effectiveTaxiRate = Math.round((nominalRate * scenario) * 100) / 100;
          const passPerTrip = Math.max(1, Math.round(totalPassengers / qty));

          for (let k = 1; k <= qty; k++) {
            // Estimativa de valor Uber proporcional
            const estUber = Math.round((effectiveTaxiRate * 0.385) * 100) / 100;
            const saving = Math.round((effectiveTaxiRate - estUber) * 100) / 100;
            const savingPercent = effectiveTaxiRate > 0 ? Math.round((saving / effectiveTaxiRate) * 1000) / 10 : 0;

            records.push({
              id: `SUMMARY-${isoDate}-${k}`,
              requestDateUtc: isoDate,
              requestTimeUtc: '04:00',
              requestDateLocal: isoDate,
              requestTimeLocal: '01:00',
              bookerName: 'Operações GRU (Resumo)',
              email: 'operacoes.gru@wfs.aero',
              service: 'Central | UberX',
              city: 'Sao Paulo',
              origin: 'Terminal 3 - Rod. Hélio Smidt, s/n - Cumbica, Guarulhos - SP',
              destination: 'Guarulhos e Região Metropolitana',
              destinationDistrict: 'Guarulhos / Região',
              shift: 'Madrugada',
              costCenter: 'Operações GRU',
              valueBrl: estUber,
              distanceMiles: 9.5,
              distanceKm: 15.3,
              durationMin: 26,
              passengerCount: passPerTrip,
              passengerNames: ['Colaborador'],
              stopInfo: '',
              multipleStops: passPerTrip,
              taxiReferenceCost: effectiveTaxiRate,
              nominalTaxiRate: nominalRate,
              saving,
              savingPercent,
            });
          }
        }
      }
    }

    // Identificação de Outliers estatísticos (Média + 2 * Desvio Padrão)
    if (records.length > 4) {
      const mean = records.reduce((acc, r) => acc + r.valueBrl, 0) / records.length;
      const variance = records.reduce((acc, r) => acc + Math.pow(r.valueBrl - mean, 2), 0) / records.length;
      const stdDev = Math.sqrt(variance);
      const outlierThreshold = mean + 2 * stdDev;

      records.forEach(r => {
        if (r.valueBrl > outlierThreshold) {
          r.isOutlier = true;
        }
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
   * Conta os colaboradores únicos nos registros
   */
  public static countUniquePassengers(trips: UberCsvTripRecord[]): number {
    const set = new Set<string>();
    trips.forEach(t => {
      t.passengerNames.forEach(p => {
        const clean = p.trim().toLowerCase();
        if (clean && clean !== 'colaborador' && clean.length > 2) {
          set.add(clean);
        }
      });
    });
    return set.size > 0 ? set.size : trips.reduce((acc, t) => acc + t.passengerCount, 0);
  }

  /**
   * Gera os indicadores executivos do quadro oficial de diretoria
   */
  public static calculateBoardIndicators(
    trips: UberCsvTripRecord[], 
    nominalRate = 146.06, 
    scenario: TaxiScenario = 1.0,
    scopeTitle = '',
    periodLabel = ''
  ): ExecutiveBoardComparison {
    const tripCount = trips.length;
    const effectiveTaxiRate = Math.round((nominalRate * scenario) * 100) / 100;

    if (tripCount === 0) {
      const emptyIndicators: BoardIndicators = {
        tripCount: 0,
        avgCostPerTrip: 0,
        totalCost: 0,
        economyPerTrip: 0,
        costReductionPercent: 0,
        medianCost: 0,
        totalPassengers: 0,
        uniquePassengersCount: 0,
        avgCostPerPassenger: 0,
        occupancyRate: 0,
        singlePassengerTripsCount: 0,
        singlePassengerTripsPercent: 0,
      };
      return {
        scopeTitle,
        periodLabel,
        taxiReferenceRate: nominalRate,
        activeScenario: scenario,
        scenarioRate: effectiveTaxiRate,
        taxi: { ...emptyIndicators, avgCostPerTrip: effectiveTaxiRate, medianCost: effectiveTaxiRate },
        uber: emptyIndicators,
      };
    }

    // Uber values
    const uberTotal = Math.round(trips.reduce((acc, t) => acc + t.valueBrl, 0) * 100) / 100;
    const uberAvg = Math.round((uberTotal / tripCount) * 100) / 100;
    const uberMedian = this.calculateMedian(trips.map(t => t.valueBrl));

    // Taxi values (Estimado pela tarifa contratual * cenário)
    const taxiTotal = Math.round(trips.reduce((acc, t) => acc + t.taxiReferenceCost, 0) * 100) / 100;
    const taxiAvg = Math.round((taxiTotal / tripCount) * 100) / 100;
    const taxiMedian = effectiveTaxiRate;

    // Passageiros e Ocupação
    const totalPassengers = trips.reduce((acc, t) => acc + t.passengerCount, 0);
    const uniquePassengersCount = this.countUniquePassengers(trips);
    const occupancyRate = Math.round((totalPassengers / tripCount) * 100) / 100;
    const singlePassengerTripsCount = trips.filter(t => t.passengerCount === 1).length;
    const singlePassengerTripsPercent = Math.round((singlePassengerTripsCount / tripCount) * 1000) / 10;

    // Economia
    const totalEconomy = Math.round((taxiTotal - uberTotal) * 100) / 100;
    const economyPerTrip = Math.round((totalEconomy / tripCount) * 100) / 100;
    const costReductionPercent = taxiTotal > 0 ? Math.round((totalEconomy / taxiTotal) * 1000) / 10 : 0;

    // Médias por passageiro
    const taxiAvgPerPassenger = totalPassengers > 0 ? Math.round((taxiTotal / totalPassengers) * 100) / 100 : 0;
    const uberAvgPerPassenger = totalPassengers > 0 ? Math.round((uberTotal / totalPassengers) * 100) / 100 : 0;

    return {
      scopeTitle,
      periodLabel,
      taxiReferenceRate: nominalRate,
      activeScenario: scenario,
      scenarioRate: effectiveTaxiRate,
      taxi: {
        tripCount,
        avgCostPerTrip: taxiAvg,
        totalCost: taxiTotal,
        economyPerTrip: 0,
        costReductionPercent: 0,
        medianCost: taxiMedian,
        totalPassengers,
        uniquePassengersCount,
        avgCostPerPassenger: taxiAvgPerPassenger,
        occupancyRate,
        singlePassengerTripsCount,
        singlePassengerTripsPercent,
      },
      uber: {
        tripCount,
        avgCostPerTrip: uberAvg,
        totalCost: uberTotal,
        economyPerTrip,
        costReductionPercent,
        medianCost: uberMedian,
        totalPassengers,
        uniquePassengersCount,
        avgCostPerPassenger: uberAvgPerPassenger,
        occupancyRate,
        singlePassengerTripsCount,
        singlePassengerTripsPercent,
      },
    };
  }

  /**
   * Agrupa e gera a evolução diária de saving
   */
  public static calculateDailyRecords(trips: UberCsvTripRecord[]): DailySavingRecord[] {
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
      const taxiSpend = Math.round(dayTrips.reduce((acc, t) => acc + t.taxiReferenceCost, 0) * 100) / 100;
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

  /**
   * Gera cortes agregados por Turno, Destino e Centro de Custo
   */
  public static calculateBreakdown(trips: UberCsvTripRecord[], field: 'shift' | 'destinationDistrict' | 'costCenter'): BreakdownSlice[] {
    const map = new Map<string, UberCsvTripRecord[]>();

    trips.forEach(t => {
      const key = (t as any)[field] || 'Outros';
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });

    const slices: BreakdownSlice[] = [];
    map.forEach((list, key) => {
      const uberSpend = Math.round(list.reduce((acc, t) => acc + t.valueBrl, 0) * 100) / 100;
      const taxiSpend = Math.round(list.reduce((acc, t) => acc + t.taxiReferenceCost, 0) * 100) / 100;
      const saving = Math.round((taxiSpend - uberSpend) * 100) / 100;
      const savingPercent = taxiSpend > 0 ? Math.round((saving / taxiSpend) * 1000) / 10 : 0;

      slices.push({
        label: key,
        tripCount: list.length,
        passengerCount: list.reduce((acc, t) => acc + t.passengerCount, 0),
        uberSpend,
        taxiSpend,
        saving,
        savingPercent,
      });
    });

    // Ordena pelo maior volume de saving
    return slices.sort((a, b) => b.saving - a.saving);
  }
}
