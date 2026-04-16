const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const FANTA_FILE     = path.join(__dirname, 'public', 'fantacalcio.json');
const MAX_TENTATIVI  = 3;

const RSS_FEEDS = [
  'https://www.gazzetta.it/rss/calcio.xml',
  'https://www.corrieredellosport.it/rss/calcio.xml',
];

async function leggiRSS(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const titoli = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titoloRegex = /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && titoli.length < 8) {
      const tMatch = titoloRegex.exec(match[1]);
      if (tMatch) {
        const t = (tMatch[1] || tMatch[2] || '').trim().replace(/<[^>]+>/g, '');
        if (t && t.length > 5) titoli.push(t);
      }
    }
    return titoli;
  } catch (e) { console.log(`RSS ${url} fallito: ${e.message}`); return []; }
}

async function leggiTuttiRSS() {
  console.log('Lettura feed RSS...');
  const risultati = await Promise.all(RSS_FEEDS.map(leggiRSS));
  const tutti = risultati.flat();
  const unici = tutti.filter((t, i, a) => a.findIndex(x => x.substring(0,25) === t.substring(0,25)) === i);
  console.log(`Notizie reali trovate: ${unici.length}`);
  return unici.slice(0, 15);
}

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

async function chiamaDeepSeek(oggi, notizie, fantaRiep) {
  // Timestamp univoco al millisecondo per impedire qualsiasi cache
  const ts = Date.now();
  const random = Math.floor(Math.random() * 999999);

  const notizieTesto = notizie.length > 0
    ? notizie.map((t,i) => `${i+1}. ${t}`).join('\n')
    : 'Nessuna notizia disponibile.';

  const prompt = `[ID:${ts}-${random}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi: ${oggi}

NOTIZIE REALI (usa queste come base per Milan/Juve/Inter/SerieA):
${notizieTesto}

FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

ISTRUZIONI TASSATIVE:
- Ogni articolo deve avere titolo e contenuto COMPLETAMENTE ORIGINALE e DIVERSO da qualsiasi altro giorno
- Milan/Juve/Inter/SerieA: rielabora le notizie reali sopra in chiave ironica — NON inventare fatti
- Crotone: sempre protagonista di notizie assurde e impossibili (trattative con campioni, stadi faraonici, ecc)
- Sport minori: ironia da tifoso calcio che guarda sport "inferiori"
- fanta_narrativa: analisi ironica della stagione basata sui dati reali sopra, 3 paragrafi da 40 parole
- Max 15 parole per titolo, max 20 parole per testo
- Tutto su una riga, zero a capo nelle stringhe

Rispondi SOLO con JSON valido, zero markdown, zero testo extra:

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
      temperature: 1.5,
      top_p: 0.95,
      presence_penalty: 1.0,
      frequency_penalty: 1.0,
      messages: [
        {
          role: 'system',
          content: `Sei un giornalista satirico italiano creativo. Oggi e' ${oggi}, ID sessione: ${ts}. Genera contenuti SEMPRE DIVERSI e originali. Non ripetere mai gli stessi titoli o concetti.`
        },
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
  console.log('Cache hit tokens:', data.usage?.prompt_cache_hit_tokens || 0);

  let raw = data.choices[0].message.content.trim();
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

  const [notizie, fanta] = await Promise.all([
    leggiTuttiRSS(),
    Promise.resolve(leggiFantacalcio())
  ]);

  const fantaRiep = fantaRiepilogo(fanta);
  console.log('Fanta:', fantaRiep.substring(0, 80) + '...');

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await chiamaDeepSeek(oggi, notizie, fantaRiep);

      // Incorpora narrativa fanta
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
      if (tentativo < MAX_TENTATIVI) {
        await new Promise(r => setTimeout(r, tentativo * 10000));
      }
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
  console.log('Notizie usate:', notizie.length);
}

genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  process.exit(0);
});
