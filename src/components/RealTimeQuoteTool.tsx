import React, { useState } from 'react';
import { RealtimeQuoteRequest, RealtimeQuoteResult } from '../types/mobility';
import { MobilityService } from '../services/mobilityService';
import { 
  Calculator, 
  MapPin, 
  TrendingDown, 
  Zap, 
  CloudRain, 
  Sun, 
  PlusCircle, 
  Check, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface RealTimeQuoteToolProps {
  onTripLogged: () => void;
}

export const RealTimeQuoteTool: React.FC<RealTimeQuoteToolProps> = ({ onTripLogged }) => {
  const [origin, setOrigin] = useState('Av. Paulista, 1000 - Bela Vista');
  const [destination, setDestination] = useState('Aeroporto de Congonhas (CGH)');
  const [distanceKm, setDistanceKm] = useState(10.5);
  const [durationMin, setDurationMin] = useState(32);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.4);
  const [isRaining, setIsRaining] = useState(false);
  const [taxiDiscountPercent, setTaxiDiscountPercent] = useState(20);
  const [taxiFlag, setTaxiFlag] = useState<1 | 2>(1);
  const [passengerName, setPassengerName] = useState('Colaborador Corporativo');
  const [department, setDepartment] = useState<'Vendas & Novos Negócios' | 'Executivo & Diretoria' | 'Operações & Logística' | 'Jurídico & Compliance' | 'Consultoria & Atendimento'>('Vendas & Novos Negócios');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Quick route presets for São Paulo / corporate routes
  const presets = [
    { label: 'Paulista ➔ Congonhas', orig: 'Av. Paulista, 1000', dest: 'Aeroporto de Congonhas (CGH)', km: 10.5, min: 32 },
    { label: 'Faria Lima ➔ Berrini', orig: 'Av. Brig. Faria Lima, 3477', dest: 'Av. Eng. Luís Carlos Berrini, 105', km: 4.8, min: 18 },
    { label: 'Paulista ➔ Guarulhos GRU', orig: 'Av. Paulista, 1500', dest: 'Aeroporto de Guarulhos (GRU)', km: 31.0, min: 55 },
    { label: 'Itaim ➔ Centro / Sé', orig: 'Rua Tabapuã, 1123', dest: 'Praça da Sé, 100', km: 8.2, min: 28 },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setOrigin(p.orig);
    setDestination(p.dest);
    setDistanceKm(p.km);
    setDurationMin(p.min);
  };

  const quoteRequest: RealtimeQuoteRequest = {
    origin,
    destination,
    distanceKm,
    durationMin,
    hour: 14,
    surgeMultiplier,
    isRaining,
    taxiDiscountPercent,
    taxiFlag,
  };

  const result: RealtimeQuoteResult = MobilityService.calculateRealtimeQuote(quoteRequest);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const handleSaveTripToHistory = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

    MobilityService.addTrip({
      date: dateStr,
      time: timeStr,
      origin,
      destination,
      distanceKm,
      durationMin,
      passengerName,
      department,
      reason: destination.includes('Aeroporto') ? 'Translado Aeroporto' : 'Reunião com Cliente',
      chosenModal: result.bestModal,
      chosenCategory: result.bestCategory,
      actualCost: result.bestPrice,
      alternativeCost: result.alternativePrice,
      saving: result.immediateSaving,
      savingPercentage: result.immediateSavingPercent,
      surgeMultiplier,
      weatherCondition: isRaining ? 'Chuva Moderada' : 'Ensolarado',
      trafficCondition: durationMin > distanceKm * 2.5 ? 'Intenso' : 'Moderado',
      optimalChoice: true,
      notes: result.recommendationNote,
    });

    setSavedSuccess(true);
    onTripLogged();
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Route & Scenario Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              Cotação & Otimizador em Tempo Real
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare as tarifas instantâneas entre Uber e Táxi antes de autorizar ou solicitar o trajeto
            </p>
          </div>

          {/* Quick Route Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Rotas rápidas:</span>
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {/* Origin */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Origem
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              placeholder="Ex: Av. Paulista, 1000"
            />
          </div>

          {/* Destination */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Destino
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              placeholder="Ex: Aeroporto de Congonhas"
            />
          </div>

          {/* Distance (km) */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-slate-700">
              <span>Distância estimada:</span>
              <span className="font-mono tabular-nums font-bold">{distanceKm} km</span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              step={0.5}
              value={distanceKm}
              onChange={(e) => {
                const km = parseFloat(e.target.value);
                setDistanceKm(km);
                // Ajuste proporcional do tempo
                setDurationMin(Math.round(km * 2.8));
              }}
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>

          {/* Duration (min) */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-slate-700">
              <span>Tempo estimado:</span>
              <span className="font-mono tabular-nums font-bold">{durationMin} min</span>
            </div>
            <input
              type="range"
              min={5}
              max={150}
              step={1}
              value={durationMin}
              onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>
        </div>

        {/* Dynamic & Operational Modifiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-100">
          {/* Uber Surge Multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-700">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Dinâmica Uber:
              </span>
              <span className={`font-mono tabular-nums font-bold ${surgeMultiplier > 1.3 ? 'text-amber-600' : 'text-slate-900'}`}>
                {surgeMultiplier.toFixed(1)}x {surgeMultiplier > 1.3 ? '(Tarifa Alta)' : '(Normal)'}
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={2.8}
              step={0.1}
              value={surgeMultiplier}
              onChange={(e) => setSurgeMultiplier(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Weather Toggle */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-700 block">Condição Climática:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRaining(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md border transition-colors ${
                  !isRaining
                    ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Ensolarado / Seco</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRaining(true);
                  if (surgeMultiplier < 1.4) setSurgeMultiplier(1.6);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md border transition-colors ${
                  isRaining
                    ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                <span>Chuva / Pico</span>
              </button>
            </div>
          </div>

          {/* Taxi App Discount & Flag */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-700">
              <span>Desconto App Táxi: <strong>{taxiDiscountPercent}%</strong></span>
              <span>Bandeira:</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={taxiDiscountPercent}
                onChange={(e) => setTaxiDiscountPercent(Number(e.target.value))}
                className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value={0}>0% (Sem desconto)</option>
                <option value={10}>10% Convênio</option>
                <option value={20}>20% App Táxi (Padrão)</option>
                <option value={30}>30% App Táxi Promocional</option>
              </select>

              <div className="flex border border-slate-300 rounded-md overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setTaxiFlag(1)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${
                    taxiFlag === 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  B1
                </button>
                <button
                  type="button"
                  onClick={() => setTaxiFlag(2)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${
                    taxiFlag === 2 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  B2
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Comparison Results Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Uber Side Card */}
        <div className={`lg:col-span-5 bg-white border rounded-lg p-5 transition-all ${
          result.bestModal === 'uber' 
            ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-xs' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Plataforma de Aplicativo
              </div>
              <div className="text-lg font-bold text-slate-900">
                Uber
              </div>
            </div>
            {result.bestModal === 'uber' && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Opção Mais Econômica
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-900">UberX (Econômico)</div>
                <div className="text-[11px] text-slate-500">Mais utilizado corporativo</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(result.uberX)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded border border-slate-100 text-xs">
              <div>
                <div className="font-medium text-slate-700">Uber Comfort</div>
                <div className="text-[11px] text-slate-400">Espaço extra / ar garantido</div>
              </div>
              <div className="font-mono tabular-nums font-semibold text-slate-800">
                {formatBRL(result.uberComfort)}
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded border border-slate-100 text-xs">
              <div>
                <div className="font-medium text-slate-700">Uber Black</div>
                <div className="text-[11px] text-slate-400">Sedans executivos</div>
              </div>
              <div className="font-mono tabular-nums font-semibold text-slate-800">
                {formatBRL(result.uberBlack)}
              </div>
            </div>
          </div>

          {result.factors.surgeImpact > 0 && (
            <div className="mt-4 text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Sobretaxa dinâmica inclusa: +{formatBRL(result.factors.surgeImpact)} ({surgeMultiplier}x)
              </span>
            </div>
          )}
        </div>

        {/* Taxi Side Card */}
        <div className={`lg:col-span-5 bg-white border rounded-lg p-5 transition-all ${
          result.bestModal === 'taxi' 
            ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-xs' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Frota Regulada Municipal
              </div>
              <div className="text-lg font-bold text-slate-900">
                Táxi
              </div>
            </div>
            {result.bestModal === 'taxi' && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Opção Mais Econômica
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-900">Táxi Convencional</div>
                <div className="text-[11px] text-slate-500">
                  {taxiDiscountPercent}% desc. app · Faixa exclusiva
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatBRL(result.taxiStandard)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded border border-slate-100 text-xs">
              <div>
                <div className="font-medium text-slate-700">Táxi Especial / Cooperativa</div>
                <div className="text-[11px] text-slate-400">Guarucoop / Rádio Táxi / Aeroporto</div>
              </div>
              <div className="font-mono tabular-nums font-semibold text-slate-800">
                {formatBRL(result.taxiSpecial)}
              </div>
            </div>

            <div className="p-2.5 rounded border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Bandeirada inicial:</span>
                <span className="font-mono tabular-nums">R$ 6,20</span>
              </div>
              <div className="flex justify-between">
                <span>Benefício desconto app:</span>
                <span className="font-mono tabular-nums text-emerald-600">
                  -{formatBRL(result.factors.taxiDiscountBenefit)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Permitido transitar em corredores e faixas de ônibus municipais.</span>
          </div>
        </div>

        {/* Immediate Saving & Recommendation Action Box */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-slate-900 text-white rounded-lg p-5">
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400 mb-1">
              Saving Imediato
            </div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-400">
              {formatBRL(result.immediateSaving)}
            </div>
            <div className="text-xs text-emerald-300 font-semibold mt-1">
              +{result.immediateSavingPercent}% de economia
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
              {result.recommendationNote}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 block">Passageiro / Departamento:</label>
              <input
                type="text"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="w-full text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none"
              />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as any)}
                className="w-full text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none mt-1"
              >
                <option value="Vendas & Novos Negócios">Vendas & Novos Negócios</option>
                <option value="Executivo & Diretoria">Executivo & Diretoria</option>
                <option value="Operações & Logística">Operações & Logística</option>
                <option value="Jurídico & Compliance">Jurídico & Compliance</option>
                <option value="Consultoria & Atendimento">Consultoria & Atendimento</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSaveTripToHistory}
              disabled={savedSuccess}
              className={`w-full py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Registrado no Painel!</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Salvar no Histórico</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
