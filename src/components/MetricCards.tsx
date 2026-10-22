import React from 'react';
import { ExecutiveBoardComparison } from '../types/mobility';
import { TrendingUp, DollarSign, Users, Award, Percent, Car, ArrowDownRight } from 'lucide-react';

interface MetricCardsProps {
  comparison: ExecutiveBoardComparison;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ comparison }) => {
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const formatPercent = (val: number) => {
    return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const totalEconomy = comparison.taxi.totalCost - comparison.uber.totalCost;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* Card 1: Saving Acumulado */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Saving Acumulado
          </span>
          <TrendingUp className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
          {formatBRL(totalEconomy)}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-emerald-600 inline" />
            <span>{formatPercent(comparison.uber.costReductionPercent)}</span>
          </span>
          <span>de redução nos custos</span>
        </div>
      </div>

      {/* Card 2: Desembolso Real Uber */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Desembolso Real Uber
          </span>
          <DollarSign className="w-4 h-4 text-slate-900" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {formatBRL(comparison.uber.totalCost)}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>Táxi Estimado:</span>
          <span className="line-through font-mono tabular-nums text-slate-400">
            {formatBRL(comparison.taxi.totalCost)}
          </span>
        </div>
      </div>

      {/* Card 3: Custo Médio por Pedido */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Custo Médio / Pedido
          </span>
          <Car className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {formatBRL(comparison.uber.avgCostPerTrip)}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>Ref. Táxi:</span>
          <span className="font-mono tabular-nums text-slate-600">
            {formatBRL(comparison.taxi.avgCostPerTrip)}
          </span>
        </div>
      </div>

      {/* Card 4: Economia Média por Pedido */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Economia / Pedido
          </span>
          <Award className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
          {formatBRL(comparison.uber.economyPerTrip)}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>Mediana Uber:</span>
          <span className="font-mono tabular-nums text-slate-700">
            {formatBRL(comparison.uber.medianCost)}
          </span>
        </div>
      </div>

      {/* Card 5: Passageiros Transportados */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Passageiros transportados
          </span>
          <Users className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {comparison.uber.totalPassengers}
          <span className="text-xs font-normal text-slate-500 ml-1">passageiros</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>Colaboradores únicos:</span>
          <strong className="text-slate-800 font-mono tabular-nums">
            {comparison.uber.uniquePassengersCount}
          </strong>
        </div>
      </div>

      {/* Card 6: Custo Médio por Passageiro */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Custo / Passageiro
          </span>
          <Percent className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
          {formatBRL(comparison.uber.avgCostPerPassenger)}
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>No Táxi:</span>
          <span className="line-through font-mono tabular-nums text-slate-400">
            {formatBRL(comparison.taxi.avgCostPerPassenger)}
          </span>
        </div>
      </div>
    </div>
  );
};
