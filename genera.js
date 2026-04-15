const fs = require('fs');
const path = require('path');

async function genera() {
  console.log('Generazione contenuti con DeepSeek:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

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
  console.log('Tokens usati:', JSON.stringify(data.usage));

  let raw = data.choices[0].message.content.trim();
  console.log('Lunghezza risposta:', raw.length, 'chars');

  // Rimuove backtick markdown
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

  // Estrae solo da { a ultimo }
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato nella risposta');
  raw = raw.substring(start);

  // Pulisce caratteri di controllo
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();

  // Se il JSON e' troncato, prova a chiuderlo
  if (!raw.endsWith('}')) {
    console.log('JSON troncato, tento riparazione...');
    // Trova l'ultimo } valido e chiudi li
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > 0) {
      raw = raw.substring(0, lastBrace + 1);
      // Conta { e } aperti/chiusi e aggiungi quelli mancanti
      let open = 0, close = 0;
      let inStr = false, escape = false;
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
      if (missing > 0) raw += '}'.repeat(missing);
      console.log('Riparazione: aggiunti', missing, 'chiusure }');
    }
  }

  console.log('Ultimi 100 chars:', raw.substring(raw.length - 100));

  const contenuti = JSON.parse(raw);
  contenuti.generato_il = new Date().toISOString();

  fs.writeFileSync(
    path.join(__dirname, 'public', 'contenuti.json'),
    JSON.stringify(contenuti, null, 2),
    'utf8'
  );

  const sondaggio = {
    domanda: contenuti.sondaggio_domanda,
    opzioni: contenuti.sondaggio_opzioni,
    voti: [0, 0, 0, 0],
    data: new Date().toDateString()
  };
  fs.writeFileSync(
    path.join(__dirname, 'public', 'sondaggio.json'),
    JSON.stringify(sondaggio, null, 2),
    'utf8'
  );

  console.log('Contenuti salvati con successo:', contenuti.generato_il);
}

genera().catch(err => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
