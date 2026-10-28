import React, { useEffect, useMemo, useState } from 'react';
import { DailySavingRecord } from '../types/mobility';
import { OFFICIAL_GOOGLE_SHEET_ID } from '../services/sheetsService';

interface TaxiRealRow { monthKey: string; value: number | null; qty: number | null }
interface MonthlyViewProps { dailyRecords: DailySavingRecord[]; monthlyTarget: number }

type Kind = 'real' | 'pendente' | 'uber';
interface MonthItem {
  key: string; label: string; kind: Kind; partial: boolean; days: number;
  realValue: number | null; realQty: number | null;
  taxiEst: number; uber: number; trips: number;
  taxiEstProj: number; uberProj: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const mil = (v: number) => `${Math.round(v / 1000)}k`;

const TAXI_REAL_SHEET = 'Histórico Pagamentos Táxi Moove';

const toNum = (raw: string): number | null => {
  const t = (raw || '').replace(/R\$|\s/g, '');
  if (!t) return null;
  let n: number;
  if (t.includes(',')) n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) n = parseFloat(t.replace(/\./g, ''));
  else n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

const splitLine = (line: string): string[] => {
  const out: string[] = [];
  const re = /"((?:[^"]|"")*)"|([^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2]);
    if (re.lastIndex >= line.length) break;
    re.lastIndex++;
  }
  return out;
};

