import { 
  MobilityTrip, 
  MobilityFinancialSummary, 
  DailySavingRecord, 
  MonthlySavingRecord, 
  RealtimeQuoteRequest, 
  RealtimeQuoteResult,
  OptimizationPolicy
} from '../types/mobility';
import { initialTrips, monthlyHistoryData, initialOptimizationPolicy } from '../data/mockMobilityData';

const LOCAL_STORAGE_TRIPS_KEY = 'mobility_savings_trips_v1';
const LOCAL_STORAGE_POLICY_KEY = 'mobility_savings_policy_v1';

export class MobilityService {
  private static trips: MobilityTrip[] = [];
  private static policy: OptimizationPolicy = initialOptimizationPolicy;

  public static initialize(): MobilityTrip[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_TRIPS_KEY);
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

    this.trips = [...initialTrips];
    this.saveTrips();
    return this.trips;
  }

  public static getTrips(): MobilityTrip[] {
    if (this.trips.length === 0) {
      return this.initialize();
    }
    return this.trips;
  }

  public static saveTrips(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(this.trips));
    } catch {
      // storage unavailable
    }
  }

  public static getPolicy(): OptimizationPolicy {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_POLICY_KEY);
      if (stored) {
        this.policy = { ...initialOptimizationPolicy, ...JSON.parse(stored) };
        return this.policy;
      }
    } catch {
      // fallback
    }
    return this.policy;
  }

  public static updatePolicy(newPolicy: OptimizationPolicy): OptimizationPolicy {
    this.policy = { ...newPolicy };
    try {
      localStorage.setItem(LOCAL_STORAGE_POLICY_KEY, JSON.stringify(this.policy));
    } catch {
      // storage unavailable
    }
    return this.policy;
  }

  public static addTrip(trip: Omit<MobilityTrip, 'id'>): MobilityTrip {
    const newId = `TRIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullTrip: MobilityTrip = {
      ...trip,
      id: newId,
    };

    this.trips = [fullTrip, ...this.trips];
    this.saveTrips();
    return fullTrip;
  }

  public static deleteTrip(id: string): void {
    this.trips = this.trips.filter(t => t.id !== id);
    this.saveTrips();
  }

  public static resetToDefault(): MobilityTrip[] {
    this.trips = [...initialTrips];
    this.policy = { ...initialOptimizationPolicy };
    this.saveTrips();
    try {
      localStorage.setItem(LOCAL_STORAGE_POLICY_KEY, JSON.stringify(this.policy));
    } catch {
      // fallback
    }
    return this.trips;
  }

  public static getFinancialSummary(tripsList = this.getTrips()): MobilityFinancialSummary {
    if (tripsList.length === 0) {
      return {
        totalTrips: 0,
        totalActualSpend: 0,
        totalAlternativeSpend: 0,
        totalSavings: 0,
        overallSavingPercentage: 0,
        averageTripCost: 0,
        averageCostPerKm: { uber: 0, taxi: 0, overall: 0 },
        averageSavingPerTrip: 0,
        averageDailySaving: 0,
        complianceRate: 0,
        projectedAnnualSaving: 0,
        tripsCountByModal: { uber: 0, taxi: 0 },
        totalKmTraveled: 0,
      };
    }

    let totalActualSpend = 0;
    let totalAlternativeSpend = 0;
    let totalSavings = 0;
    let uberCount = 0;
    let taxiCount = 0;
    let uberSpend = 0;
    let taxiSpend = 0;
    let uberKm = 0;
    let taxiKm = 0;
    let optimalTripsCount = 0;
    let totalKm = 0;

    const uniqueDates = new Set<string>();

    for (const trip of tripsList) {
      totalActualSpend += trip.actualCost;
      totalAlternativeSpend += trip.alternativeCost;
      totalSavings += trip.saving;
      totalKm += trip.distanceKm;
      uniqueDates.add(trip.date);

      if (trip.chosenModal === 'uber') {
        uberCount++;
        uberSpend += trip.actualCost;
        uberKm += trip.distanceKm;
      } else {
        taxiCount++;
        taxiSpend += trip.actualCost;
        taxiKm += trip.distanceKm;
      }

      if (trip.optimalChoice) {
        optimalTripsCount++;
      }
    }

    const totalTrips = tripsList.length;
    const overallSavingPercentage = totalAlternativeSpend > 0 
      ? (totalSavings / totalAlternativeSpend) * 100 
      : 0;

    const averageTripCost = totalActualSpend / totalTrips;
    const averageSavingPerTrip = totalSavings / totalTrips;
    const daysCount = Math.max(1, uniqueDates.size);
    const averageDailySaving = totalSavings / daysCount;
    const complianceRate = (optimalTripsCount / totalTrips) * 100;

    const avgUberCostPerKm = uberKm > 0 ? uberSpend / uberKm : 0;
    const avgTaxiCostPerKm = taxiKm > 0 ? taxiSpend / taxiKm : 0;
    const avgOverallCostPerKm = totalKm > 0 ? totalActualSpend / totalKm : 0;

    // Projeção anual considerando 250 dias úteis de operação corporativa
    const projectedAnnualSaving = averageDailySaving * 250;

    return {
      totalTrips,
      totalActualSpend,
      totalAlternativeSpend,
      totalSavings,
      overallSavingPercentage,
      averageTripCost,
      averageCostPerKm: {
        uber: avgUberCostPerKm,
        taxi: avgTaxiCostPerKm,
        overall: avgOverallCostPerKm,
      },
      averageSavingPerTrip,
      averageDailySaving,
      complianceRate,
      projectedAnnualSaving,
      tripsCountByModal: {
        uber: uberCount,
        taxi: taxiCount,
      },
      totalKmTraveled: totalKm,
    };
  }

  public static getDailySavingEvolution(tripsList = this.getTrips()): DailySavingRecord[] {
    const dailyMap = new Map<string, {
      uberSpend: number;
      taxiSpend: number;
      actualSpend: number;
      baselineSpend: number;
      saving: number;
      tripCount: number;
      optimalTripCount: number;
    }>();

    for (const trip of tripsList) {
      const dateKey = trip.date;
      const current = dailyMap.get(dateKey) || {
        uberSpend: 0,
        taxiSpend: 0,
        actualSpend: 0,
        baselineSpend: 0,
        saving: 0,
        tripCount: 0,
        optimalTripCount: 0,
      };

      if (trip.chosenModal === 'uber') {
        current.uberSpend += trip.actualCost;
      } else {
        current.taxiSpend += trip.actualCost;
      }

      current.actualSpend += trip.actualCost;
      current.baselineSpend += trip.alternativeCost;
      current.saving += trip.saving;
      current.tripCount += 1;
      if (trip.optimalChoice) {
        current.optimalTripCount += 1;
      }

      dailyMap.set(dateKey, current);
    }

    // Ordenar por data cronológica (crescente)
    const sortedDates = Array.from(dailyMap.keys()).sort();
    let cumulative = 0;

    return sortedDates.map(dateKey => {
      const data = dailyMap.get(dateKey)!;
      cumulative += data.saving;

      // formatar DD/MM
      const parts = dateKey.split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateKey;

      const passengers = data.tripCount;
      const savingPercent = data.baselineSpend > 0 ? (data.saving / data.baselineSpend) * 100 : 0;
      return {
        date: dateKey,
        displayDate,
        uberSpend: data.uberSpend,
        taxiSpend: data.taxiSpend,
        actualSpend: data.actualSpend,
        baselineSpend: data.baselineSpend,
        saving: data.saving,
        savingPercent,
        passengerCount: passengers,
        avgUberPerPassenger: passengers > 0 ? data.uberSpend / passengers : 0,
        avgTaxiPerPassenger: passengers > 0 ? data.taxiSpend / passengers : 0,
        cumulativeSaving: cumulative,
        tripCount: data.tripCount,
        optimalTripCount: data.optimalTripCount,
      };
    });
  }

  public static getMonthlyComparison(): MonthlySavingRecord[] {
    return monthlyHistoryData;
  }

  /**
   * Cálculo em tempo real de estimativa entre Uber e Táxi
   * Utiliza regras tarifárias reais praticadas nas capitais brasileiras
   */
  public static calculateRealtimeQuote(req: RealtimeQuoteRequest): RealtimeQuoteResult {
    const { distanceKm, durationMin, surgeMultiplier, isRaining, taxiDiscountPercent, taxiFlag } = req;

    // Regras Uber:
    // Base + (R$/km * km) + (R$/min * min) com multiplicador dinâmico
    const uberBaseRate = 5.50;
    const uberPerKm = 2.45;
    const uberPerMin = 0.38;
    
    // Impacto do tempo chuvoso caso dinâmica não tenha sido inserida manualmente
    const effectiveSurge = Math.max(surgeMultiplier, isRaining && surgeMultiplier === 1.0 ? 1.45 : surgeMultiplier);

    const baseUberCost = uberBaseRate + (distanceKm * uberPerKm) + (durationMin * uberPerMin);
    const rawUberX = baseUberCost * effectiveSurge;
    const uberX = Math.round(Math.max(10.50, rawUberX) * 100) / 100;
    const uberComfort = Math.round((uberX * 1.25) * 100) / 100;
    const uberBlack = Math.round((uberX * 1.65) * 100) / 100;

    // Regras Táxi (Tabela oficial São Paulo / Capitais):
    // Bandeirada inicial: R$ 6,20
    // Tarifa Km Bandeira 1: R$ 4,35 / km
    // Tarifa Km Bandeira 2 (+20% a 30%): R$ 5,65 / km
    // Hora parada / lentidão: R$ 42,00/h (~R$ 0,70/min)
    const taxiFlagCost = 6.20;
    const taxiRatePerKm = taxiFlag === 1 ? 4.35 : 5.65;
    // Em congestionamento, o táxi cobra tempo
    const slowMinutes = durationMin > (distanceKm * 2.2) ? durationMin - (distanceKm * 2.2) : 0;
    const taxiWaitCost = slowMinutes * 0.70;

    const grossTaxi = taxiFlagCost + (distanceKm * taxiRatePerKm) + taxiWaitCost;
    
    // Aplicar desconto de app de táxi corporativo (ex: 20% comum na 99 / Táxi SP)
    const discountMultiplier = Math.max(0, 1 - (taxiDiscountPercent / 100));
    const taxiStandard = Math.round(Math.max(12.00, grossTaxi * discountMultiplier) * 100) / 100;
    const taxiSpecial = Math.round((taxiStandard * 1.35) * 100) / 100;

    // Comparar opções padrão: UberX vs Táxi Convencional
    let bestModal: 'uber' | 'taxi' = 'uber';
    let bestCategory: string = 'UberX';
    let bestPrice = uberX;
    let alternativePrice = taxiStandard;

    if (taxiStandard < uberX) {
      bestModal = 'taxi';
      bestCategory = 'Táxi Convencional';
      bestPrice = taxiStandard;
      alternativePrice = uberX;
    }

    const immediateSaving = Math.round((alternativePrice - bestPrice) * 100) / 100;
    const immediateSavingPercent = Math.round((immediateSaving / alternativePrice) * 1000) / 10;

    const surgeImpact = Math.round((uberX - (baseUberCost * 1.0)) * 100) / 100;
    const taxiDiscountBenefit = Math.round((grossTaxi - taxiStandard) * 100) / 100;

    let recommendationNote = '';
    if (bestModal === 'taxi') {
      if (effectiveSurge > 1.25) {
        recommendationNote = `Recomendamos TÁXI. O Uber está com tarifa dinâmica de ${effectiveSurge.toFixed(1)}x gerando sobretaxa de R$ ${surgeImpact.toFixed(2)}. O táxi economiza R$ ${immediateSaving.toFixed(2)} (${immediateSavingPercent}%) e pode utilizar faixas exclusivas de ônibus.`;
      } else {
        recommendationNote = `Recomendamos TÁXI. Com o desconto corporativo de ${taxiDiscountPercent}%, a corrida fica R$ ${immediateSaving.toFixed(2)} mais barata.`;
      }
    } else {
      recommendationNote = `Recomendamos UBER. Tráfego sem sobretaxa dinâmica excessiva, garantindo economia de R$ ${immediateSaving.toFixed(2)} (${immediateSavingPercent}%) em relação ao táxi convencional.`;
    }

    return {
      uberX,
      uberComfort,
      uberBlack,
      taxiStandard,
      taxiSpecial,
      bestModal,
      bestCategory: bestCategory as any,
      bestPrice,
      alternativePrice,
      immediateSaving,
      immediateSavingPercent,
      recommendationNote,
      factors: {
        surgeImpact: Math.max(0, surgeImpact),
        trafficPenalty: Math.round(taxiWaitCost * 100) / 100,
        taxiDiscountBenefit,
      }
    };
  }

  public static exportToCSV(tripsList = this.getTrips()): string {
    const headers = [
      'ID',
      'Data',
      'Horário',
      'Origem',
      'Destino',
      'Distância (km)',
      'Duração (min)',
      'Passageiro',
      'Departamento',
      'Motivo',
      'Modal Escolhido',
      'Categoria',
      'Custo Efetivo (R$)',
      'Cotação Alternativa (R$)',
      'Saving (R$)',
      'Saving (%)',
      'Dinâmica Uber',
      'Condição Clima',
      'Tráfego',
      'Escolha Ótima'
    ];

    const rows = tripsList.map(t => [
      t.id,
      t.date,
      t.time,
      `"${t.origin.replace(/"/g, '""')}"`,
      `"${t.destination.replace(/"/g, '""')}"`,
      t.distanceKm.toFixed(1),
      t.durationMin,
      `"${t.passengerName.replace(/"/g, '""')}"`,
      `"${t.department.replace(/"/g, '""')}"`,
      `"${t.reason.replace(/"/g, '""')}"`,
      t.chosenModal.toUpperCase(),
      `"${t.chosenCategory}"`,
      t.actualCost.toFixed(2),
      t.alternativeCost.toFixed(2),
      t.saving.toFixed(2),
      t.savingPercentage.toFixed(1),
      t.surgeMultiplier.toFixed(2),
      t.weatherCondition,
      t.trafficCondition,
      t.optimalChoice ? 'SIM' : 'NÃO'
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public static generateSimulatedApiTrip(): MobilityTrip {
    const sampleOrigins = [
      'Av. Paulista, 1000 - Bela Vista',
      'Av. Brigadeiro Faria Lima, 3477 - Itaim Bibi',
      'Rua Funchal, 418 - Vila Olímpia',
      'Av. das Nações Unidas, 14171 - Morumbi',
      'Rua Oscar Freire, 800 - Jardins',
      'Aeroporto de Congonhas (CGH)',
      'Aeroporto Internacional de Guarulhos (GRU)'
    ];

    const sampleDestinations = [
      'Aeroporto de Congonhas (CGH)',
      'Av. Eng. Luís Carlos Berrini, 105',
      'Rua Pamplona, 1005 - Jardim Paulista',
      'Av. Chucri Zaidan, 1550',
      'Rua Gomes de Carvalho, 1507',
      'Av. Rebouças, 3970 - Pinheiros'
    ];

    const sampleNames = [
      'Carolina Siqueira',
      'Eduardo Mantovani',
      'Juliana Barreto',
      'Thiago Fagundes',
      'Gabriela Prado',
      'Rodrigo Alencar'
    ];

    const departments: Array<MobilityTrip['department']> = [
      'Vendas & Novos Negócios',
      'Executivo & Diretoria',
      'Operações & Logística',
      'Jurídico & Compliance',
      'Consultoria & Atendimento'
    ];

    const reasons: Array<MobilityTrip['reason']> = [
      'Reunião com Cliente',
      'Translado Aeroporto',
      'Visita Técnica',
      'Retorno Noturno',
      'Deslocamento Interunidades'
    ];

    const randomOrigin = sampleOrigins[Math.floor(Math.random() * sampleOrigins.length)];
    let randomDest = sampleDestinations[Math.floor(Math.random() * sampleDestinations.length)];
    while (randomDest === randomOrigin) {
      randomDest = sampleDestinations[Math.floor(Math.random() * sampleDestinations.length)];
    }

    const distanceKm = Math.round((3 + Math.random() * 22) * 10) / 10;
    const durationMin = Math.round(distanceKm * (2 + Math.random() * 1.8));
    
    // Simular dinâmica e chuva
    const isRaining = Math.random() > 0.6;
    const surgeMultiplier = isRaining ? Math.round((1.4 + Math.random() * 0.8) * 10) / 10 : Math.round((1.0 + Math.random() * 0.3) * 10) / 10;

    const quote = this.calculateRealtimeQuote({
      origin: randomOrigin,
      destination: randomDest,
      distanceKm,
      durationMin,
      hour: 14,
      surgeMultiplier,
      isRaining,
      taxiDiscountPercent: 20,
      taxiFlag: 1
    });

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

    const newTrip: Omit<MobilityTrip, 'id'> = {
      date: dateStr,
      time: timeStr,
      origin: randomOrigin,
      destination: randomDest,
      distanceKm,
      durationMin,
      passengerName: sampleNames[Math.floor(Math.random() * sampleNames.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      chosenModal: quote.bestModal,
      chosenCategory: quote.bestCategory,
      actualCost: quote.bestPrice,
      alternativeCost: quote.alternativePrice,
      saving: quote.immediateSaving,
      savingPercentage: quote.immediateSavingPercent,
      surgeMultiplier,
      weatherCondition: isRaining ? 'Chuva Moderada' : 'Ensolarado',
      trafficCondition: durationMin > 35 ? 'Intenso' : 'Moderado',
      optimalChoice: true,
      notes: `Sincronizado automaticamente via API Webhook. Recomendação ${quote.bestModal.toUpperCase()} atendida com saving de R$ ${quote.immediateSaving.toFixed(2)}.`
    };

    return this.addTrip(newTrip);
  }
}
