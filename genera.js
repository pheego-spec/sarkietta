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

  // Rimuove newline e tab
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();

  // Sostituisce virgolette tipografiche con virgolette standard
  raw = raw.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

  // Fix virgolette singole dentro valori JSON: "titolo": 'testo' -> "titolo": "testo"
  raw = raw.replace(/:\s*'([^']*?)'/g, ': "$1"');

  // Ripara parentesi mancanti
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

// Giorni e argomenti per forzare variazione
const TEMI_CROTONE = [
  'trattativa per Haaland', 'nuovo stadio da 100000 posti', 'progetto Champions 2030',
  'accordo con Mbappe', 'assunzione di Mourinho', 'fusione con il Napoli',
  'acquisto di Ronaldo', 'candidatura ai Mondiali 2030', 'nuovo presidente miliardario',
  'rivoluzione tattica impossibile', 'investitori arabi', 'accordo con la NASA per il campo'
];

const TEMI_MINORI = [
  'Sinner vince tutto', 'Berrettini si infortuna', 'Musetti fa sorpresa',
  'Verstappen domina', 'Ferrari delude ancora', 'Hamilton cambia squadra',
  'Jacobs torna veloce', 'Italia ciclismo sorprende', 'NBA finale clamorosa',
  'rugby Italia migliora', 'nuoto italiano medaglia', 'scherma italiana sul podio'
];

async function generaContenuti(oggi, fantaRiep) {
  const ts = Date.now();
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  
  // Tema Crotone del giorno (ruota ogni giorno)
  const temaCrotone = TEMI_CROTONE[dayOfYear % TEMI_CROTONE.length];
  const temaMinore = TEMI_MINORI[dayOfYear % TEMI_MINORI.length];

  const prompt = `[ID:${ts}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi: ${oggi} (giorno ${dayOfYear} dell'anno)

TEMA OBBLIGATORIO CROTONE OGGI: ${temaCrotone}
TEMA SPORT MINORI OGGI: ${temaMinore}

FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

ISTRUZIONI:
- Crotone: articolo assurdo sul tema "${temaCrotone}" — obbligatorio usare questo tema
- Milan/Juve/Inter: usa notizie reali recenti che conosci, rielaborate in chiave ironica. NON inventare — se non sai notizie recenti parla di mercato, risultati, polemiche reali
- Serie A extra: notizia su Napoli, Roma, Lazio o altra squadra reale
- Sport minori: tema "${temaMinore}"
- fanta_narrativa: 3 paragrafi ironici basati sui dati reali della Sarkiasuperlega sopra
- Max 20 parole per campo, NO virgolette doppie dentro i valori, usa solo testo semplice
- Ogni giorno argomenti DIVERSI per Milan/Juve/Inter

Rispondi SOLO con JSON. Usa SOLO virgolette doppie. Zero apostrofi o virgolette dentro i valori:

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
      presence_penalty: 0.9,
      frequency_penalty: 0.9,
      messages: [
        {
          role: 'system',
          content: `Giornalista satirico italiano. ID sessione: ${ts}. Giorno ${dayOfYear}. Genera contenuti ORIGINALI basati sui temi assegnati. Zero ripetizioni da sessioni precedenti.`
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const data = await response.json();
  console.log('Finish reason:', data.choices[0].finish_reason);
  console.log('Tokens:', JSON.stringify(data.usage));
  console.log('Tema Crotone oggi:', temaCrotone);

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
  console.log('Fanta:', fantaRiep.substring(0, 80) + '...');

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await generaContenuti(oggi, fantaRiep);

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
