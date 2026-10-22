import React, { useState } from 'react';
import { DailySavingRecord } from '../types/mobility';
import { Users, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface DailySavingChartProps {
  dailyRecords: DailySavingRecord[];
}

export const DailySavingChart: React.FC<DailySavingChartProps> = ({ dailyRecords }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const totalSaving = dailyRecords.reduce((acc, r) => acc + r.saving, 0);
  const totalUber = dailyRecords.reduce((acc, r) => acc + r.uberSpend, 0);
  const totalTaxi = dailyRecords.reduce((acc, r) => acc + r.taxiSpend, 0);
  const totalTrips = dailyRecords.reduce((acc, r) => acc + r.tripCount, 0);
  const totalPassengers = dailyRecords.reduce((acc, r) => acc + r.passengerCount, 0);

  const maxDailyTaxi = Math.max(...dailyRecords.map(r => r.taxiSpend), 5000);

  const svgWidth = 760;
  const svgHeight = 260;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 45;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barGroupWidth = chartWidth / Math.max(1, dailyRecords.length);
  const barWidth = Math.min(48, barGroupWidth * 0.35);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Title & Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Evolução Diária do Saving (Uber vs Táxi Avulso)
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
            <span>Comparativo diário de desembolso efetivo vs custo de referência</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-700 font-bold">
              Total Economizado: {formatBRL(totalSaving)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-300 inline-block"></span>
            <span>Táxi (Referência)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-900 inline-block"></span>
            <span>Uber (Real Pago)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span>
            <span>Saving Gerado</span>
          </div>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 my-2 text-xs border-b border-slate-100">
        <div>
          <span className="text-slate-500 block mb-0.5">Total de Atendimentos</span>
          <span className="text-base font-bold font-mono tabular-nums text-slate-900">
            {totalTrips} viagens
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5">Colaboradores Transportados</span>
          <span className="text-base font-bold font-mono tabular-nums text-slate-900">
            {totalPassengers} pessoas
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5">Desembolso Estimado Táxi</span>
          <span className="text-base font-bold font-mono tabular-nums text-slate-500 line-through">
            {formatBRL(totalTaxi)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5">Desembolso Real Uber</span>
          <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
            {formatBRL(totalUber)}
          </span>
        </div>
      </div>

      {/* SVG Daily Chart */}
      <div className="relative w-full overflow-x-auto pt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-64 select-none"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const value = maxDailyTaxi * pct;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={pct === 0 ? '0' : '4 4'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94A3B8"
                  className="font-mono tabular-nums"
                >
                  R$ {Math.round(value)}
                </text>
              </g>
            );
          })}

          {/* Render side-by-side comparison bars for each day */}
          {dailyRecords.map((r, i) => {
            const groupX = paddingLeft + i * barGroupWidth;
            const isHovered = hoveredIndex === i;

            const taxiH = (r.taxiSpend / maxDailyTaxi) * chartHeight;
            const uberH = (r.uberSpend / maxDailyTaxi) * chartHeight;
            const savingH = (r.saving / maxDailyTaxi) * chartHeight;

            const taxiY = paddingTop + chartHeight - taxiH;
            const uberY = paddingTop + chartHeight - uberH;

            const bar1X = groupX + (barGroupWidth - barWidth * 2 - 8) / 2;
            const bar2X = bar1X + barWidth + 8;

            return (
              <g
                key={r.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Background hover highlight */}
                <rect
                  x={groupX + 4}
                  y={paddingTop - 5}
                  width={barGroupWidth - 8}
                  height={chartHeight + 10}
                  fill={isHovered ? '#F8FAFC' : 'transparent'}
                  rx="6"
                />

                {/* Taxi Reference Bar */}
                <rect
                  x={bar1X}
                  y={taxiY}
                  width={barWidth}
                  height={Math.max(4, taxiH)}
                  rx="4"
                  fill="#CBD5E1"
                />
                <text
                  x={bar1X + barWidth / 2}
                  y={taxiY - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748B"
                  className="font-mono tabular-nums font-semibold"
                >
                  R$ {Math.round(r.taxiSpend)}
                </text>

                {/* Uber Bar with Saving on Top */}
                <rect
                  x={bar2X}
                  y={uberY}
                  width={barWidth}
                  height={Math.max(4, uberH)}
                  rx="4"
                  fill="#0F172A"
                />

                {/* Saving segment above Uber */}
                <rect
                  x={bar2X}
                  y={taxiY}
                  width={barWidth}
                  height={Math.max(2, savingH)}
                  rx="4"
                  fill="#059669"
                />
                <text
                  x={bar2X + barWidth / 2}
                  y={taxiY - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#059669"
                  className="font-mono tabular-nums font-bold"
                >
                  +{r.savingPercent.toFixed(1)}%
                </text>

                {/* X Axis Label */}
                <text
                  x={groupX + barGroupWidth / 2}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fontSize="12"
                  fill={isHovered ? '#0F172A' : '#475569'}
                  fontWeight={isHovered ? '700' : '600'}
                  className="font-mono tabular-nums"
                >
                  Dia {r.displayDate} ({r.tripCount} viagens)
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && dailyRecords[hoveredIndex] && (
          <div className="absolute top-4 right-4 bg-slate-900 text-white rounded-lg p-3 text-xs shadow-lg max-w-xs pointer-events-none transition-all">
            <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1.5 mb-1.5 flex justify-between items-center">
              <span>Dia {dailyRecords[hoveredIndex].displayDate}</span>
              <span className="font-mono tabular-nums text-emerald-400 font-bold">
                +{dailyRecords[hoveredIndex].savingPercent.toFixed(1)}% Economia
              </span>
            </div>
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Custo Táxi Estimado:</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {formatBRL(dailyRecords[hoveredIndex].taxiSpend)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Custo Real Uber:</span>
                <span className="font-mono tabular-nums text-emerald-400 font-bold">
                  {formatBRL(dailyRecords[hoveredIndex].uberSpend)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Saving do Dia:</span>
                <span className="font-mono tabular-nums text-emerald-300 font-bold">
                  +{formatBRL(dailyRecords[hoveredIndex].saving)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span>Passageiros Transportados:</span>
                <span className="font-mono tabular-nums text-white">
                  {dailyRecords[hoveredIndex].passengerCount} colaboradores
                </span>
              </div>
              <div className="flex justify-between">
                <span>Custo / Passageiro (Uber):</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {formatBRL(dailyRecords[hoveredIndex].avgUberPerPassenger)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span>Barra cinza: Custo Táxi de referência (R$ 146,06 / atendimento)</span>
          <span aria-hidden="true">·</span>
          <span>Barra preta + verde: Custo Uber + Saving</span>
        </div>
        <div>
          <span>Passe o cursor sobre os dias para ver os detalhes</span>
        </div>
      </div>
    </div>
  );
};
