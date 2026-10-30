import React, { useState, useEffect } from 'react';
import { DailySavingRecord, UberCsvTripRecord, SavingTargetConfig } from '../types/mobility';
import { MonthlyView, prefetchTaxiReal } from './MonthlyView';
import { Users, TrendingUp, DollarSign, Calendar, ChevronRight, MapPin, Award, MousePointerClick, Target, BarChart3, ArrowUpRight } from 'lucide-react';

interface DailySavingChartProps {
  dailyRecords: DailySavingRecord[];
  allTrips?: UberCsvTripRecord[];
  targetConfig?: SavingTargetConfig;
}

export const DailySavingChart: React.FC<DailySavingChartProps> = ({ 
  dailyRecords,
  allTrips = [],
  targetConfig
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'dia' | 'mes'>('dia');

  useEffect(() => { prefetchTaxiReal().catch(() => {}); }, []);

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

  // Metas e Estimativas (Mensal e Anual)
  const monthlyTarget = targetConfig?.targetType === 'value' ? targetConfig.targetValue : 100000;
  const annualTarget = monthlyTarget * 12;
  const daysInMonth = 30;

  const sampledDays = Math.max(1, dailyRecords.length);
  const avgDailySaving = totalSaving / sampledDays;
  const daysRemaining = Math.max(0, daysInMonth - sampledDays);

  const projectedMonthlySaving = avgDailySaving * daysInMonth;
  const projectedMonthlyPercent = (projectedMonthlySaving / monthlyTarget) * 100;
  const dailyPaceNeeded = daysRemaining > 0 ? Math.max(0, (monthlyTarget - totalSaving) / daysRemaining) : 0;
  const paceGap = dailyPaceNeeded - avgDailySaving;

  const annualRunRateSaving = avgDailySaving * 365;
  const annualProgressPercent = (annualRunRateSaving / annualTarget) * 100;

  // Escala vertical com folga para a linha real acumulada e para a linha da meta
  const maxTargetCumulative = (monthlyTarget / daysInMonth) * dailyRecords.length;
  const maxDailyTaxi = Math.max(...dailyRecords.map(r => r.taxiSpend), 1000) * 1.05;
  const maxCumulative = Math.max(...dailyRecords.map(r => r.cumulativeSaving), maxTargetCumulative, 1000) * 1.15;

  const svgWidth = 860;
  const svgHeight = 330;
  const paddingLeft = 85;
  const paddingRight = 85;
  const paddingTop = 40;
  const paddingBottom = 55;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const barGroupWidth = chartWidth / Math.max(1, dailyRecords.length);
  const barWidth = Math.min(44, barGroupWidth * 0.32);

  // Active day record for touch & selection
  const activeRecord = dailyRecords[hoveredIndex !== null ? hoveredIndex : selectedIndex] || dailyRecords[0];

  // Triagens do dia selecionado
  const selectedDateStr = dailyRecords[selectedIndex]?.date || '';
  const selectedDayTrips = allTrips.filter(t => t.requestDateLocal === selectedDateStr);

  // Pontos da linha acumulada real
  const cumulativePoints = dailyRecords.map((r, i) => {
    const cx = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
    const cy = paddingTop + chartHeight - (r.cumulativeSaving / maxCumulative) * chartHeight;
    return { x: cx, y: cy, val: r.cumulativeSaving };
  });

  const cumulativePolyline = cumulativePoints.map(p => `${p.x},${p.y}`).join(' ');

  // Pontos da linha de ritmo esperado da meta linear
  const idealTargetPoints = dailyRecords.map((r, i) => {
    const cx = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
    const idealVal = (monthlyTarget / daysInMonth) * (i + 1);
    const cy = paddingTop + chartHeight - (idealVal / maxCumulative) * chartHeight;
    return { x: cx, y: cy, val: idealVal };
  });

  const idealTargetPolyline = idealTargetPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-6">
      {/* Main Chart Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        {/* Title & Legend */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {viewMode === 'dia' ? 'Evolução Diária do Saving e Curva Acumulada' : 'Evolução Mensal do Custo e do Saving'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
              <span>{viewMode === 'dia' ? 'Comparativo diário de desembolso efetivo Uber vs táxi estimado' : 'Táxi real pago, táxi estimado e Uber realizado por mês'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-700 font-bold">
                Saving Total: {formatBRL(totalSaving)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs" role="group" aria-label="Visão do gráfico">
            {(['dia', 'mes'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded font-semibold ${viewMode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {m === 'dia' ? 'Dia' : 'Mês'}
              </button>
            ))}
          </div>
          {viewMode === 'dia' && (
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
              <span className="font-semibold text-blue-700">Saving Acumulado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-600 inline-block"></span>
              <span className="w-2 h-2 rounded-full bg-amber-600 border border-white inline-block -ml-1"></span>
              <span className="font-semibold text-amber-800">Ritmo da Meta ({formatBRL(monthlyTarget / daysInMonth)}/dia)</span>
            </div>
          </div>
          )}
          </div>
        </div>

        {/* Painel Executivo de Estimativas (Mensal & Anual Aplicado na Evolução Diária) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-3 p-3 bg-gradient-to-r from-slate-50 via-blue-50/25 to-emerald-50/30 border border-slate-200 rounded-lg text-xs">
          {/* Ritmo Médio Diário */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Ritmo Médio da Operação
            </span>
            <div className="text-base font-bold font-mono tabular-nums text-slate-900">
              {formatBRL(avgDailySaving)} <span className="text-xs font-normal text-slate-500">/dia</span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              Média consolidada em {sampledDays} datas apuradas
            </span>
          </div>

          {/* Estimativa Mensal */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
              Estimativa Mensal (30 dias)
            </span>
            <div className="text-base font-bold font-mono tabular-nums text-blue-700">
              {formatBRL(projectedMonthlySaving)}
            </div>
            <span className="text-[10px] font-medium text-blue-800/80 block">
              {projectedMonthlyPercent.toFixed(1)}% da Meta Mensal ({formatBRL(monthlyTarget)})
            </span>
          </div>

          {/* Ritmo Necessário */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
              Ritmo Necessário p/ Meta
            </span>
            <div className="text-base font-bold font-mono tabular-nums text-amber-800">
              {formatBRL(dailyPaceNeeded)} <span className="text-xs font-normal text-slate-500">/dia</span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              {paceGap <= 0 ? 'Ritmo atual já atinge a meta!' : `Diferença de ${formatBRL(paceGap)}/dia em ${daysRemaining} dias`}
            </span>
          </div>

          {/* Estimativa Anualizada */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
              Estimativa Anual (Run-Rate)
            </span>
            <div className="text-base font-bold font-mono tabular-nums text-emerald-600">
              {formatBRL(annualRunRateSaving)} <span className="text-xs font-normal text-slate-500">/ano</span>
            </div>
            <span className="text-[10px] font-medium text-emerald-800/80 block">
              {annualProgressPercent.toFixed(1)}% da Meta Anual ({formatBRL(annualTarget)})
            </span>
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
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {totalPassengers} passageiros
              </span>
              {totalTrips > 0 && (
                <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-semibold border border-blue-100" title="Média de colaboradores por viagem/carro">
                  {(totalPassengers / totalTrips).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/carro
                </span>
              )}
            </div>
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

        {viewMode === 'mes' ? (
          <MonthlyView dailyRecords={dailyRecords} monthlyTarget={monthlyTarget} />
        ) : (<>
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
                  {/* High-contrast Saving % label INSIDE the green bar - centered and clean */}
                  <text
                    x={bar2X + barWidth / 2}
                    y={taxiY + Math.max(12, Math.min(savingH / 2 + 4, savingH - 4))}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#FFFFFF"
                    className="font-mono tabular-nums font-extrabold select-none pointer-events-none"
                  >
                    +{formatPercent(r.savingPercent)}
                  </text>

                  {/* X Axis Label: 2 linhas organizadas para eliminar sobreposição horizontal entre dias */}
                  <text
                    x={groupX + barGroupWidth / 2}
                    y={svgHeight - 24}
                    textAnchor="middle"
                    fontSize="11"
                    fill={isSelected ? '#0F172A' : '#334155'}
                    fontWeight={isSelected ? '700' : '600'}
                    className="font-mono tabular-nums"
                  >
                    Dia {r.displayDate}
                  </text>
                  <text
                    x={groupX + barGroupWidth / 2}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isSelected ? '#2563EB' : '#64748B'}
                    fontWeight={isSelected ? '600' : '500'}
                    className="font-mono tabular-nums"
                  >
                    {r.tripCount} viagens
                  </text>
                </g>
              );
            })}

            {/* Ideal Target Pace Line (Amber dashed line #D97706) */}
            {idealTargetPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#D97706"
                strokeWidth="2"
                strokeDasharray="4 4"
                points={idealTargetPolyline}
              />
            )}

            {/* Ideal Target Markers */}
            {idealTargetPoints.map((pt, idx) => (
              <g key={`ideal-pt-${idx}`} className="pointer-events-none">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </g>
            ))}

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
              const pillWidth = 86;
              const pillHeight = 18;
              const pillX = pt.x - pillWidth / 2;
              const pillY = Math.max(8, pt.y - 24);

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
                    r="4"
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
                    y={pillY + 12.5}
                    textAnchor="middle"
                    fontSize="9"
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
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="font-bold text-slate-900 text-sm">
                  Detalhamento do Dia {activeRecord.displayDate}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {activeRecord.tripCount} viagens realizadas
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md shadow-2xs font-normal">
                  <MousePointerClick className="w-3 h-3 text-slate-400" />
                  Clique nas colunas do gráfico para ver outro dia
                </span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-emerald-800 bg-emerald-100 text-xs shrink-0">
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

            {/* Comparativo do Dia com a Meta Estipulada */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-white/70 -mx-1 px-3 py-1.5 rounded">
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-slate-600 text-[11px]">
                  Meta Diária Ideal: <strong className="font-mono text-slate-800">{formatBRL(monthlyTarget / daysInMonth)}/dia</strong>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600 text-[11px]">
                  Atingimento no Dia: <strong className={`font-mono ${activeRecord.saving >= (monthlyTarget / daysInMonth) ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {((activeRecord.saving / (monthlyTarget / daysInMonth)) * 100).toFixed(1)}%
                  </strong>
                </span>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold font-mono ${
                  activeRecord.saving >= (monthlyTarget / daysInMonth) 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeRecord.saving >= (monthlyTarget / daysInMonth)
                    ? `+${formatBRL(activeRecord.saving - (monthlyTarget / daysInMonth))} acima da meta diária`
                    : `${formatBRL(activeRecord.saving - (monthlyTarget / daysInMonth))} abaixo da meta diária`}
                </span>
              </div>
            </div>
          </div>
        )}
        </>)}
      </div>

      {viewMode === 'dia' && (
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
      )}
    </div>
  );
};
