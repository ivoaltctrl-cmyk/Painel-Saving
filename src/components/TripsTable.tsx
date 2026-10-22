import React, { useState, useMemo } from 'react';
import { UberCsvTripRecord } from '../types/mobility';
import { 
  Search, 
  Download, 
  Users, 
  MapPin, 
  Clock, 
  Car, 
  FileSpreadsheet,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface TripsTableProps {
  trips: UberCsvTripRecord[];
  onOpenSyncModal: () => void;
  taxiReferenceRate: number;
}

export const TripsTable: React.FC<TripsTableProps> = ({
  trips,
  onOpenSyncModal,
  taxiReferenceRate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedStops, setSelectedStops] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'saving' | 'cost' | 'passengers'>('date');
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const dates = useMemo(() => {
    const set = new Set<string>();
    trips.forEach(t => {
      if (t.requestDateLocal) set.add(t.requestDateLocal);
    });
    return Array.from(set).sort();
  }, [trips]);

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const matchSearch =
        t.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.bookerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.passengerNames.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDate = selectedDate === 'all' || t.requestDateLocal === selectedDate;
      const matchStops = selectedStops === 'all' || t.passengerCount.toString() === selectedStops;

      return matchSearch && matchDate && matchStops;
    }).sort((a, b) => {
      if (sortBy === 'saving') return b.saving - a.saving;
      if (sortBy === 'cost') return b.valueBrl - a.valueBrl;
      if (sortBy === 'passengers') return b.passengerCount - a.passengerCount;
      // Default: date and time desc
      return new Date(`${b.requestDateLocal}T${b.requestTimeLocal}`).getTime() - 
             new Date(`${a.requestDateLocal}T${a.requestTimeLocal}`).getTime();
    });
  }, [trips, searchTerm, selectedDate, selectedStops, sortBy]);

  const totalFilteredUber = filteredTrips.reduce((acc, t) => acc + t.valueBrl, 0);
  const totalFilteredTaxi = filteredTrips.length * taxiReferenceRate;
  const totalFilteredSaving = totalFilteredTaxi - totalFilteredUber;
  const totalFilteredPassengers = filteredTrips.reduce((acc, t) => acc + t.passengerCount, 0);

  const handleExportCSV = () => {
    const headers = [
      'ID da Viagem',
      'Data Local',
      'Hora Local',
      'Solicitante Central',
      'Passageiros',
      'Qtd Passageiros',
      'Origem',
      'Destino',
      'Distancia (mi)',
      'Distancia (km)',
      'Duracao (min)',
      'Valor Uber (BRL)',
      'Referencia Taxi (BRL)',
      'Saving (BRL)',
      'Reducao (%)',
      'Informacoes da Parada'
    ];

    const rows = filteredTrips.map(t => [
      t.id,
      t.requestDateLocal,
      t.requestTimeLocal,
      `"${t.bookerName.replace(/"/g, '""')}"`,
      `"${t.passengerNames.join(' | ').replace(/"/g, '""')}"`,
      t.passengerCount,
      `"${t.origin.replace(/"/g, '""')}"`,
      `"${t.destination.replace(/"/g, '""')}"`,
      t.distanceMiles.toFixed(2),
      t.distanceKm.toFixed(1),
      t.durationMin,
      t.valueBrl.toFixed(2),
      t.taxiReferenceCost.toFixed(2),
      t.saving.toFixed(2),
      t.savingPercent.toFixed(1),
      `"${t.stopInfo.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `base_uber_saving_transporte_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Table Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Base de Dados de Transporte (Uber Central)
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
            <span>{filteredTrips.length} de {trips.length} registros</span>
            <span aria-hidden="true">·</span>
            <span>Passageiros: <strong>{totalFilteredPassengers}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Uber: <strong className="font-mono tabular-nums text-slate-900">{formatBRL(totalFilteredUber)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Táxi Ref: <strong className="font-mono tabular-nums text-slate-500">{formatBRL(totalFilteredTaxi)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Saving: <strong className="font-mono tabular-nums text-emerald-600">+{formatBRL(totalFilteredSaving)}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Sincronizar Sheets / CSV</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3 border-b border-slate-100 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por passageiro, destino, solicitante..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Date Filter */}
        <div>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todas as Datas ({dates.length} dias)</option>
            {dates.map((d) => {
              const parts = d.split('-');
              const label = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
              return <option key={d} value={d}>Dia {label}</option>;
            })}
          </select>
        </div>

        {/* Passenger count filter */}
        <div>
          <select
            value={selectedStops}
            onChange={(e) => setSelectedStops(e.target.value)}
            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todas as Lotações</option>
            <option value="1">1 Passageiro (Direto)</option>
            <option value="2">2 Passageiros (1 Parada)</option>
            <option value="3">3 Passageiros (2 Paradas)</option>
          </select>
        </div>

        {/* Sort by */}
        <div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full py-1.5 px-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="date">Mais Recentes Primeiro</option>
            <option value="saving">Maior Saving (R$)</option>
            <option value="cost">Maior Valor Efetivo Uber</option>
            <option value="passengers">Mais Passageiros Transportados</option>
          </select>
        </div>
      </div>

      {/* Grid of trips */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/70 font-semibold">
              <th className="py-2.5 px-3">Data / Hora</th>
              <th className="py-2.5 px-3">Solicitante</th>
              <th className="py-2.5 px-3">Passageiro(s)</th>
              <th className="py-2.5 px-3">Origem ➔ Destino</th>
              <th className="py-2.5 px-3 text-center">Dist / Tempo</th>
              <th className="py-2.5 px-3 text-right">Valor Uber</th>
              <th className="py-2.5 px-3 text-right">Ref. Táxi</th>
              <th className="py-2.5 px-3 text-right">Saving (R$)</th>
              <th className="py-2.5 px-3 text-center">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTrips.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredTrips.map((trip) => {
                const parts = trip.requestDateLocal.split('-');
                const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : trip.requestDateLocal;
                const isExpanded = expandedTripId === trip.id;

                return (
                  <React.Fragment key={trip.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      {/* Date / Time */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 font-mono tabular-nums">{displayDate}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">{trip.requestTimeLocal}</div>
                      </td>

                      {/* Booker */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{trip.bookerName.split(' ')[0]} {trip.bookerName.split(' ').slice(-1)[0]}</div>
                        <div className="text-[11px] text-slate-400">{trip.service}</div>
                      </td>

                      {/* Passengers */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={trip.passengerNames.join(', ')}>
                            {trip.passengerNames[0]}
                          </span>
                          {trip.passengerCount > 1 && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded shrink-0">
                              +{trip.passengerCount - 1}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {trip.passengerCount} {trip.passengerCount === 1 ? 'passageiro' : 'passageiros'}
                        </div>
                      </td>

                      {/* Route */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-900 truncate" title={`${trip.origin} ➔ ${trip.destination}`}>
                          {trip.origin.split(',')[0]} ➔ {trip.destination.split(',')[0]}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={trip.destination}>
                          {trip.destination.split(',').slice(1, 3).join(',')}
                        </div>
                      </td>

                      {/* Dist / Duration */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono tabular-nums">
                        <div className="font-medium text-slate-800">{trip.distanceKm} km</div>
                        <div className="text-[11px] text-slate-400">{trip.durationMin} min</div>
                      </td>

                      {/* Uber Value */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatBRL(trip.valueBrl)}
                      </td>

                      {/* Taxi Reference */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {formatBRL(trip.taxiReferenceCost)}
                      </td>

                      {/* Saving */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-emerald-600">
                          +{formatBRL(trip.saving)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-emerald-700">
                          {trip.savingPercent.toFixed(1)}% redução
                        </div>
                      </td>

                      {/* Expand / Details */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded"
                          title="Ver roteiro completo das paradas"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Stop Information Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="py-3 px-4 text-xs">
                          <div className="space-y-1.5 p-2 bg-white rounded border border-slate-200">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>Informações Detalhadas da Parada / Roteiro dos Colaboradores:</span>
                            </div>
                            <div className="text-slate-700 font-mono text-[11px] leading-relaxed break-words bg-slate-50 p-2 rounded border border-slate-100">
                              {trip.stopInfo || 'Sem detalhamento adicional de paradas.'}
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 flex-wrap">
                              <span><strong>ID da Viagem:</strong> {trip.id}</span>
                              <span aria-hidden="true">·</span>
                              <span><strong>Custo por Passageiro nesta Corrida:</strong> {formatBRL(trip.valueBrl / trip.passengerCount)}</span>
                              <span aria-hidden="true">·</span>
                              <span><strong>Economia nesta Corrida:</strong> {formatBRL(trip.saving)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
