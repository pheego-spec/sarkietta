const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const MAX_TENTATIVI = 3;

// Feed RSS da cui leggere notizie reali
const RSS_FEEDS = [
  'https://www.gazzetta.it/rss/calcio.xml',
  'https://www.corrieredellosport.it/rss/calcio.xml',
  'https://www.ansa.it/sport/notizie/calcio/calcio_rss.xml'
];

async function leggiRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // Estrae titoli e descrizioni dal XML
    const titoli = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titoloRegex = /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i;
    const descRegex = /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i;

    let match;
    while ((match = itemRegex.exec(xml)) !== null && titoli.length < 8) {
      const item = match[1];
      const tMatch = titoloRegex.exec(item);
      const dMatch = descRegex.exec(item);
      if (tMatch) {
        const titolo = (tMatch[1] || tMatch[2] || '').trim().replace(/<[^>]+>/g, '');
        const desc = dMatch ? (dMatch[1] || dMatch[2] || '').trim().replace(/<[^>]+>/g, '').substring(0, 150) : '';
        if (titolo && titolo.length > 5) titoli.push({ titolo, desc });
      }
    }
    return titoli;
  } catch (e) {
    console.log(`RSS ${url} fallito: ${e.message}`);
    return [];
  }
}

async function leggiTuttiRSS() {
  console.log('Lettura feed RSS...');
  const risultati = await Promise.all(RSS_FEEDS.map(leggiRSS));
  const tutti = risultati.flat();

  // Deduplication per titoli simili
  const unici = tutti.filter((item, idx, arr) =>
    arr.findIndex(x => x.titolo.substring(0, 30) === item.titolo.substring(0, 30)) === idx
  );

  console.log(`Notizie reali trovate: ${unici.length}`);
  return unici.slice(0, 20); // max 20 notizie
}

async function chiamaDeepSeek(oggi, notizie) {
  const notizieTesto = notizie.length > 0
    ? notizie.map((n, i) => `${i+1}. ${n.titolo}${n.desc ? ' — ' + n.desc : ''}`).join('\n')
    : 'Nessuna notizia disponibile oggi.';

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano per amici 40enni appassionati di calcio e fantacalcio.
Oggi e' ${oggi}.

NOTIZIE REALI DI OGGI (da Gazzetta, Corriere Sport, ANSA):
${notizieTesto}

Il tuo compito:
- Usa le notizie reali come base per gli articoli su Milan, Juve, Inter e Serie A
- Rielabora i fatti reali in chiave ironica e sarcastica — non inventare i fatti principali
- Per Crotone, sport minori e sondaggio puoi inventare liberamente
- Ogni testo max 20 parole, tutto su una riga senza a capo

Rispondi SOLO con questo JSON valido, zero markdown, zero backtick:

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"..."},"fanta_top":{"titolo":"...","testo":"..."},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}

Sostituisci ogni "..." con contenuto reale rielaborato o ironico. Crotone sempre protagonista assurdo.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }]
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
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start);
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) raw = raw.substring(0, lastBrace + 1);

  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();

  // Ripara parentesi mancanti
  let open = 0, close = 0, inStr = false, escape = false;
  for (const c of raw) {
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') open++;
      if (c === '}') close++;
    }
  }
  const missing = open - close;
  if (missing > 0) {
    raw += '}'.repeat(missing);
    console.log('Riparati', missing, 'chiusure }');
  }

  return JSON.parse(raw);
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Leggi notizie reali dai RSS
  const notizie = await leggiTuttiRSS();

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await chiamaDeepSeek(oggi, notizie);
      console.log(`Tentativo ${tentativo} riuscito!`);
      break;
    } catch (err) {
      erroreFinale = err;
      console.log(`Tentativo ${tentativo} fallito: ${err.message}`);
      if (tentativo < MAX_TENTATIVI) {
        const pausa = tentativo * 10000;
        console.log(`Attendo ${pausa/1000}s...`);
        await new Promise(r => setTimeout(r, pausa));
      }
    }
  }

  // Fallback sui contenuti del giorno prima
  if (!contenuti) {
    console.log('\nTutti i tentativi falliti. Uso contenuti del giorno prima.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      const vecchi = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      vecchi.generato_il = new Date().toISOString();
      vecchi.fallback = true;
      if (vecchi.ticker) vecchi.ticker[0] = 'Redazione in pausa tecnica, torniamo domani';
      contenuti = vecchi;
    } else {
      contenuti = {
        generato_il: new Date().toISOString(),
        fallback: true,
        crotone: { titolo: 'Crotone: la redazione e in pausa tecnica', sottotitolo: 'Pausa Tecnica', testo: 'Torniamo domani con notizie ancora piu assurde.' },
        milan: { titolo: 'Milan: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: 'Crisi Nera' },
        juve: { titolo: 'Juve: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: 'Fenomeno?' },
        inter: { titolo: 'Inter: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: "Bidone d'Oro" },
        seriea_extra: { titolo: 'Serie A: aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        seriea_extra2: { titolo: 'Serie A: aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        fanta_flop: { titolo: 'Fantacalcio: dati in aggiornamento', testo: 'Torniamo domani.' },
        fanta_top: { titolo: 'Fantacalcio: dati in aggiornamento', testo: 'Torniamo domani.' },
        minori_tennis: { titolo: 'Tennis: aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_f1: { titolo: 'F1: aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_altro: { categoria: 'Sport', titolo: 'Sport: aggiornamento in corso', testo: 'Torniamo domani.' },
        ticker: ['Redazione in pausa tecnica', 'Torniamo domani', 'Il Crotone intanto si allena', 'Restate sintonizzati', 'Notizie fresche domani mattina'],
        sondaggio_domanda: 'Cosa fai quando il sito non si aggiorna?',
        sondaggio_opzioni: ['Aspetto paziente', 'Mi arrabbio', 'Guardo la TV', 'Vado al bar'],
        vincenti: [
          { nome: 'La Redazione', testo: 'Torna domani con contenuti freschi.' },
          { nome: 'Il Crotone', testo: 'Sempre nel nostro cuore, qualunque serie.' }
        ]
      };
    }
  }

  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');

  if (!contenuti.fallback || !fs.existsSync(SONDAGGIO_FILE)) {
    const sondaggio = {
      domanda: contenuti.sondaggio_domanda,
      opzioni: contenuti.sondaggio_opzioni,
      voti: [0, 0, 0, 0],
      data: new Date().toDateString()
    };
    fs.writeFileSync(SONDAGGIO_FILE, JSON.stringify(sondaggio, null, 2), 'utf8');
  }

  if (contenuti.fallback) {
    console.log('\nATTENZIONE: usato fallback. Errore:', erroreFinale?.message);
  } else {
    console.log('\nContenuti salvati con successo:', contenuti.generato_il);
    console.log('Notizie reali usate:', notizie.length);
  }
}

genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  process.exit(0);
});
