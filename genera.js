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
      .map(r => `${r.casa} ${r.gol_casa}-${r.gol_fuori} ${r.fuori} (${r.pt_casa} vs ${r.pt_fuori})`).join('; ');
  }
  return `${fanta.giornata}. Classifica: ${classifica}. Risultati: ${risultati}`;
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

// STEP 1: Cerca notizie reali con Claude + web search
async function cercaNotizie(oggi) {
  console.log('Cercando notizie reali con Claude web search...');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Cerca le notizie sportive italiane di oggi ${oggi} su calcio Serie A: Milan, Juventus, Inter, Napoli, Roma. Dammi 8-10 titoli di notizie REALI di oggi. Solo titoli, separati da punto e virgola.`
      }]
    })
  });

  if (!response.ok) {
    console.log('Claude web search fallito:', response.status);
    return [];
  }

  const data = await response.json();
  const testo = data.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
  
  // Estrai i titoli dalla risposta
  const titoli = testo.split(/[;.\n]/)
    .map(t => t.trim())
    .filter(t => t.length > 15 && t.length < 150)
    .slice(0, 10);
  
  console.log(`Notizie reali trovate: ${titoli.length}`);
  titoli.forEach((t, i) => console.log(`  ${i+1}. ${t.substring(0, 80)}`));
  return titoli;
}

// STEP 2: Genera contenuti ironici con DeepSeek basandosi sulle notizie reali
async function generaContenuti(oggi, notizie, fantaRiep) {
  const ts = Date.now();
  const notizieTesto = notizie.length > 0
    ? notizie.map((t,i) => `${i+1}. ${t}`).join('\n')
    : 'Nessuna notizia disponibile — inventa notizie plausibili ma diverse ogni giorno.';

  const prompt = `[${ts}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi: ${oggi}

NOTIZIE REALI DI OGGI (OBBLIGATORIO usarle come base):
${notizieTesto}

FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

REGOLE:
- Per Milan/Juve/Inter/Serie A: prendi una notizia reale sopra e rielaborala in chiave ironica
- Per Crotone: inventa liberamente notizie assurde e impossibili  
- fanta_narrativa: analisi ironica della stagione, 3 paragrafi da 40 parole basati sui dati reali
- Max 20 parole per campo, su una riga sola
- OGNI campo deve riferirsi a un argomento DIVERSO

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
      temperature: 1.3,
      presence_penalty: 0.8,
      frequency_penalty: 0.8,
      messages: [
        { role: 'system', content: `Giornalista satirico creativo. ID:${ts}. Usa SEMPRE le notizie reali fornite. Niente ripetizioni.` },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const data = await response.json();
  console.log('Tokens:', JSON.stringify(data.usage));
  return parseJSON(data.choices[0].message.content.trim());
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const fanta = leggiFantacalcio();
  const fantaRiep = fantaRiepilogo(fanta);

  // Step 1: cerca notizie reali (Claude con web search)
  const notizie = await cercaNotizie(oggi);

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      // Step 2: genera contenuti ironici (DeepSeek)
      contenuti = await generaContenuti(oggi, notizie, fantaRiep);

      if (contenuti.fanta_narrativa && fanta) {
        fanta.narrativa = {
          titolo: contenuti.fanta_narrativa.titolo,
          paragrafi: contenuti.fanta_narrativa.paragrafi,
          record: []
        };
        delete contenuti.fanta_narrativa;
      }
      contenuti.fanta_data = fanta;
      console.log(`Riuscito al tentativo ${tentativo}!`);
      break;
    } catch (err) {
      erroreFinale = err;
      console.log(`Tentativo ${tentativo} fallito: ${err.message}`);
      if (tentativo < MAX_TENTATIVI) await new Promise(r => setTimeout(r, tentativo * 10000));
    }
  }

  if (!contenuti) {
    console.log('Fallback su contenuti precedenti.');
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
