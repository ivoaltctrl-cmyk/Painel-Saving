import React, { useState } from 'react';
import { MonthlySavingRecord } from '../types/mobility';

interface MonthlyComparisonChartProps {
  records: MonthlySavingRecord[];
}

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({ records }) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    records[records.length - 1]?.monthKey || ''
  );

  const selectedRecord = records.find(r => r.monthKey === selectedMonthKey) || records[records.length - 1];

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const totalYearSaving = records.reduce((acc, r) => acc + r.saving, 0);
  const totalYearSpend = records.reduce((acc, r) => acc + r.totalSpend, 0);
  const avgYearSavingPct = (totalYearSaving / (totalYearSpend + totalYearSaving)) * 100;

  const maxTotal = Math.max(...records.map(r => r.benchmarkSpend), 20000);

  const svgWidth = 840;
  const svgHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const groupWidth = chartWidth / records.length;
  const barWidth = Math.min(22, groupWidth * 0.28);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Comparativo Mensal de Gastos e Economia
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Visão consolidada 2026: Gasto Efetivo vs Economia Gerada</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-emerald-700 font-semibold">
              Saving Anual Acumulado: {formatBRL(totalYearSaving)} ({avgYearSavingPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-800 inline-block"></span>
            <span>Uber</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
            <span>Táxi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span>
            <span>Economia (Saving)</span>
          </div>
        </div>
      </div>

      {/* SVG Multi-Bar Chart */}
      <div className="relative w-full overflow-x-auto pt-3">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-72 select-none"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const value = maxTotal * pct;
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
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94A3B8"
                  className="font-mono tabular-nums"
                >
                  R$ {Math.round(value / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Render bar groups for each month */}
          {records.map((r, i) => {
            const groupX = paddingLeft + i * groupWidth;
            const isSelected = selectedMonthKey === r.monthKey;

            // Bar heights
            const uberH = (r.uberSpend / maxTotal) * chartHeight;
            const taxiH = (r.taxiSpend / maxTotal) * chartHeight;
            const savingH = (r.saving / maxTotal) * chartHeight;

            const uberY = paddingTop + chartHeight - uberH;
            const taxiY = paddingTop + chartHeight - taxiH;
            const savingY = paddingTop + chartHeight - savingH;

            const bar1X = groupX + (groupWidth - barWidth * 3 - 6) / 2;
            const bar2X = bar1X + barWidth + 3;
            const bar3X = bar2X + barWidth + 3;

            return (
              <g
                key={r.monthKey}
                className="cursor-pointer"
                onClick={() => setSelectedMonthKey(r.monthKey)}
              >
                {/* Background hover / selection highlight */}
                <rect
                  x={groupX + 2}
                  y={paddingTop - 5}
                  width={groupWidth - 4}
                  height={chartHeight + 10}
                  fill={isSelected ? '#F1F5F9' : 'transparent'}
                  rx="4"
                  className="hover:fill-slate-50 transition-colors"
                />

                {/* Uber Bar */}
                <rect
                  x={bar1X}
                  y={uberY}
                  width={barWidth}
                  height={Math.max(2, uberH)}
                  rx="2"
                  fill="#1E293B"
                />

                {/* Taxi Bar */}
                <rect
                  x={bar2X}
                  y={taxiY}
                  width={barWidth}
                  height={Math.max(2, taxiH)}
                  rx="2"
                  fill="#F59E0B"
                />

                {/* Saving Bar */}
                <rect
                  x={bar3X}
                  y={savingY}
                  width={barWidth}
                  height={Math.max(2, savingH)}
                  rx="2"
                  fill="#059669"
                />

                {/* Percentage label above saving bar */}
                <text
                  x={bar3X + barWidth / 2}
                  y={savingY - 5}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#059669"
                  fontWeight="600"
                  className="font-mono tabular-nums"
                >
                  {r.savingPercentage.toFixed(0)}%
                </text>

                {/* Month Name */}
                <text
                  x={groupX + groupWidth / 2}
                  y={svgHeight - 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isSelected ? '#0F172A' : '#64748B'}
                  fontWeight={isSelected ? '700' : '500'}
                  className="font-mono tabular-nums"
                >
                  {r.monthName.split('/')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Month Detail Drawer / Panel */}
      {selectedRecord && (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                Detalhamento Mensal: {selectedRecord.monthName}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-xs text-slate-600">
                {selectedRecord.tripCount} corridas registradas
              </span>
            </div>
            <div className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
              Taxa de Eficiência: {selectedRecord.savingPercentage.toFixed(1)}% economizado
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
            <div>
              <span className="text-slate-600 block mb-0.5">Uber Total</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                {formatBRL(selectedRecord.uberSpend)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 block mb-0.5">Táxi Total</span>
              <span className="text-sm font-bold font-mono tabular-nums text-amber-700">
                {formatBRL(selectedRecord.taxiSpend)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 block mb-0.5">Gasto sem Otimização</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-500 line-through">
                {formatBRL(selectedRecord.benchmarkSpend)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 block mb-0.5">Saving Médio / Corrida</span>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                {formatBRL(selectedRecord.avgSavingPerTrip)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
