const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const MAX_TENTATIVI = 3;

async function chiamaDeepSeek(oggi) {
  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi e' ${oggi}.
Rispondi SOLO con JSON valido, zero markdown, zero backtick, zero newline dentro le stringhe.
Ogni valore testuale: massimo 15 parole, tutto su una riga.

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"..."},"fanta_top":{"titolo":"...","testo":"..."},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}

Sostituisci ogni "..." con testo ironico reale. Crotone sempre protagonista assurdo. Tono sarcastico.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 1.0,
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

  // Rimuove backtick markdown
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

  // Estrae da { fino all'ultimo }
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start);
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) raw = raw.substring(0, lastBrace + 1);

  // Pulisce caratteri di controllo
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

  // Parsing — lancia eccezione se non valido
  return JSON.parse(raw);
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  let contenuti = null;
  let erroreFinale = null;

  // 3 tentativi con pausa crescente
  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await chiamaDeepSeek(oggi);
      console.log(`Tentativo ${tentativo} riuscito!`);
      break;
    } catch (err) {
      erroreFinale = err;
      console.log(`Tentativo ${tentativo} fallito: ${err.message}`);
      if (tentativo < MAX_TENTATIVI) {
        const pausa = tentativo * 10000; // 10s, 20s
        console.log(`Attendo ${pausa/1000}s prima del prossimo tentativo...`);
        await new Promise(r => setTimeout(r, pausa));
      }
    }
  }

  // Se tutti i tentativi falliscono, usa i contenuti del giorno prima
  if (!contenuti) {
    console.log('\nTutti i tentativi falliti. Uso contenuti del giorno prima come fallback.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      const vecchi = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      // Aggiorna solo la data e aggiunge nota fallback
      vecchi.generato_il = new Date().toISOString();
      vecchi.fallback = true;
      vecchi.errore = erroreFinale.message;
      // Modifica il ticker per segnalare il fallback
      if (vecchi.ticker) {
        vecchi.ticker[0] = 'Redazione in pausa tecnica, torniamo domani';
      }
      contenuti = vecchi;
      console.log('Fallback: uso contenuti precedenti con data aggiornata.');
    } else {
      // Nessun contenuto precedente — crea contenuto minimo di emergenza
      console.log('Nessun contenuto precedente. Creo contenuto di emergenza.');
      contenuti = {
        generato_il: new Date().toISOString(),
        fallback: true,
        crotone: {
          titolo: 'Crotone: la redazione e in pausa tecnica, ma il sogno Champions continua',
          sottotitolo: 'Pausa Tecnica',
          testo: 'I nostri giornalisti stanno ricaricando le energie. Torniamo domani con notizie ancora piu assurde.'
        },
        milan: { titolo: 'Milan: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: 'Crisi Nera' },
        juve: { titolo: 'Juve: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: 'Fenomeno?' },
        inter: { titolo: 'Inter: notizie in aggiornamento', testo: 'Contenuti in arrivo domani.', badge: 'Bidone d\'Oro' },
        seriea_extra: { titolo: 'Serie A: aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        seriea_extra2: { titolo: 'Serie A: aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        fanta_flop: { titolo: 'Fantacalcio: dati in aggiornamento', testo: 'Torniamo domani.' },
        fanta_top: { titolo: 'Fantacalcio: dati in aggiornamento', testo: 'Torniamo domani.' },
        minori_tennis: { titolo: 'Tennis: aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_f1: { titolo: 'F1: aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_altro: { categoria: 'Sport', titolo: 'Sport: aggiornamento in corso', testo: 'Torniamo domani.' },
        ticker: ['Redazione in pausa tecnica', 'Torniamo domani', 'Il Crotone intanto si allena', 'Campionato sempre piu vicino', 'Restate sintonizzati'],
        sondaggio_domanda: 'Cosa fai quando il sito non si aggiorna?',
        sondaggio_opzioni: ['Aspetto paziente', 'Mi arrabbio', 'Guardo la TV', 'Vado al bar'],
        vincenti: [
          { nome: 'La Redazione', testo: 'Torna domani con contenuti freschi e assurdi come sempre.' },
          { nome: 'Il Crotone', testo: 'Sempre nel nostro cuore, qualunque serie stia giocando.' }
        ]
      };
    }
  }

  // Salva contenuti
  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');

  // Salva sondaggio (solo se non fallback o se non esiste)
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
    console.log('\nATTENZIONE: usato contenuto di fallback. Errore:', erroreFinale?.message);
    // Esce con codice 0 comunque — il sito rimane funzionante
  } else {
    console.log('\nContenuti generati e salvati con successo:', contenuti.generato_il);
  }
}

genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  // Esce con 0 per non bloccare il workflow — il fallback e' gia stato gestito
  process.exit(0);
});
