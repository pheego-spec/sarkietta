const fs = require('fs');
const path = require('path');

async function genera() {
  console.log('Generazione contenuti con DeepSeek:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi e' ${oggi}.
Rispondi SOLO con JSON valido su UNA SOLA RIGA, zero markdown, zero backtick, zero newline dentro le stringhe.
Ogni valore testuale: massimo 20 parole, tutto su una riga senza a capo.

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"..."},"fanta_top":{"titolo":"...","testo":"..."},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}

Sostituisci ogni "..." con testo ironico reale. Crotone sempre protagonista assurdo. Tono sarcastico intelligente.`;

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

  // Estrae solo la parte JSON (da { a })
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nessun JSON trovato nella risposta');
  raw = raw.substring(start, end + 1);

  // Pulisce caratteri di controllo dentro le stringhe JSON
  // Sostituisce newline/tab/carriage return dentro valori stringa
  raw = raw.replace(/[\r\n\t]/g, ' ');
  // Collassa spazi multipli
  raw = raw.replace(/  +/g, ' ');

  console.log('Primi 200 chars puliti:', raw.substring(0, 200));

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
