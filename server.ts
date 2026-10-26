import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistence directory and file for shared settings
const DATA_DIR = path.resolve(__dirname, 'data');
const TARGET_FILE = path.resolve(DATA_DIR, 'target-config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Server] Could not create data directory:', err);
  }
}

// Default target
let currentTargetConfig: {
  targetType: 'value' | 'percent';
  targetValue: number;
  month: string;
  updatedAt: string;
  updatedBy: string;
  sheetsWebhookUrl?: string;
} = {
  targetType: 'value',
  targetValue: 50000,
  month: '2026-10',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Planilha Google Sheets (Aba Config)'
};

// Load persisted target config if exists
try {
  if (fs.existsSync(TARGET_FILE)) {
    const raw = fs.readFileSync(TARGET_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.targetValue === 'number') {
      currentTargetConfig = { ...currentTargetConfig, ...parsed };
      console.log('[Server] Loaded persisted shared target:', currentTargetConfig);
    }
  }
} catch (err) {
  console.warn('[Server] Could not read target-config.json:', err);
}

// In-memory store for server-side API integration
let tripsData = [
  {
    id: 'TRIP-API-101',
    date: '2026-10-22',
    time: '08:45',
    origin: 'Av. Paulista, 1100 - Bela Vista',
    destination: 'Av. Brig. Faria Lima, 3477 - Itaim Bibi',
    distanceKm: 7.8,
    durationMin: 32,
    passengerName: 'Camila Guimarães',
    department: 'Vendas & Novos Negócios',
    reason: 'Reunião com Cliente',
    chosenModal: 'taxi',
    chosenCategory: 'Táxi Convencional',
    actualCost: 38.50,
    alternativeCost: 59.20,
    saving: 20.70,
    savingPercentage: 34.97,
    surgeMultiplier: 1.7,
    weatherCondition: 'Chuva Moderada',
    trafficCondition: 'Intenso',
    optimalChoice: true,
  },
  {
    id: 'TRIP-API-102',
    date: '2026-10-22',
    time: '09:15',
    origin: 'Rua Bela Cintra, 890 - Consolação',
    destination: 'Aeroporto de Congonhas (CGH)',
    distanceKm: 10.4,
    durationMin: 28,
    passengerName: 'Rodrigo Silveira',
    department: 'Executivo & Diretoria',
    reason: 'Translado Aeroporto',
    chosenModal: 'uber',
    chosenCategory: 'Uber Comfort',
    actualCost: 46.80,
    alternativeCost: 61.00,
    saving: 14.20,
    savingPercentage: 23.28,
    surgeMultiplier: 1.1,
    weatherCondition: 'Nublado',
    trafficCondition: 'Moderado',
    optimalChoice: true,
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET /api/mobility/health
  app.get('/api/mobility/health', (_req, res) => {
    res.json({
      status: 'operational',
      service: 'Mobility Saving Intelligence Engine',
      version: '1.4.0',
      connectedProviders: ['Uber for Business / Central', 'Google Sheets Integration', 'Cooperativas de Táxi GRU'],
      timestamp: new Date().toISOString()
    });
  });

// SSE clients connected for live target synchronization across all users
const sseTargetClients = new Set<express.Response>();

const GOOGLE_SHEET_ID = '1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE';
let lastSheetTargetCheck = 0;

async function syncTargetFromGoogleSheets(sheetId = GOOGLE_SHEET_ID): Promise<typeof currentTargetConfig> {
  try {
    const configUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Config&tq=&_t=${Date.now()}`;
    const response = await fetch(configUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const csv = await response.text();
      // Espera linhas no formato:
      // "Meta"
      // "50000"
      const lines = csv.split('\n').map(l => l.trim().replace(/^"|"$/g, '')).filter(Boolean);
      if (lines.length >= 2) {
        let rawVal = lines[1].replace(/"/g, '').replace('R$', '').trim();
        let parsedVal = NaN;
        if (rawVal.includes('.') && rawVal.includes(',')) {
          parsedVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
        } else if (rawVal.includes(',')) {
          parsedVal = parseFloat(rawVal.replace(',', '.'));
        } else {
          parsedVal = parseFloat(rawVal);
        }

        if (!isNaN(parsedVal) && parsedVal > 0) {
          const hasChanged = currentTargetConfig.targetValue !== parsedVal || currentTargetConfig.updatedBy !== 'Planilha Google Sheets (Aba Config)';
          currentTargetConfig = {
            targetType: 'value',
            targetValue: parsedVal,
            month: currentTargetConfig.month || '2026-10',
            updatedAt: new Date().toISOString(),
            updatedBy: 'Planilha Google Sheets (Aba Config)'
          };

          try {
            fs.writeFileSync(TARGET_FILE, JSON.stringify(currentTargetConfig, null, 2), 'utf-8');
            console.log('[Server] Meta sincronizada com sucesso da aba Config do Google Sheets:', parsedVal);
          } catch (err) {
            console.error('[Server] Erro ao gravar target-config.json:', err);
          }

          if (hasChanged) {
            broadcastTargetUpdate(currentTargetConfig);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Server] Falha ao sincronizar aba Config do Google Sheets:', err);
  }

  return currentTargetConfig;
}

function getLatestTargetConfig() {
  try {
    if (fs.existsSync(TARGET_FILE)) {
      const raw = fs.readFileSync(TARGET_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.targetValue === 'number') {
        currentTargetConfig = { ...currentTargetConfig, ...parsed };
      }
    }
  } catch (err) {
    console.warn('[Server] Could not read target-config.json:', err);
  }
  return currentTargetConfig;
}

function broadcastTargetUpdate(target: typeof currentTargetConfig) {
  const data = `data: ${JSON.stringify(target)}\n\n`;
  for (const client of sseTargetClients) {
    try {
      client.write(data);
    } catch {
      sseTargetClients.delete(client);
    }
  }
}

  // GET /api/mobility/target - Retorna a meta de saving compartilhada por todos os usuários
  app.get('/api/mobility/target', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Sincroniza sempre com a aba Config da planilha com anti-cache
    await syncTargetFromGoogleSheets();

    res.json({
      success: true,
      target: getLatestTargetConfig()
    });
  });

  // POST /api/mobility/target/sync-sheets - Força a sincronização imediata da meta a partir da aba Config do Google Sheets
  app.post('/api/mobility/target/sync-sheets', async (_req, res) => {
    const updated = await syncTargetFromGoogleSheets();
    res.json({
      success: true,
      target: updated,
      message: `Meta sincronizada diretamente da aba Config do Google Sheets: R$ ${updated.targetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    });
  });

  // GET /api/mobility/target/stream - Server-Sent Events (SSE) para sincronização instantânea entre todos os usuários
  app.get('/api/mobility/target/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    sseTargetClients.add(res);

    // Envia o estado atual imediatamente na conexão
    const current = getLatestTargetConfig();
    res.write(`data: ${JSON.stringify(current)}\n\n`);

    // Heartbeat a cada 25 segundos para manter a conexão aberta
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseTargetClients.delete(res);
    });
  });

  // POST /api/mobility/target - Atualiza a meta de saving globalmente para todos os usuários
  app.post('/api/mobility/target', (req, res) => {
    const { targetType, targetValue, month, updatedBy, sheetsWebhookUrl } = req.body;
    let numVal = typeof targetValue === 'number' ? targetValue : parseFloat(String(targetValue).replace(',', '.'));
    if (isNaN(numVal) || numVal <= 0) {
      return res.status(400).json({ error: 'targetValue deve ser um número positivo.' });
    }

    const webhookToUse = sheetsWebhookUrl !== undefined ? sheetsWebhookUrl : currentTargetConfig.sheetsWebhookUrl;

    currentTargetConfig = {
      ...currentTargetConfig,
      targetType: targetType === 'percent' ? 'percent' : 'value',
      targetValue: Number(numVal),
      month: month || currentTargetConfig.month || '2026-10',
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'Gestor de Mobilidade',
      sheetsWebhookUrl: webhookToUse
    };

    try {
      fs.writeFileSync(TARGET_FILE, JSON.stringify(currentTargetConfig, null, 2), 'utf-8');
      console.log('[Server] Meta global de saving atualizada e salva em disco:', currentTargetConfig);
    } catch (err) {
      console.error('[Server] Erro ao gravar target-config.json:', err);
    }

    // Se houver Webhook URL do Google Apps Script configurado, grava automaticamente na planilha
    if (webhookToUse && typeof webhookToUse === 'string' && webhookToUse.trim()) {
      fetch(webhookToUse.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetValue: Number(numVal),
          targetType: currentTargetConfig.targetType,
          month: currentTargetConfig.month,
          updatedAt: currentTargetConfig.updatedAt
        })
      }).then(r => console.log('[Server] Apps Script Webhook executado com status:', r.status))
        .catch(err => console.warn('[Server] Falha ao enviar para Apps Script Webhook:', err));
    }

    // Transmite a nova meta instantaneamente a todos os navegadores conectados via SSE
    broadcastTargetUpdate(currentTargetConfig);

    res.json({
      success: true,
      target: currentTargetConfig
    });
  });

  // POST /api/mobility/sheets-sync - Proxy inteligente para download direto do CSV do Google Sheets
  app.post('/api/mobility/sheets-sync', async (req, res) => {
    let { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      url = 'https://docs.google.com/spreadsheets/d/1F2MPp5fuor41sKCJIgq7D3sbu9AL1dWBBusNX4XZcGE/edit';
    }

    try {
      const trimmed = url.trim();
      const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = match ? match[1] : null;
      const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
      const requestedGid = gidMatch ? gidMatch[1] : null;

      if (sheetId) {
        // Sincroniza também a meta a partir da aba Config da planilha
        syncTargetFromGoogleSheets(sheetId).catch(() => {});

        // Tenta primeiro o gid requisitado ou 0
        const initialGid = requestedGid !== null ? requestedGid : '0';
        const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${initialGid}`;
        
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const csv = await response.text();
          const hasTripHeaders = /data da solicita|valor da transa|id da viagem|uber|preço|preco/i.test(csv);

          if (hasTripHeaders) {
            return res.json({ 
              success: true, 
              csv, 
              detectedTab: initialGid === '0' ? 'Dados Uber' : `Aba gid=${initialGid}`,
              sheetId 
            });
          }

          // Se a aba requisitada NÃO tiver corridas detalhadas (ex.: usuário copiou URL na aba Dados Taxi Moover gid=1976358613),
          // tenta automaticamente a aba principal gid=0 (onde fica a base Dados Uber)
          if (initialGid !== '0') {
            const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
            const fbResponse = await fetch(fallbackUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (fbResponse.ok) {
              const fbCsv = await fbResponse.text();
              const fbHasTripHeaders = /data da solicita|valor da transa|id da viagem|uber|preço|preco/i.test(fbCsv);
              if (fbHasTripHeaders) {
                return res.json({ 
                  success: true, 
                  csv: fbCsv, 
                  detectedTab: 'Dados Uber',
                  autoSwitched: true,
                  note: 'Aba de corridas (Dados Uber) localizada e sincronizada com sucesso.',
                  sheetId 
                });
              }
            }
          }

          // Se ainda não encontrou cabeçalho detalhado, retorna o CSV original (pode ser processado como resumo diário)
          return res.json({ 
            success: true, 
            csv, 
            detectedTab: initialGid === '1976358613' ? 'Dados Taxi Moover' : `Aba gid=${initialGid}`,
            sheetId 
          });
        }
      }

      // Fallback para URL pública direta
      const response = await fetch(trimmed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Erro HTTP ${response.status} ao acessar a planilha` });
      }

      const csv = await response.text();
      res.json({ success: true, csv });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha na conexão com Google Sheets' });
    }
  });

  // GET /api/mobility/trips - Lista todas as corridas
  app.get('/api/mobility/trips', (_req, res) => {
    res.json({
      count: tripsData.length,
      trips: tripsData
    });
  });

  // POST /api/mobility/trips - Ingestão de corrida via Webhook
  app.post('/api/mobility/trips', (req, res) => {
    const newTrip = req.body;
    if (!newTrip.origin || !newTrip.destination || !newTrip.actualCost) {
      return res.status(400).json({ error: 'Campos obrigatórios: origin, destination, actualCost' });
    }

    const tripRecord = {
      id: `TRIP-API-${Date.now()}`,
      date: newTrip.date || new Date().toISOString().split('T')[0],
      time: newTrip.time || '12:00',
      origin: newTrip.origin,
      destination: newTrip.destination,
      distanceKm: Number(newTrip.distanceKm) || 8.0,
      durationMin: Number(newTrip.durationMin) || 25,
      passengerName: newTrip.passengerName || 'Colaborador Corporativo',
      department: newTrip.department || 'Operações',
      reason: newTrip.reason || 'Deslocamento a Serviço',
      chosenModal: newTrip.chosenModal || 'uber',
      chosenCategory: newTrip.chosenCategory || 'UberX',
      actualCost: Number(newTrip.actualCost),
      alternativeCost: Number(newTrip.alternativeCost || (newTrip.actualCost * 1.3)),
      saving: Number((newTrip.alternativeCost || (newTrip.actualCost * 1.3)) - newTrip.actualCost),
      savingPercentage: 23.0,
      surgeMultiplier: Number(newTrip.surgeMultiplier || 1.0),
      weatherCondition: newTrip.weatherCondition || 'Ensolarado',
      trafficCondition: newTrip.trafficCondition || 'Moderado',
      optimalChoice: true,
    };

    tripsData.unshift(tripRecord);
    res.status(201).json({ success: true, trip: tripRecord });
  });

  // POST /api/mobility/quote - Cotação em tempo real de trajeto
  app.post('/api/mobility/quote', (req, res) => {
    const { distanceKm = 8, durationMin = 25, surgeMultiplier = 1.0, isRaining = false, taxiDiscountPercent = 20, taxiFlag = 1 } = req.body;

    const baseUberCost = 5.50 + (distanceKm * 2.45) + (durationMin * 0.38);
    const effectiveSurge = Math.max(surgeMultiplier, isRaining && surgeMultiplier === 1.0 ? 1.45 : surgeMultiplier);
    const uberX = Math.round(Math.max(10.50, baseUberCost * effectiveSurge) * 100) / 100;
    const uberComfort = Math.round((uberX * 1.25) * 100) / 100;
    const uberBlack = Math.round((uberX * 1.65) * 100) / 100;

    const taxiFlagCost = 6.20;
    const taxiRatePerKm = taxiFlag === 1 ? 4.35 : 5.65;
    const slowMinutes = durationMin > (distanceKm * 2.2) ? durationMin - (distanceKm * 2.2) : 0;
    const taxiWaitCost = slowMinutes * 0.70;
    const grossTaxi = taxiFlagCost + (distanceKm * taxiRatePerKm) + taxiWaitCost;
    const discountMultiplier = Math.max(0, 1 - (taxiDiscountPercent / 100));
    const taxiStandard = Math.round(Math.max(12.00, grossTaxi * discountMultiplier) * 100) / 100;
    const taxiSpecial = Math.round((taxiStandard * 1.35) * 100) / 100;

    const bestModal = taxiStandard < uberX ? 'taxi' : 'uber';
    const bestPrice = bestModal === 'taxi' ? taxiStandard : uberX;
    const alternativePrice = bestModal === 'taxi' ? uberX : taxiStandard;
    const immediateSaving = Math.round((alternativePrice - bestPrice) * 100) / 100;

    res.json({
      bestModal,
      bestPrice,
      alternativePrice,
      immediateSaving,
      uber: { x: uberX, comfort: uberComfort, black: uberBlack },
      taxi: { standard: taxiStandard, special: taxiSpecial },
      surgeMultiplier: effectiveSurge,
      timestamp: new Date().toISOString()
    });
  });

  // Em modo de desenvolvimento, monta o middleware do Vite
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mobility API Server] Rodando em http://0.0.0.0:${PORT}`);
    // Sincroniza a meta diretamente da aba Config do Google Sheets no boot
    syncTargetFromGoogleSheets();
    // Monitora alterações na aba Config da planilha a cada 30 segundos
    setInterval(() => {
      syncTargetFromGoogleSheets();
    }, 30000);
  });
}

startServer();
