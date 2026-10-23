/**
 * Tipos e interfaces para a gestão de mobilidade corporativa e acompanhamento de saving
 * Operação Aeroporto Guarulhos (GRU) - Uber Central vs Táxi Avulso
 */

export type ModalType = 'uber' | 'taxi';

export type UberCategory = 'UberX' | 'Uber Comfort' | 'Uber Black';
export type TaxiCategory = 'Táxi Convencional' | 'Táxi Especial/Aeroporto' | 'Táxi Executivo';
export type MobilityCategory = UberCategory | TaxiCategory;

export type TripDepartment = 'Vendas & Novos Negócios' | 'Executivo & Diretoria' | 'Operações & Logística' | 'Jurídico & Compliance' | 'Consultoria & Atendimento';
export type TripReason = 'Reunião com Cliente' | 'Translado Aeroporto' | 'Visita Técnica' | 'Retorno Noturno' | 'Deslocamento Interunidades';

export type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'custom';
export type TaxiScenario = 1.0 | 0.8 | 0.7 | 0.5;

export interface ContractTariffPeriod {
  id: string;
  rate: number; // ex: 146.06
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (opcional se vigente)
  contractSource: string; // ex: "Contrato Fornecedor Táxi GRU nº 2025/11 - Cláusula 4.1"
  notes?: string;
}

export interface TariffAuditLog {
  id: string;
  timestamp: string; // ISO ou DD/MM/AAAA HH:mm
  author: string; // Quem alterou (ex: "Ivo Emmanuel", "Gestor de Mobilidade")
  previousValue: number;
  newValue: number;
  reason: string; // Motivo obrigatório
}

export interface SavingTargetConfig {
  targetType: 'value' | 'percent'; // R$ ou %
  targetValue: number; // ex: 100000 (R$) ou 60 (%)
  month: string; // ex: "2026-10"
  updatedAt?: string;
  updatedBy?: string;
}

export interface UberCsvTripRecord {
  id: string;
  requestDateUtc: string;
  requestTimeUtc: string;
  requestDateLocal: string; // YYYY-MM-DD
  requestTimeLocal: string; // HH:mm
  bookerName: string;
  email: string;
  service: string;
  city: string;
  origin: string;
  destination: string;
  destinationDistrict: string; // Bairro/Região derivado
  shift: 'Madrugada' | 'Manhã' | 'Tarde' | 'Noite';
  costCenter: string; // Centro de custo / Código de despesa (se houver)
  valueBrl: number;
  distanceMiles: number;
  distanceKm: number;
  durationMin: number;
  passengerCount: number;
  passengerNames: string[];
  stopInfo: string;
  multipleStops: number;
  taxiReferenceCost: number; // Tarifa da vigência * cenário
  nominalTaxiRate: number; // Tarifa 100% da vigência
  saving: number;
  savingPercent: number;
  isOutlier?: boolean; // Sinalização de corrida atípica
}

export interface BoardIndicators {
  tripCount: number;
  avgCostPerTrip: number;
  totalCost: number;
  economyPerTrip: number;
  costReductionPercent: number;
  medianCost: number;
  totalPassengers: number;
  uniquePassengersCount: number; // Colaboradores únicos
  avgCostPerPassenger: number;
  occupancyRate: number; // Média de passageiros por corrida
  singlePassengerTripsCount: number; // Corridas com 1 passageiro
  singlePassengerTripsPercent: number; // % com 1 passageiro
}

export interface ExecutiveBoardComparison {
  scopeTitle: string;
  dateKey?: string;
  periodLabel: string;
  taxiReferenceRate: number;
  activeScenario: TaxiScenario;
  scenarioRate: number;
  taxi: BoardIndicators;
  uber: BoardIndicators;
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

export interface BreakdownSlice {
  label: string;
  tripCount: number;
  passengerCount: number;
  uberSpend: number;
  taxiSpend: number;
  saving: number;
  savingPercent: number;
}

// Mantido para compatibilidade das abas auxiliares
export interface MobilityTrip extends Partial<UberCsvTripRecord> {
  id: string;
  date: string;
  time: string;
  passengerName: string;
  department: TripDepartment;
  reason: TripReason;
  chosenModal: ModalType;
  chosenCategory: MobilityCategory;
  origin: string;
  destination: string;
  distanceKm: number;
  saving: number;
  actualCost: number;
  alternativeCost: number;
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

export interface GoogleSheetsConfig {
  sheetUrl: string;
  lastSyncedAt: string;
  status: 'synced' | 'syncing' | 'error' | 'idle';
  errorMessage?: string;
  autoSyncIntervalMinutes: number;
  taxiReferenceRate: number;
}
