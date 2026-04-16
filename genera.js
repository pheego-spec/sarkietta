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
      .map(r => `${r.casa} ${r.gol_casa}-${r.gol_fuori} ${r.fuori}`).join('; ');
  }
  return `${fanta.giornata}. Classifica: ${classifica}. Risultati: ${risultati}`;
}
 
async function cercaNotizieSport() {
  // Usa il proxy RSS sul tuo hosting — ha IP normale, non viene bloccato
  const proxyUrl = process.env.RSS_PROXY_URL || 'https://sarkietta.it/rss_proxy.php';
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { console.log('Proxy RSS errore:', res.status); return []; }
    const data = await res.json();
    if (!data.ok) { console.log('Proxy RSS fallito'); return []; }
    const titoli = data.titoli || [];
    console.log(`Proxy RSS: trovate ${titoli.length} notizie reali`);
    titoli.slice(0,8).forEach((t,i) => console.log(`  ${i+1}. ${t.substring(0,80)}`));
    return titoli;
  } catch(e) {
    console.log('Proxy RSS fallito:', e.message);
    return [];
  }
}
 
async function callDeepSeek(prompt, systemMsg) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 3000,
      temperature: 1.1,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const data = await response.json();
  console.log('Tokens:', data.usage.total_tokens);
  return data.choices[0].message.content.trim();
}
 
function pulisciRaw(raw) {
  // Fix encoding UTF-8 mal interpretato
  try { raw = decodeURIComponent(escape(raw)); } catch(e) {}
  // Rimuovi backtick markdown
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  // Estrai solo il JSON
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start, end + 1);
  // Normalizza spazi
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
  // Sostituisce virgolette tipografiche
  raw = raw.replace(/[\u2018\u2019\u2032]/g, '');
  raw = raw.replace(/[\u201C\u201D]/g, '');
  // Rimuove apostrofi dentro le stringhe JSON (tra due caratteri alfanumerici)
  raw = raw.replace(/([a-zA-Z])'([a-zA-Z])/g, '$1$2');
  return raw;
}
 
const TEMI = [
  'investitori arabi comprano il Crotone', 'Haaland vuole giocare sul mare',
  'nuovo stadio galleggiante sullo Ionio', 'Mourinho chiede la panchina del Crotone',
  'Mbappe rifiuta il PSG per il Crotone', 'Champions League 2030 obiettivo del Crotone',
  'Crotone batte il Real Madrid in amichevole', 'presidente del Crotone va in TV a piangere',
  'Crotone primo in Serie D con record storico', 'VAR del Crotone funziona con il telefono di casa',
  'Crotone vince il Nobel per la tattica difensiva', 'Ronaldo offerto al Crotone per 50 euro'
];
 
