import React, { useState } from 'react';
import { OptimizationPolicy, MobilityFinancialSummary } from '../types/mobility';
import { MobilityService } from '../services/mobilityService';
import { Sliders, ShieldCheck, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface PolicyOptimizerProps {
  summary: MobilityFinancialSummary;
  onPolicyUpdated: () => void;
}

export const PolicyOptimizer: React.FC<PolicyOptimizerProps> = ({ summary, onPolicyUpdated }) => {
  const [policy, setPolicy] = useState<OptimizationPolicy>(MobilityService.getPolicy());
  const [savedNotice, setSavedNotice] = useState(false);

  const handleToggle = (key: keyof OptimizationPolicy) => {
    const updated = {
      ...policy,
      [key]: !policy[key],
    };
    setPolicy(updated);
    MobilityService.updatePolicy(updated);
    setSavedNotice(true);
    onPolicyUpdated();
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSliderChange = (key: 'surgeCapForTaxiSwitch' | 'strictApprovalAboveBRL', val: number) => {
    const updated = {
      ...policy,
      [key]: val,
    };
    setPolicy(updated);
    MobilityService.updatePolicy(updated);
    onPolicyUpdated();
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  // Projected impact calculations based on policy rules
  const extraMonthlyEstimatedSaving = 
    (policy.preferTaxiForAirports ? 850 : 0) +
    (policy.surgeCapForTaxiSwitch <= 1.4 ? 920 : 350) +
    (policy.preferTaxiInRain ? 640 : 0) +
    (policy.applyAppTaxiDiscounts ? 780 : 0);

  const projectedYearlySavingWithPolicy = summary.projectedAnnualSaving + (extraMonthlyEstimatedSaving * 12);

  return (
    <div className="space-y-6">
      {/* Policy Rules Grid */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              Políticas de Otimização & Governança de Gastos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina as regras automáticas de recomendação e restrições para maximizar o saving diário da empresa
            </p>
          </div>

          {savedNotice && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Políticas salvas com sucesso!</span>
            </div>
          )}
        </div>

        {/* Rule Sliders & Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          {/* Rule 1: Trava de Tarifa Dinâmica */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Trava Automática de Tarifa Dinâmica Uber
                </span>
                <span className="text-xs text-slate-500">
                  Sugerir Táxi imediatamente quando o multiplicador ultrapassar o teto
                </span>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-700 bg-white px-2 py-0.5 border border-slate-200 rounded">
                {policy.surgeCapForTaxiSwitch.toFixed(2)}x
              </span>
            </div>

            <input
              type="range"
              min={1.1}
              max={2.0}
              step={0.05}
              value={policy.surgeCapForTaxiSwitch}
              onChange={(e) => handleSliderChange('surgeCapForTaxiSwitch', parseFloat(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Mais conservador (1.1x)</span>
              <span>Recomendado: 1.35x</span>
              <span>Mais tolerante (2.0x)</span>
            </div>
          </div>

          {/* Rule 2: Teto de Aprovação Direta */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Alçada de Aprovação de Despesas
                </span>
                <span className="text-xs text-slate-500">
                  Corridas que ultrapassem este valor requerem justificativa ou roteamento prévio
                </span>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 bg-white px-2 py-0.5 border border-slate-200 rounded">
                {formatBRL(policy.strictApprovalAboveBRL)}
              </span>
            </div>

            <input
              type="range"
              min={50}
              max={250}
              step={5}
              value={policy.strictApprovalAboveBRL}
              onChange={(e) => handleSliderChange('strictApprovalAboveBRL', parseInt(e.target.value, 10))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>R$ 50,00</span>
              <span>Recomendado: R$ 95,00</span>
              <span>R$ 250,00</span>
            </div>
          </div>
        </div>

        {/* Binary Policy Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 mt-4 border-t border-slate-100">
          {/* Switch 1: Aeroportos */}
          <div 
            onClick={() => handleToggle('preferTaxiForAirports')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              policy.preferTaxiForAirports 
                ? 'bg-emerald-50/40 border-emerald-300' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Regra de Aeroportos
              </span>
              <input
                type="checkbox"
                checked={policy.preferTaxiForAirports}
                readOnly
                className="accent-emerald-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Priorizar cooperativas com tarifas fixas acordadas (Guarucoop / Aerotáxi) em translados GRU/CGH.
            </p>
          </div>

          {/* Switch 2: Chuva e Faixa Exclusiva */}
          <div 
            onClick={() => handleToggle('preferTaxiInRain')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              policy.preferTaxiInRain 
                ? 'bg-emerald-50/40 border-emerald-300' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Prioridade Chuva / Trânsito
              </span>
              <input
                type="checkbox"
                checked={policy.preferTaxiInRain}
                readOnly
                className="accent-emerald-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Em dias chuvosos, recomendar táxis para aproveitar corredores de ônibus e fugir do pico dinâmico.
            </p>
          </div>

          {/* Switch 3: Desconto App Táxi */}
          <div 
            onClick={() => handleToggle('applyAppTaxiDiscounts')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              policy.applyAppTaxiDiscounts 
                ? 'bg-emerald-50/40 border-emerald-300' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Desconto Convênio App (20%)
              </span>
              <input
                type="checkbox"
                checked={policy.applyAppTaxiDiscounts}
                readOnly
                className="accent-emerald-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Considerar desconto corporativo de 20% no taxímetro na comparação em tempo real com Uber.
            </p>
          </div>

          {/* Switch 4: Comfort/Black Restrito */}
          <div 
            onClick={() => handleToggle('allowBlackComfortOnlyForDirectors')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              policy.allowBlackComfortOnlyForDirectors 
                ? 'bg-emerald-50/40 border-emerald-300' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Diretoria Black / Comfort
              </span>
              <input
                type="checkbox"
                checked={policy.allowBlackComfortOnlyForDirectors}
                readOnly
                className="accent-emerald-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Categorias premium restritas a diretores ou clientes convidados. Outros cargos usam UberX / Táxi padrão.
            </p>
          </div>
        </div>
      </div>

      {/* Financial Projection of Policy Adoption */}
      <div className="bg-slate-900 text-white rounded-lg p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">
                Projeção de Economia com Políticas Ativas
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Impacto financeiro simulado com base no volume histórico da organização
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Economia Anual Projetada Total:</span>
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {formatBRL(projectedYearlySavingWithPolicy)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700">
            <div className="text-slate-400 mb-1">Ganho Adicional com Regra de Aeroportos</div>
            <div className="text-base font-bold font-mono tabular-nums text-emerald-400">
              +{formatBRL(policy.preferTaxiForAirports ? 850 : 0)} / mês
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Elimina surtos dinâmicos de até 2.2x nas marginais
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700">
            <div className="text-slate-400 mb-1">Ganho com Trava Dinâmica em {policy.surgeCapForTaxiSwitch.toFixed(2)}x</div>
            <div className="text-base font-bold font-mono tabular-nums text-emerald-400">
              +{formatBRL(policy.surgeCapForTaxiSwitch <= 1.4 ? 920 : 350)} / mês
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Roteamento automático para táxi regulado
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-md border border-slate-700">
            <div className="text-slate-400 mb-1">Impacto Total Mensal de Otimização</div>
            <div className="text-base font-bold font-mono tabular-nums text-white">
              +{formatBRL(extraMonthlyEstimatedSaving)} / mês
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Redução de gastos projetada em ~21.5%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