// Lê a aba direto do Google Sheets (mesmo método usado para Dados Uber e Config; não depende de servidor)
async function loadTaxiReal(): Promise<TaxiRealRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${OFFICIAL_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(TAXI_REAL_SHEET)}&_t=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  const csv = r.ok ? await r.text() : '';
  if (!/valor real/i.test(csv)) {
    throw new Error(`aba "${TAXI_REAL_SHEET}" não encontrada ou sem acesso (HTTP ${r.status}, ${csv.length} bytes)`);
  }
  const rows: TaxiRealRow[] = [];
  csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(1).forEach(line => {
    const [d, v, q] = splitLine(line);
    let monthKey = '';
    const us = (d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const iso = (d || '').match(/(\d{4})-(\d{2})-\d{2}/);
    if (us) monthKey = `${us[3]}-${us[1].padStart(2, '0')}`;
    else if (iso) monthKey = `${iso[1]}-${iso[2]}`;
    if (monthKey) rows.push({ monthKey, value: toNum(v), qty: toNum(q) });
  });
  return rows;
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({ dailyRecords, monthlyTarget }) => {
  const [taxiReal, setTaxiReal] = useState<TaxiRealRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    let alive = true;
    loadTaxiReal()
      .then(rows => { if (alive) { setTaxiReal(rows); setLoadError(rows.length ? '' : 'a aba foi lida, mas não retornou nenhum mês'); } })
      .catch(e => { if (alive) setLoadError(e?.message || 'erro desconhecido'); });
    return () => { alive = false; };
  }, []);

  const months = useMemo<MonthItem[]>(() => {
    const uberBy: Record<string, { taxi: number; uber: number; trips: number; days: number }> = {};
    dailyRecords.forEach(r => {
      const k = (r.date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(k)) return;
      const g = uberBy[k] || (uberBy[k] = { taxi: 0, uber: 0, trips: 0, days: 0 });
      g.taxi += r.taxiSpend; g.uber += r.uberSpend; g.trips += r.tripCount; g.days += 1;
    });
    const realBy: Record<string, TaxiRealRow> = {};
    taxiReal.forEach(r => { realBy[r.monthKey] = r; });
    const keys = Array.from(new Set([...Object.keys(realBy), ...Object.keys(uberBy)])).sort();
    const lastUberKey = Object.keys(uberBy).sort().pop();
    return keys.map(k => {
      const u = uberBy[k]; const r = realBy[k];
      const partial = !!u && k === lastUberKey && u.days < 28;
      const f = partial ? 30 / u.days : 1;
      const kind: Kind = u ? 'uber' : (r && r.value ? 'real' : 'pendente');
      return {
        key: k, label: MONTHS[parseInt(k.slice(5), 10) - 1] || k, kind, partial, days: u?.days || 0,
        realValue: r?.value ?? null, realQty: r?.qty ?? null,
        taxiEst: u?.taxi || 0, uber: u?.uber || 0, trips: u?.trips || 0,
        taxiEstProj: (u?.taxi || 0) * f, uberProj: (u?.uber || 0) * f,
      };
    });
  }, [dailyRecords, taxiReal]);

  const active = months.find(m => m.key === selected) || [...months].reverse().find(m => m.kind === 'uber') || months[months.length - 1];

  const W = 860, H = 300, pl = 70, pr = 30, pt = 36, pb = 50;
  const cw = W - pl - pr, ch = H - pt - pb;
  const maxV = Math.max(1000, ...months.map(m => Math.max(m.realValue || 0, m.taxiEstProj))) * 1.1;
  const y = (v: number) => pt + ch - (v / maxV) * ch;
  const slot = cw / Math.max(1, months.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * maxV);

  const savingYear = months.filter(m => m.kind === 'uber').reduce((a, m) => a + (m.taxiEst - m.uber), 0);

  if (!months.length) {
    return <div className="py-10 text-center text-xs text-slate-500">{loadError ? `Histórico do táxi não carregado: ${loadError}` : 'Carregando meses…'}</div>;
  }

  return (
    <div className="pt-3">
      {loadError && (
        <div className="mb-2 p-2 text-xs rounded border border-amber-300 bg-amber-50 text-amber-800">
          Histórico do táxi não carregado: {loadError}
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap mb-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs inline-block" style={{ background: '#64748b' }} />Táxi real pago</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-slate-300 inline-block" />Táxi estimado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-slate-900 inline-block" />Uber realizado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs inline-block border border-dashed border-slate-500" />Projeção do mês</span>
        <span className="ml-auto font-mono tabular-nums text-emerald-700 font-bold">Saving acumulado: {brl(savingYear)}</span>
      </div>
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-80 select-none">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={i ? '3 3' : undefined} />
              <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">{i ? `${Math.round(t / 1000)} mil` : '0'}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = pl + i * slot + slot / 2;
            const isSel = active?.key === m.key;
            const sav = (m.taxiEstProj - m.uberProj);
            return (
              <g key={m.key} className="cursor-pointer" onClick={() => setSelected(m.key)}>
                <rect x={cx - slot / 2 + 2} y={pt - 8} width={slot - 4} height={ch + 8} rx="4" fill={isSel ? '#f1f5f9' : 'transparent'} />
                {m.kind === 'real' && m.realValue != null && (<>
                  <rect x={cx - 15} y={y(m.realValue)} width="30" height={y(0) - y(m.realValue)} rx="3" fill="#64748b" />
                  <text x={cx} y={y(m.realValue) - 5} textAnchor="middle" fontSize="10" fill="#334155">{mil(m.realValue)}</text>
                </>)}
                {m.kind === 'pendente' && (
                  <rect x={cx - 15} y={y(0) - 40} width="30" height="40" rx="3" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
                )}
                {m.kind === 'uber' && (<>
                  {m.partial && <rect x={cx - 24} y={y(m.taxiEstProj)} width="22" height={y(0) - y(m.taxiEstProj)} rx="3" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />}
                  {m.partial && <rect x={cx + 2} y={y(m.uberProj)} width="22" height={y(0) - y(m.uberProj)} rx="3" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />}
                  <rect x={cx - 24} y={y(m.taxiEst)} width="22" height={y(0) - y(m.taxiEst)} rx="3" fill="#cbd5e1" />
                  <rect x={cx + 2} y={y(m.uber)} width="22" height={y(0) - y(m.uber)} rx="3" fill="#0f172a" />
                  <text x={cx} y={y(m.taxiEstProj) - 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857">{m.partial ? 'Saving proj.' : 'Saving'}</text>
                  <text x={cx} y={y(m.taxiEstProj) - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857">{brl(sav).replace(',00', '')}</text>
                </>)}
                <text x={cx} y={H - 28} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{m.label}</text>
                <text x={cx} y={H - 14} textAnchor="middle" fontSize="10" fill="#64748b">
                  {m.kind === 'real' ? 'real' : m.kind === 'pendente' ? 'pendente' : m.partial ? `parcial, ${m.days} dias` : 'fechado'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {active && (
        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2 lg:col-span-4 font-bold text-slate-800 pb-2 border-b border-slate-200">
            Detalhamento de {active.label}/{active.key.slice(0, 4)}
            {active.kind === 'uber' && active.partial ? ` · parcial (${active.days} dias apurados)` : ''}
            {active.kind === 'pendente' ? ' · aguardando preenchimento na planilha' : ''}
          </div>
          {active.kind === 'uber' ? (<>
            <div><span className="text-slate-500 block mb-0.5">Táxi estimado</span><span className="text-base font-bold font-mono text-slate-400 line-through">{brl(active.taxiEst)}</span></div>
            <div><span className="text-slate-500 block mb-0.5">Uber realizado</span><span className="text-base font-bold font-mono text-slate-900">{brl(active.uber)}</span></div>
            <div><span className="text-slate-500 block mb-0.5">Saving</span><span className="text-base font-bold font-mono text-emerald-700">{brl(active.taxiEst - active.uber)}</span></div>
            <div><span className="text-slate-500 block mb-0.5">{active.partial ? 'Projeção do mês' : 'Meta mensal'}</span><span className="text-base font-bold font-mono text-blue-700">{active.partial ? `${brl(active.taxiEstProj - active.uberProj)} (${Math.round(((active.taxiEstProj - active.uberProj) / monthlyTarget) * 100)}% da meta)` : brl(monthlyTarget)}</span></div>
          </>) : active.kind === 'real' ? (<>
            <div><span className="text-slate-500 block mb-0.5">Táxi real pago</span><span className="text-base font-bold font-mono text-slate-900">{brl(active.realValue || 0)}</span></div>
            <div><span className="text-slate-500 block mb-0.5">Quantidade</span><span className="text-base font-bold font-mono text-slate-900">{active.realQty ?? '—'}</span></div>
            <div><span className="text-slate-500 block mb-0.5">Custo médio</span><span className="text-base font-bold font-mono text-slate-900">{active.realQty ? brl((active.realValue || 0) / active.realQty) : '—'}</span></div>
          </>) : null}
        </div>
      )}
    </div>
  );
};