async function genera() {
  console.log('=== Sarkietta ===');
  console.log('Data:', new Date().toISOString());
 
  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const tema = TEMI[dayOfYear % TEMI.length];
  const ts = Date.now();
 
  const fanta = leggiFantacalcio();
  const fantaRiep = fantaRiepilogo(fanta);
  console.log('Tema oggi:', tema);
 
  // Cerca notizie reali via NewsAPI
  const notizie = await cercaNotizieSport();
  const notizieTesto = notizie.length > 0
    ? '\nNOTIZIE REALI DI OGGI (usale come base per Milan/Juve/Inter/SerieA):\n' + notizie.map((t,i) => `${i+1}. ${t}`).join('\n')
    : '';
 
  // Prompt MOLTO semplificato — campi brevi, niente apostrofi
  const prompt = `Sei un giornalista satirico italiano. Oggi ${oggi}. ID sessione ${ts}.
 
Tema Crotone: ${tema}
Fantacalcio: ${fantaRiep}
 
Genera un oggetto JSON con questi campi. REGOLE ASSOLUTE:
- Nessun apostrofo (scrivi "dell Inter" non "dell'Inter")  
- Nessuna virgoletta dentro i valori
- Massimo 12 parole per valore
- Solo testo semplice
 
{
  "crotone_titolo": "notizia assurda sul tema ${tema}",
  "crotone_sub": "sottotitolo breve",
  "crotone_testo": "testo breve",
  "milan_titolo": "notizia ironica sul Milan",
  "milan_testo": "testo breve",
  "juve_titolo": "notizia ironica sulla Juventus",
  "juve_testo": "testo breve",
  "inter_titolo": "notizia ironica sull Inter",
  "inter_testo": "testo breve",
  "extra1_titolo": "notizia su altra squadra Serie A",
  "extra1_testo": "testo breve",
  "extra1_team": "nome squadra",
  "extra2_titolo": "altra notizia Serie A",
  "extra2_testo": "testo breve",
  "extra2_team": "nome squadra",
  "fanta_flop_titolo": "squadra flop con ironia",
  "fanta_flop_testo": "spiegazione comica",
  "fanta_flop_squadra": "nome squadra reale dalla classifica",
  "fanta_top_titolo": "squadra top con ironia",
  "fanta_top_testo": "spiegazione comica",
  "fanta_top_squadra": "nome squadra reale dalla classifica",
  "fanta_commento": "commento ironico sulla giornata",
  "tennis_titolo": "notizia ironica sul tennis",
  "tennis_testo": "testo breve",
  "f1_titolo": "notizia ironica sulla Formula 1",
  "f1_testo": "testo breve",
  "altro_sport": "nome sport",
  "altro_titolo": "notizia ironica",
  "altro_testo": "testo breve",
  "ticker1": "breaking news breve",
  "ticker2": "breaking news breve",
  "ticker3": "breaking news breve",
  "ticker4": "breaking news breve",
  "ticker5": "breaking news breve",
  "sondaggio": "domanda ironica sul calcio",
  "opz1": "opzione A",
  "opz2": "opzione B",
  "opz3": "opzione C",
  "opz4": "opzione D",
  "crotone2_team": "area tematica es Mercato o Infrastrutture",
  "crotone2_titolo": "seconda notizia assurda sul Crotone diversa dalla prima",
  "crotone2_testo": "testo breve",
  "crotone3_team": "area tematica diversa",
  "crotone3_titolo": "terza notizia assurda sul Crotone completamente diversa",
  "crotone3_testo": "testo breve",
  "vince1_nome": "nome sportivo italiano",
  "vince1_testo": "commento ironico",
  "vince2_nome": "nome sportivo italiano",
  "vince2_testo": "commento ironico"
}`;
 
  let flat = null;
  for (let t = 1; t <= 3; t++) {
    console.log(`Tentativo ${t}/3...`);
    try {
      const raw = await callDeepSeek(prompt, `Giornalista satirico. ID:${ts}. Giorno:${dayOfYear}. ZERO apostrofi nei valori JSON.`);
      console.log('Raw (primi 200):', raw.substring(0, 200));
      const cleaned = pulisciRaw(raw);
      flat = JSON.parse(cleaned);
      console.log('JSON OK!');
      break;
    } catch(err) {
      console.log(`Fallito: ${err.message}`);
      if (t < 3) await new Promise(r => setTimeout(r, t * 8000));
    }
  }
 
  if (!flat) {
    console.log('Tutti i tentativi falliti — uso fallback');
    if (fs.existsSync(CONTENUTI_FILE)) {
      const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      prev.fallback = true;
      prev.generato_il = new Date().toISOString();
      fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(prev, null, 2), 'utf8');
    }
    return;
  }
 
  // Converti flat -> struttura contenuti
  const contenuti = {
    generato_il: new Date().toISOString(),
    crotone: { titolo: flat.crotone_titolo, sottotitolo: flat.crotone_sub, testo: flat.crotone_testo },
    milan:   { titolo: flat.milan_titolo, testo: flat.milan_testo, badge: 'Crisi Nera' },
    juve:    { titolo: flat.juve_titolo,  testo: flat.juve_testo,  badge: 'Fenomeno?' },
    inter:   { titolo: flat.inter_titolo, testo: flat.inter_testo, badge: "Bidone d'Oro" },
    seriea_extra:  { titolo: flat.extra1_titolo, testo: flat.extra1_testo, team: flat.extra1_team },
    seriea_extra2: { titolo: flat.extra2_titolo, testo: flat.extra2_testo, team: flat.extra2_team },
    fanta_flop:    { titolo: flat.fanta_flop_titolo, testo: flat.fanta_flop_testo, squadra: flat.fanta_flop_squadra },
    fanta_top:     { titolo: flat.fanta_top_titolo,  testo: flat.fanta_top_testo,  squadra: flat.fanta_top_squadra },
    fanta_commento: flat.fanta_commento,
    minori_tennis: { titolo: flat.tennis_titolo, testo: flat.tennis_testo },
    minori_f1:     { titolo: flat.f1_titolo, testo: flat.f1_testo },
    minori_altro:  { categoria: flat.altro_sport, titolo: flat.altro_titolo, testo: flat.altro_testo },
    ticker: [flat.ticker1, flat.ticker2, flat.ticker3, flat.ticker4, flat.ticker5],
    sondaggio_domanda: flat.sondaggio,
    sondaggio_opzioni: [flat.opz1, flat.opz2, flat.opz3, flat.opz4],
    crotone2: { team: flat.crotone2_team, titolo: flat.crotone2_titolo, testo: flat.crotone2_testo },
    crotone3: { team: flat.crotone3_team, titolo: flat.crotone3_titolo, testo: flat.crotone3_testo },
    vincenti: [
      { nome: flat.vince1_nome, testo: flat.vince1_testo },
      { nome: flat.vince2_nome, testo: flat.vince2_testo }
    ]
  };
 
  // Narrativa fanta separata
  if (fanta) {
    console.log('\nGenerazione narrativa fanta...');
    try {
      const nts = Date.now();
      const np = `Analista sarcastico fantacalcio. Dati: ${fantaRiep}. Sessione ${nts}.
Scrivi 3 frasi ironiche sulla stagione della Sarkiasuperlega. Rispondi SOLO con JSON:
{"titolo":"titolo ironico max 8 parole","p1":"frase 1 max 25 parole","p2":"frase 2 max 25 parole","p3":"frase 3 max 25 parole"}
Zero apostrofi. Zero virgolette nei valori.`;
      const nraw = await callDeepSeek(np, `Satirico. ID:${nts}. Zero apostrofi.`);
      console.log('Narrativa raw:', nraw.substring(0, 150));
      const nj = JSON.parse(pulisciRaw(nraw));
      contenuti.fanta_narrativa = { titolo: nj.titolo, paragrafi: [nj.p1, nj.p2, nj.p3], record: [] };
      console.log('Narrativa OK:', nj.titolo);
    } catch(err) {
      console.log('Narrativa fallita:', err.message);
      if (fs.existsSync(CONTENUTI_FILE)) {
        const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
        if (prev.fanta_narrativa) {
          contenuti.fanta_narrativa = prev.fanta_narrativa;
          console.log('Uso narrativa precedente');
        }
      }
    }
    contenuti.fanta_data = fanta;
  }
 
  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');
  fs.writeFileSync(SONDAGGIO_FILE, JSON.stringify({
    domanda: contenuti.sondaggio_domanda,
    opzioni: contenuti.sondaggio_opzioni,
    voti: [0, 0, 0, 0],
    data: new Date().toDateString()
  }, null, 2), 'utf8');
 
  console.log('\nContenuti salvati:', new Date().toISOString());
}
 
genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  process.exit(0);
});
