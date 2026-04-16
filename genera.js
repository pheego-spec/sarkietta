const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const FANTA_FILE     = path.join(__dirname, 'public', 'fantacalcio.json');

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

function sanitizzaStringa(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/[\u2018\u2019\u201C\u201D]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
}

function parseJSON(raw) {
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start);
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) raw = raw.substring(0, lastBrace + 1);
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();
  raw = raw.replace(/[\u2018\u2019]/g, "\\'").replace(/[\u201C\u201D]/g, '\\"');
  // Fix apostrofi dentro valori JSON — es: {"titolo": "l'Inter"} diventa problematico
  // Sostituiamo apostrofi nei valori con versione escaped
  raw = raw.replace(/"([^"]*)'([^"]*)"/g, function(match, p1, p2) {
    return '"' + p1 + p2 + '"';
  });
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

async function callDeepSeek(messages, temperature) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: temperature || 1.2,
      presence_penalty: 0.8,
      frequency_penalty: 0.8,
      messages
    })
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const data = await response.json();
  console.log('Tokens:', data.usage.total_tokens, '| Cache hit:', data.usage.prompt_cache_hit_tokens || 0);
  return data.choices[0].message.content.trim();
}

const TEMI_CROTONE = [
  'trattativa per Haaland','nuovo stadio da 100000 posti','progetto Champions 2030',
  'accordo con Mbappe','assunzione di Mourinho','fusione con il Napoli',
  'acquisto di Ronaldo','candidatura ai Mondiali 2030','nuovo presidente miliardario',
  'rivoluzione tattica impossibile','investitori arabi','accordo con la NASA per il campo',
  'Crotone in Champions per errore','abbonamento venduto a 3 euro','campo sintetico fatto di polenta'
];

// CHIAMATA 1: contenuti principali (senza narrativa lunga)
async function generaContenuti(oggi, fantaRiep, dayOfYear) {
  const ts = Date.now();
  const temaCrotone = TEMI_CROTONE[dayOfYear % TEMI_CROTONE.length];

  const prompt = `[ID:${ts}] Giornale satirico italiano "La Sarkietta dello Sport". Oggi: ${oggi} (giorno anno: ${dayOfYear}).

TEMA CROTONE OGGI: ${temaCrotone}
FANTA: ${fantaRiep}

REGOLE FERREE:
- Nessun apostrofo nei valori. Scrivi "dell Inter" non "dell'Inter"
- Nessuna virgoletta doppia nei valori
- Max 15 parole per campo
- Ogni campo diverso dagli altri

JSON da compilare (sostituisci i puntini con testo reale):
{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"...","squadra":"..."},"fanta_top":{"titolo":"...","testo":"...","squadra":"..."},"fanta_commento":"...","minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}`;

  const raw = await callDeepSeek([
    { role: 'system', content: `Satirico italiano. ID:${ts}. Giorno:${dayOfYear}. Zero apostrofi nei valori JSON.` },
    { role: 'user', content: prompt }
  ], 1.2);

  return parseJSON(raw);
}

// CHIAMATA 2: solo narrativa fantacalcio (separata per evitare JSON troppo lungo)
async function generaNarrativa(oggi, fantaRiep, dayOfYear) {
  const ts = Date.now();

  const prompt = `[ID:${ts}] Analista sarcastico di fantacalcio italiano.

DATI REALI SARKIASUPERLEGA: ${fantaRiep}

Scrivi una narrativa ironica sulla stagione. Rispondi SOLO con questo JSON:
{"titolo":"titolo ironico della stagione max 10 parole","p1":"primo paragrafo ironico 30 parole no apostrofi","p2":"secondo paragrafo ironico 30 parole no apostrofi","p3":"terzo paragrafo ironico 30 parole no apostrofi"}

Zero apostrofi. Zero virgolette nei valori. Solo testo semplice.`;

  const raw = await callDeepSeek([
    { role: 'user', content: prompt }
  ], 1.0);

  const j = parseJSON(raw);
  return {
    titolo: sanitizzaStringa(j.titolo),
    paragrafi: [sanitizzaStringa(j.p1), sanitizzaStringa(j.p2), sanitizzaStringa(j.p3)],
    record: []
  };
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  console.log('Giorno anno:', dayOfYear);

  const fanta = leggiFantacalcio();
  const fantaRiep = fantaRiepilogo(fanta);

  // Chiamata 1: contenuti principali
  let contenuti = null;
  for (let t = 1; t <= 3; t++) {
    console.log(`\nContenuti tentativo ${t}/3...`);
    try {
      contenuti = await generaContenuti(oggi, fantaRiep, dayOfYear);
      console.log('Contenuti OK');
      break;
    } catch(err) {
      console.log(`Fallito: ${err.message}`);
      if (t < 3) await new Promise(r => setTimeout(r, t * 8000));
    }
  }

  if (!contenuti) {
    console.log('Fallback contenuti precedenti.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      contenuti = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      contenuti.fallback = true;
    } else { process.exit(0); }
  }

  // Chiamata 2: narrativa fanta (separata)
  if (fanta && !contenuti.fallback) {
    console.log('\nGenerazione narrativa fantacalcio...');
    try {
      const narrativa = await generaNarrativa(oggi, fantaRiep, dayOfYear);
      fanta.narrativa = narrativa;
      console.log('Narrativa OK:', narrativa.titolo);
    } catch(err) {
      console.log('Narrativa fallita:', err.message);
      // Mantieni narrativa precedente se esiste
      if (fs.existsSync(CONTENUTI_FILE)) {
        const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
        if (prev.fanta_data && prev.fanta_data.narrativa) {
          fanta.narrativa = prev.fanta_data.narrativa;
          console.log('Uso narrativa precedente');
        }
      }
    }
    contenuti.fanta_data = fanta;
  } else if (fanta) {
    contenuti.fanta_data = fanta;
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
