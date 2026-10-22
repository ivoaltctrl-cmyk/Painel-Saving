import React from 'react';
import { scenarioEfficiencies } from '../data/mockMobilityData';
import { CloudRain, Sun, Plane, Clock, Navigation } from 'lucide-react';

export const ScenarioEfficiencyMatrix: React.FC = () => {
  const getIcon = (scenario: string) => {
    if (scenario.includes('Chuva')) return <CloudRain className="w-4 h-4 text-sky-600" />;
    if (scenario.includes('Aeroporto')) return <Plane className="w-4 h-4 text-indigo-600" />;
    if (scenario.includes('Comercial')) return <Sun className="w-4 h-4 text-amber-500" />;
    if (scenario.includes('Noturno')) return <Clock className="w-4 h-4 text-violet-600" />;
    return <Navigation className="w-4 h-4 text-slate-500" />;
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">
          Matriz de Eficiência por Cenário Operacional
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Comportamento dos custos e recomendação de modal para otimizar os gastos de mobilidade
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {scenarioEfficiencies.map((item, idx) => (
          <div key={idx} className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Scenario Title & Description */}
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2 mb-1">
                {getIcon(item.scenario)}
                <span className="text-sm font-semibold text-slate-900">
                  {item.scenario}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Split Progress Bar */}
            <div className="lg:col-span-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-mono tabular-nums">
                <span>Uber mais barato: <strong>{item.uberCheaperPercentage}%</strong></span>
                <span>Táxi mais barato: <strong>{item.taxiCheaperPercentage}%</strong></span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-xs overflow-hidden flex">
                <div
                  className="bg-slate-800 h-full transition-all"
                  style={{ width: `${item.uberCheaperPercentage}%` }}
                  title={`Uber: ${item.uberCheaperPercentage}%`}
                />
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${item.taxiCheaperPercentage}%` }}
                  title={`Táxi: ${item.taxiCheaperPercentage}%`}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Gatilho: {item.triggerReason}
              </div>
            </div>

            {/* Averages & Recommendation */}
            <div className="lg:col-span-3 flex flex-col items-start lg:items-end justify-center">
              <div className="text-xs text-slate-500">
                Saving médio unitário:
              </div>
              <div className="text-sm font-bold font-mono tabular-nums text-emerald-600">
                {formatBRL(item.avgSavingAmount)}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-700">
                Recomendação: <span className="font-bold uppercase text-slate-900">{item.bestModalRecommendation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
