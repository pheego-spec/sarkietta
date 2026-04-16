const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const FANTA_FILE     = path.join(__dirname, 'public', 'fantacalcio.json');
const MAX_TENTATIVI  = 3;

function leggiFantacalcio() {
  try {
    if (!fs.existsSync(FANTA_FILE)) return null;
    return JSON.parse(fs.readFileSync(FANTA_FILE, 'utf8'));
  } catch(e) { return null; }
}

function fantaRiepilogo(fanta) {
  if (!fanta) return 'Dati fantacalcio non disponibili.';
  const classifica = fanta.squadre.map((s,i) => `${i+1}. ${s.squadra} ${s.punti}pt`).join(', ');
  let risultati = '';
  if (fanta.ultima_giornata && fanta.ultima_giornata.risultati) {
    risultati = fanta.ultima_giornata.risultati
      .map(r => `${r.casa} ${r.gol_casa}-${r.gol_fuori} ${r.fuori} (voti: ${r.pt_casa} vs ${r.pt_fuori})`).join('; ');
  }
  return `${fanta.giornata}. Classifica: ${classifica}. Risultati: ${risultati}`;
}

async function chiamaDeepSeek(oggi, fantaRiep) {
  const ts = Date.now();
  const random = Math.floor(Math.random() * 999999);

  // Usa DeepSeek con web search abilitato per cercare notizie reali
  const prompt = `[SESSION:${ts}-${random}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano per amici 40enni appassionati di calcio.

Data di oggi: ${oggi}

PASSO 1: Cerca su internet le ultime notizie di calcio italiano di OGGI su Gazzetta dello Sport, Corriere dello Sport, ANSA sport. Usa le notizie trovate come base reale.

PASSO 2: Con le notizie trovate, genera i contenuti del sito in stile ironico e sarcastico.

FANTACALCIO SARKIASUPERLEGA (dati reali):
${fantaRiep}

REGOLE TASSATIVE:
- Milan/Juve/Inter/SerieA: basati SEMPRE su notizie reali di oggi trovate online
- Crotone: protagonista di notizie assurde e impossibili
- fanta_narrativa: analisi ironica basata sui dati reali della lega sopra, 3 paragrafi
- Ogni campo max 20 parole su una riga
- Contenuti ORIGINALI e DIVERSI ogni giorno

Rispondi SOLO con JSON valido, zero markdown:

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"...","squadra":"..."},"fanta_top":{"titolo":"...","testo":"...","squadra":"..."},"fanta_commento":"...","fanta_narrativa":{"titolo":"...","paragrafi":["...","...","..."]},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 1.4,
      presence_penalty: 1.0,
      frequency_penalty: 1.0,
      tools: [{
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for latest sports news',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        }
      }],
      messages: [
        {
          role: 'system',
          content: `Sei un giornalista satirico italiano. Sessione ID: ${ts}. Cerca SEMPRE le notizie sportive di oggi prima di rispondere. Genera contenuti ORIGINALI e DIVERSI ogni giorno.`
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    // Se web search non supportato, riprova senza
    if (response.status === 400) {
      console.log('Web search non supportato, riprovo senza...');
      return chiamaDeepSeekBase(oggi, fantaRiep, ts, random);
    }
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log('Finish reason:', data.choices[0].finish_reason);
  console.log('Tokens:', JSON.stringify(data.usage));

  let raw = data.choices[0].message.content.trim();
  return parseJSON(raw);
}

async function chiamaDeepSeekBase(oggi, fantaRiep, ts, random) {
  const prompt = `[SESSION:${ts}-${random}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Data: ${oggi}

Devi generare notizie sportive ironiche basate su quello che sai di Serie A, Milan, Juventus, Inter di questa settimana.
IMPORTANTE: usa fatti e notizie RECENTI e REALI che conosci — non inventare fatti di cronaca, rielaborali in chiave comica.

FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

Max 20 parole per campo. Tutto su una riga. Contenuti DIVERSI ogni chiamata.

Rispondi SOLO con JSON valido:

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"...","squadra":"..."},"fanta_top":{"titolo":"...","testo":"...","squadra":"..."},"fanta_commento":"...","fanta_narrativa":{"titolo":"...","paragrafi":["...","...","..."]},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 1.4,
      presence_penalty: 1.0,
      frequency_penalty: 1.0,
      messages: [
        { role: 'system', content: `Giornalista satirico. Sessione: ${ts}. Contenuti originali ogni giorno.` },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log('Finish reason:', data.choices[0].finish_reason);
  console.log('Tokens:', JSON.stringify(data.usage));
  let raw = data.choices[0].message.content.trim();
  return parseJSON(raw);
}

function parseJSON(raw) {
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start);
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) raw = raw.substring(0, lastBrace + 1);
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();
  let open = 0, close = 0, inStr = false, escape = false;
  for (const c of raw) {
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) { if (c === '{') open++; if (c === '}') close++; }
  }
  if (open - close > 0) raw += '}'.repeat(open - close);
  return JSON.parse(raw);
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const fanta = leggiFantacalcio();
  const fantaRiep = fantaRiepilogo(fanta);
  console.log('Fanta:', fantaRiep.substring(0, 80) + '...');

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await chiamaDeepSeek(oggi, fantaRiep);
      if (contenuti.fanta_narrativa && fanta) {
        fanta.narrativa = {
          titolo: contenuti.fanta_narrativa.titolo,
          paragrafi: contenuti.fanta_narrativa.paragrafi,
          record: []
        };
        delete contenuti.fanta_narrativa;
      }
      contenuti.fanta_data = fanta;
      console.log(`Tentativo ${tentativo} riuscito!`);
      break;
    } catch (err) {
      erroreFinale = err;
      console.log(`Tentativo ${tentativo} fallito: ${err.message}`);
      if (tentativo < MAX_TENTATIVI) await new Promise(r => setTimeout(r, tentativo * 10000));
    }
  }

  if (!contenuti) {
    console.log('\nFallback contenuti precedenti.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      contenuti = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      contenuti.fallback = true;
    } else { process.exit(0); }
  }

  contenuti.generato_il = new Date().toISOString();
  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');

  if (!contenuti.fallback) {
    fs.writeFileSync(SONDAGGIO_FILE, JSON.stringify({
      domanda: contenuti.sondaggio_domanda,
      opzioni: contenuti.sondaggio_opzioni,
      voti: [0, 0, 0, 0],
      data: new Date().toDateString()
    }, null, 2), 'utf8');
  }

  console.log('\nContenuti salvati:', new Date().toISOString());
}

genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  process.exit(0);
});
