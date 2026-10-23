import React, { useState } from 'react';
import { DailySavingRecord, UberCsvTripRecord } from '../types/mobility';
import { Users, TrendingUp, DollarSign, Calendar, ChevronRight, MapPin, Award } from 'lucide-react';

interface DailySavingChartProps {
  dailyRecords: DailySavingRecord[];
  allTrips?: UberCsvTripRecord[];
}

export const DailySavingChart: React.FC<DailySavingChartProps> = ({ 
  dailyRecords,
  allTrips = []
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const totalSaving = dailyRecords.reduce((acc, r) => acc + r.saving, 0);
  const totalUber = dailyRecords.reduce((acc, r) => acc + r.uberSpend, 0);
  const totalTaxi = dailyRecords.reduce((acc, r) => acc + r.taxiSpend, 0);
  const totalTrips = dailyRecords.reduce((acc, r) => acc + r.tripCount, 0);
  const totalPassengers = dailyRecords.reduce((acc, r) => acc + r.passengerCount, 0);

  const maxDailyTaxi = Math.max(...dailyRecords.map(r => r.taxiSpend), 5000);
  const maxCumulative = Math.max(...dailyRecords.map(r => r.cumulativeSaving), 6000) * 1.14;

  const svgWidth = 780;
  const svgHeight = 310;
  const paddingLeft = 85;
  const paddingRight = 85;
  const paddingTop = 45;
  const paddingBottom = 45;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barGroupWidth = chartWidth / Math.max(1, dailyRecords.length);
  const barWidth = Math.min(44, barGroupWidth * 0.32);

  // Active day record for touch & selection
  const activeRecord = dailyRecords[hoveredIndex !== null ? hoveredIndex : selectedIndex] || dailyRecords[0];

  // Triagens do dia selecionado
  const selectedDateStr = dailyRecords[selectedIndex]?.date || '';
  const selectedDayTrips = allTrips.filter(t => t.requestDateLocal === selectedDateStr);

  // Pontos da linha acumulada
  const cumulativePoints = dailyRecords.map((r, i) => {
    const cx = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
    const cy = paddingTop + chartHeight - (r.cumulativeSaving / maxCumulative) * chartHeight;
    return { x: cx, y: cy, val: r.cumulativeSaving };
  });

  const cumulativePolyline = cumulativePoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-6">
      {/* Main Chart Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        {/* Title & Legend */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evolução Diária do Saving e Curva Acumulada
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
              <span>Comparativo diário de desembolso efetivo Uber vs táxi estimado</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-700 font-bold">
                Saving Total: {formatBRL(totalSaving)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-slate-300 inline-block"></span>
              <span>Táxi Estimado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-slate-900 inline-block"></span>
              <span>Uber Realizado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span>
              <span>Saving do Dia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-blue-600 inline-block rounded-xs"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white inline-block -ml-1.5"></span>
              <span className="font-semibold text-blue-700">Linha Acumulada</span>
            </div>
          </div>
        </div>

        {/* Quick Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 my-2 text-xs border-b border-slate-100">
          <div>
            <span className="text-slate-500 block mb-0.5">Total de Atendimentos</span>
            <span className="text-base font-bold font-mono tabular-nums text-slate-900">
              {totalTrips} viagens
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Passageiros Transportados</span>
            <span className="text-base font-bold font-mono tabular-nums text-slate-900">
              {totalPassengers} passageiros
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Custo Estimado Táxi</span>
            <span className="text-base font-bold font-mono tabular-nums text-slate-400 line-through">
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
            className="w-full h-80 select-none"
          >
            <defs>
              <filter id="chartBadgeShadow" x="-15%" y="-25%" width="130%" height="160%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.12" />
              </filter>
            </defs>

            {/* Horizontal Grid lines with Brazilian currency formatting */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = paddingTop + chartHeight * (1 - pct);
              const value = maxDailyTaxi * pct;
              const cumValue = maxCumulative * pct;
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
                  {/* Left Y Axis (Daily BRL) */}
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748B"
                    className="font-mono tabular-nums"
                  >
                    {formatBRL(value)}
                  </text>
                  {/* Right Y Axis (Cumulative BRL - Distinct Royal Blue) */}
                  <text
                    x={svgWidth - paddingRight + 8}
                    y={y + 4}
                    textAnchor="start"
                    fontSize="10"
                    fill="#2563EB"
                    className="font-mono tabular-nums font-semibold"
                  >
                    {formatBRL(cumValue)}
                  </text>
                </g>
              );
            })}

            {/* Side-by-side comparison bars for each day */}
            {dailyRecords.map((r, i) => {
              const groupX = paddingLeft + i * barGroupWidth;
              const isSelected = selectedIndex === i;
              const isHovered = hoveredIndex === i;

              const taxiH = (r.taxiSpend / maxDailyTaxi) * chartHeight;
              const uberH = (r.uberSpend / maxDailyTaxi) * chartHeight;
              const savingH = (r.saving / maxDailyTaxi) * chartHeight;

              const taxiY = paddingTop + chartHeight - taxiH;
              const uberY = paddingTop + chartHeight - uberH;

              const bar1X = groupX + (barGroupWidth - barWidth * 2 - 10) / 2;
              const bar2X = bar1X + barWidth + 8;

              return (
                <g
                  key={r.date}
                  className="cursor-pointer"
                  onClick={() => setSelectedIndex(i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Background selection highlight */}
                  <rect
                    x={groupX + 4}
                    y={paddingTop - 10}
                    width={barGroupWidth - 8}
                    height={chartHeight + 18}
                    fill={isSelected ? '#F1F5F9' : isHovered ? '#F8FAFC' : 'transparent'}
                    stroke={isSelected ? '#CBD5E1' : 'transparent'}
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
                  {/* Clean value label above taxi bar */}
                  <text
                    x={bar1X + barWidth / 2}
                    y={taxiY - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#475569"
                    className="font-mono tabular-nums font-bold"
                  >
                    {formatBRL(r.taxiSpend)}
                  </text>

                  {/* Uber Bar */}
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
                    height={Math.max(4, savingH)}
                    rx="4"
                    fill="#059669"
                  />
                  {/* High-contrast Saving % label INSIDE the green bar (avoids overlap with line above) */}
                  <text
                    x={bar2X + barWidth / 2}
                    y={taxiY + Math.min(Math.max(13, savingH / 2), 20)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#FFFFFF"
                    className="font-mono tabular-nums font-extrabold select-none pointer-events-none"
                  >
                    +{formatPercent(r.savingPercent)}
                  </text>
                  {savingH >= 34 && (
                    <text
                      x={bar2X + barWidth / 2}
                      y={taxiY + Math.min(Math.max(25, savingH / 2 + 12), 34)}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#DCFCE7"
                      className="font-mono tabular-nums font-semibold select-none pointer-events-none"
                    >
                      {formatBRL(r.saving)}
                    </text>
                  )}

                  {/* X Axis Label */}
                  <text
                    x={groupX + barGroupWidth / 2}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fill={isSelected ? '#0F172A' : '#475569'}
                    fontWeight={isSelected ? '700' : '600'}
                    className="font-mono tabular-nums"
                  >
                    Dia {r.displayDate} ({r.tripCount} viagens)
                  </text>
                </g>
              );
            })}

            {/* Cumulative Saving Line (Royal Blue #2563EB - completely eliminates green-on-green collision) */}
            {cumulativePoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.8"
                strokeDasharray="5 3"
                points={cumulativePolyline}
              />
            )}

            {/* Cumulative Nodes & Non-colliding Pill Badges */}
            {cumulativePoints.map((pt, idx) => {
              const pillWidth = 104;
              const pillHeight = 20;
              const pillX = pt.x - pillWidth / 2;
              const pillY = Math.max(6, pt.y - 28);

              return (
                <g key={`cum-${idx}`} className="pointer-events-none">
                  {/* Subtle vertical connector between node and badge */}
                  <line
                    x1={pt.x}
                    y1={pt.y}
                    x2={pt.x}
                    y2={pillY + pillHeight}
                    stroke="#93C5FD"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  {/* Line Marker Node */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  {/* High-contrast Pill Badge */}
                  <rect
                    x={pillX}
                    y={pillY}
                    width={pillWidth}
                    height={pillHeight}
                    rx="4"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="1.2"
                    filter="url(#chartBadgeShadow)"
                  />
                  <text
                    x={pt.x}
                    y={pillY + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#1D4ED8"
                    className="font-mono tabular-nums font-bold"
                  >
                    Acum: {formatBRL(pt.val)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Touch-Friendly Persistent Metrics Strip (No Hover Required) */}
        {activeRecord && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="font-bold text-slate-900 text-sm">
                  Detalhamento do Dia {activeRecord.displayDate}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {activeRecord.tripCount} viagens realizadas
                </span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-emerald-800 bg-emerald-100 text-xs">
                Saving: +{formatPercent(activeRecord.savingPercent)} ({formatBRL(activeRecord.saving)})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Custo Táxi Estimado:</span>
                <span className="font-mono tabular-nums font-bold text-slate-700">
                  {formatBRL(activeRecord.taxiSpend)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Desembolso Real Uber:</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatBRL(activeRecord.uberSpend)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Passageiros Transportados:</span>
                <span className="font-mono tabular-nums font-bold text-slate-800">
                  {activeRecord.passengerCount} colaboradores
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Custo Médio / Passageiro:</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  {formatBRL(activeRecord.avgUberPerPassenger)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3) f) Tabela com as Corridas do Dia Selecionado Logo Abaixo do Gráfico */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600" />
              Corridas do Dia {dailyRecords[selectedIndex]?.displayDate || ''} ({selectedDayTrips.length} viagens)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Listagem individual das viagens faturadas pela Uber Central na data selecionada
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Total do dia: <strong className="text-slate-900">{formatBRL(dailyRecords[selectedIndex]?.uberSpend || 0)}</strong>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Hora Local</th>
                <th className="py-2.5 px-3">Passageiro(s)</th>
                <th className="py-2.5 px-3">Origem ➔ Destino</th>
                <th className="py-2.5 px-3 text-center">Dist / Tempo</th>
                <th className="py-2.5 px-3 text-right">Valor Uber</th>
                <th className="py-2.5 px-3 text-right">Ref. Táxi</th>
                <th className="py-2.5 px-3 text-right">Saving (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {selectedDayTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Nenhuma viagem registrada para esta data.
                  </td>
                </tr>
              ) : (
                selectedDayTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {trip.requestTimeLocal}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-[160px]">
                        {trip.passengerNames.join(', ')}
                      </div>
                      <div className="text-[11px] text-slate-400">{trip.passengerCount} passageiro(s)</div>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="truncate font-medium text-slate-800" title={trip.destination}>
                        {trip.origin.split(',')[0]} ➔ {trip.destination.split(',')[0]}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate" title={trip.destination}>
                        {trip.destination}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                      <div>{trip.distanceKm} km</div>
                      <div className="text-[11px] text-slate-400">{trip.durationMin} min</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatBRL(trip.valueBrl)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {formatBRL(trip.taxiReferenceCost)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 whitespace-nowrap">
                      +{formatBRL(trip.saving)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
