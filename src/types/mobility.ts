/**
 * Tipos e interfaces para a gestão de mobilidade corporativa e acompanhamento de saving
 * Inclui os modelos oficiais de acompanhamento enviados à diretoria e sincronização via Google Sheets
 */

export type ModalType = 'uber' | 'taxi';

export type UberCategory = 'UberX' | 'Uber Comfort' | 'Uber Black';
export type TaxiCategory = 'Táxi Convencional' | 'Táxi Especial/Aeroporto' | 'Táxi Executivo';

export type MobilityCategory = UberCategory | TaxiCategory;

export type TripDepartment = 'Vendas & Novos Negócios' | 'Executivo & Diretoria' | 'Operações & Logística' | 'Jurídico & Compliance' | 'Consultoria & Atendimento';

export type TripReason = 'Reunião com Cliente' | 'Translado Aeroporto' | 'Visita Técnica' | 'Retorno Noturno' | 'Deslocamento Interunidades';

export interface MobilityTrip {
  id: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  passengerName: string;
  department: TripDepartment;
  reason: TripReason;
  chosenModal: ModalType;
  chosenCategory: MobilityCategory;
  actualCost: number;
  alternativeCost: number;
  saving: number;
  savingPercentage: number;
  surgeMultiplier: number;
  weatherCondition: 'Ensolarado' | 'Chuva Moderada' | 'Chuva Intensa' | 'Nublado';
  trafficCondition: 'Livre' | 'Moderado' | 'Intenso' | 'Congestionado';
  optimalChoice: boolean;
  notes?: string;
}

export interface MobilityFinancialSummary {
  totalTrips: number;
  totalActualSpend: number;
  totalAlternativeSpend: number;
  totalSavings: number;
  overallSavingPercentage: number;
  averageTripCost: number;
  averageCostPerKm: {
    uber: number;
    taxi: number;
    overall: number;
  };
  averageSavingPerTrip: number;
  averageDailySaving: number;
  complianceRate: number;
  projectedAnnualSaving: number;
  tripsCountByModal: {
    uber: number;
    taxi: number;
  };
  totalKmTraveled: number;
}

export interface MonthlySavingRecord {
  monthKey: string;
  monthName: string;
  uberSpend: number;
  taxiSpend: number;
  totalSpend: number;
  benchmarkSpend: number;
  saving: number;
  savingPercentage: number;
  tripCount: number;
  avgSavingPerTrip: number;
}

export interface ScenarioEfficiency {
  scenario: string;
  description: string;
  uberCheaperPercentage: number;
  taxiCheaperPercentage: number;
  avgUberCost: number;
  avgTaxiCost: number;
  avgSavingAmount: number;
  bestModalRecommendation: 'uber' | 'taxi' | 'misto';
  triggerReason: string;
}

export interface RealtimeQuoteRequest {
  origin: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  hour: number;
  surgeMultiplier: number;
  isRaining: boolean;
  taxiDiscountPercent: number;
  taxiFlag: 1 | 2;
}

export interface RealtimeQuoteResult {
  uberX: number;
  uberComfort: number;
  uberBlack: number;
  taxiStandard: number;
  taxiSpecial: number;
  bestModal: ModalType;
  bestCategory: MobilityCategory;
  bestPrice: number;
  alternativePrice: number;
  immediateSaving: number;
  immediateSavingPercent: number;
  recommendationNote: string;
  factors: {
    surgeImpact: number;
    trafficPenalty: number;
    taxiDiscountBenefit: number;
  };
}

export interface OptimizationPolicy {
  surgeCapForTaxiSwitch: number;
  preferTaxiForAirports: boolean;
  preferTaxiInRain: boolean;
  strictApprovalAboveBRL: number;
  applyAppTaxiDiscounts: boolean;
  allowBlackComfortOnlyForDirectors: boolean;
}

export interface UberCsvTripRecord {
  id: string;
  requestDateUtc: string;
  requestTimeUtc: string;
  requestDateLocal: string;
  requestTimeLocal: string;
  bookerName: string;
  email: string;
  service: string;
  city: string;
  origin: string;
  destination: string;
  valueBrl: number;
  distanceMiles: number;
  distanceKm: number;
  durationMin: number;
  passengerCount: number;
  passengerNames: string[];
  stopInfo: string;
  multipleStops: number;
  taxiReferenceCost: number;
  saving: number;
  savingPercent: number;
}

export interface BoardIndicators {
  tripCount: number;
  avgCostPerTrip: number;
  totalCost: number;
  economyPerTrip: number;
  costReductionPercent: number;
  medianCost: number;
  totalPassengers: number;
  avgCostPerPassenger: number;
}

export interface ExecutiveBoardComparison {
  scopeTitle: string;
  dateKey?: string;
  taxiReferenceRate: number;
  taxi: BoardIndicators;
  uber: BoardIndicators;
}

export interface GoogleSheetsConfig {
  sheetUrl: string;
  lastSyncedAt: string;
  status: 'synced' | 'syncing' | 'error' | 'idle';
  errorMessage?: string;
  autoSyncIntervalMinutes: number;
  taxiReferenceRate: number;
}

export interface DailySavingRecord {
  date: string;
  displayDate: string;
  uberSpend: number;
  taxiSpend: number;
  saving: number;
  savingPercent: number;
  tripCount: number;
  passengerCount: number;
  avgUberPerPassenger: number;
  avgTaxiPerPassenger: number;
  cumulativeSaving: number;
}
