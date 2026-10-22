import React, { useState } from 'react';
import { MobilityTrip, ModalType, MobilityCategory, TripDepartment, TripReason } from '../types/mobility';
import { MobilityService } from '../services/mobilityService';
import { X, Check } from 'lucide-react';

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripAdded: () => void;
}

export const NewTripModal: React.FC<NewTripModalProps> = ({ isOpen, onClose, onTripAdded }) => {
  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [date, setDate] = useState(today);
  const [time, setTime] = useState(timeNow);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [distanceKm, setDistanceKm] = useState('8.5');
  const [durationMin, setDurationMin] = useState('28');
  const [passengerName, setPassengerName] = useState('');
  const [department, setDepartment] = useState<TripDepartment>('Vendas & Novos Negócios');
  const [reason, setReason] = useState<TripReason>('Reunião com Cliente');
  const [chosenModal, setChosenModal] = useState<ModalType>('uber');
  const [chosenCategory, setChosenCategory] = useState<MobilityCategory>('UberX');
  const [actualCost, setActualCost] = useState('32.50');
  const [alternativeCost, setAlternativeCost] = useState('48.00');
  const [surgeMultiplier, setSurgeMultiplier] = useState('1.0');
  const [weatherCondition, setWeatherCondition] = useState<MobilityTrip['weatherCondition']>('Ensolarado');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const actual = parseFloat(actualCost) || 0;
    const alternative = parseFloat(alternativeCost) || actual;
    const saving = Math.round((alternative - actual) * 100) / 100;
    const savingPercentage = alternative > 0 ? Math.round((saving / alternative) * 1000) / 10 : 0;

    MobilityService.addTrip({
      date,
      time,
      origin: origin || 'Sede Corporativa - Av. Paulista',
      destination: destination || 'Cliente - Av. Faria Lima',
      distanceKm: parseFloat(distanceKm) || 5.0,
      durationMin: parseInt(durationMin, 10) || 20,
      passengerName: passengerName || 'Colaborador',
      department,
      reason,
      chosenModal,
      chosenCategory,
      actualCost: actual,
      alternativeCost: alternative,
      saving,
      savingPercentage,
      surgeMultiplier: parseFloat(surgeMultiplier) || 1.0,
      weatherCondition,
      trafficCondition: parseInt(durationMin, 10) > 30 ? 'Intenso' : 'Moderado',
      optimalChoice: saving >= 0,
      notes,
    });

    onTripAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Registrar Nova Corrida de Mobilidade
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Insira os dados da viagem para recalcular o saving em tempo real
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Horário</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Origem</label>
              <input
                type="text"
                required
                placeholder="Ex: Av. Paulista, 1000"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Destino</label>
              <input
                type="text"
                required
                placeholder="Ex: Aeroporto Congonhas"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Passenger & Dept */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Nome do Passageiro</label>
              <input
                type="text"
                required
                placeholder="Ex: Juliana Santos"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Departamento</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="Vendas & Novos Negócios">Vendas & Novos Negócios</option>
                <option value="Executivo & Diretoria">Executivo & Diretoria</option>
                <option value="Operações & Logística">Operações & Logística</option>
                <option value="Jurídico & Compliance">Jurídico & Compliance</option>
                <option value="Consultoria & Atendimento">Consultoria & Atendimento</option>
              </select>
            </div>
          </div>

          {/* Distancia, Duracao, Clima */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Distância (km)</label>
              <input
                type="number"
                step="0.1"
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Duração (min)</label>
              <input
                type="number"
                required
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Clima</label>
              <select
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="Ensolarado">Ensolarado</option>
                <option value="Nublado">Nublado</option>
                <option value="Chuva Moderada">Chuva Moderada</option>
                <option value="Chuva Intensa">Chuva Intensa</option>
              </select>
            </div>
          </div>

          {/* Modal & Categoria */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Modal Escolhido</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChosenModal('uber');
                    setChosenCategory('UberX');
                  }}
                  className={`flex-1 py-1.5 font-bold rounded border transition-colors ${
                    chosenModal === 'uber'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Uber
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChosenModal('taxi');
                    setChosenCategory('Táxi Convencional');
                  }}
                  className={`flex-1 py-1.5 font-bold rounded border transition-colors ${
                    chosenModal === 'taxi'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Táxi
                </button>
              </div>
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Categoria</label>
              <select
                value={chosenCategory}
                onChange={(e) => setChosenCategory(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              >
                {chosenModal === 'uber' ? (
                  <>
                    <option value="UberX">UberX</option>
                    <option value="Uber Comfort">Uber Comfort</option>
                    <option value="Uber Black">Uber Black</option>
                  </>
                ) : (
                  <>
                    <option value="Táxi Convencional">Táxi Convencional</option>
                    <option value="Táxi Especial/Aeroporto">Táxi Especial/Aeroporto</option>
                    <option value="Táxi Executivo">Táxi Executivo</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Financial Values: Real Cost vs Alternative */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Valor Pago (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Cotação Outro Modal (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={alternativeCost}
                onChange={(e) => setAlternativeCost(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Tarifa Dinâmica Uber</label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="3.0"
                value={surgeMultiplier}
                onChange={(e) => setSurgeMultiplier(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="font-medium text-slate-700 block mb-1">Observações da Corrida</label>
            <input
              type="text"
              placeholder="Ex: Trânsito intenso na Marginal, optou por táxi pela faixa exclusiva"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar Corrida</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
