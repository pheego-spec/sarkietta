# La Sarkietta dello Sport — Setup per hosting SFTP + PHP

## Come funziona

1. **GitHub Actions** gira ogni mattina alle 06:00 (ora italiana)
2. Chiama l'API Anthropic, genera tutti i contenuti del giorno
3. Salva `contenuti.json` e `sondaggio.json`
4. Carica tutto via FTP sul tuo hosting automaticamente
5. `index.php` legge i JSON e mostra il sito — nessun server Node.js necessario

---

## Setup in 4 passi

### 1. Crea un repository GitHub

- Vai su github.com → New repository → nome: `sarkietta`
- Carica tutti i file di questa cartella nel repository

### 2. Aggiungi i Secrets su GitHub

Vai su: **Settings → Secrets and variables → Actions → New repository secret**

Aggiungi questi 4 secrets:

| Nome | Valore |
|------|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (la tua chiave Anthropic) |
| `FTP_HOST` | es. `ftp.tuodominio.it` |
| `FTP_USERNAME` | es. `user@tuodominio.it` |
| `FTP_PASSWORD` | la tua password FTP |
| `FTP_REMOTE_DIR` | es. `/public_html/` oppure `/www/sarkietta/` |

### 3. Carica i file sul tuo hosting via SFTP

Carica **solo la cartella `public/`** sul tuo hosting:
```
index.php        → /public_html/index.php  (o dove vuoi)
contenuti.json   → stesso posto (verrà sovrascritto ogni mattina)
sondaggio.json   → stesso posto
fantacalcio.json → stesso posto
```

Assicurati che PHP abbia **permessi di scrittura** su `sondaggio.json`
(chmod 666 su sondaggio.json e contenuti.json)

### 4. Primo test manuale

Su GitHub: **Actions → "Aggiorna Sarkietta ogni mattina" → Run workflow**

Questo fa girare il processo subito, senza aspettare le 06:00.
Dopo ~30 secondi i contenuti saranno sul tuo sito.

---

## Aggiornare la classifica Fantacalcio

Modifica `fantacalcio.json` e ricaricalo via SFTP:

```json
{
  "giornata": "Giornata 29",
  "squadre": [
    { "manager": "Marco",  "squadra": "Galactic FC",           "punti": 57 },
    { "manager": "Luca",   "squadra": "Il Fenomeno",            "punti": 54 },
    { "manager": "Gianni", "squadra": "Trequartisti Ubriachi",  "punti": 50 },
    { "manager": "Paolo",  "squadra": "Spezia Superstar",       "punti": 46 },
    { "manager": "Andrea", "squadra": "Portieri Scarsi",        "punti": 41 },
    { "manager": "Stefano","squadra": "F.C. Boh",               "punti": 36 }
  ]
}
```

---

## Struttura file sul tuo hosting

```
public_html/
├── index.php          ← il sito (non modificare)
├── contenuti.json     ← generato automaticamente ogni mattina
├── sondaggio.json     ← generato automaticamente + aggiornato dai voti
└── fantacalcio.json   ← aggiornamento manuale
```

---

## Permessi file (importante!)

Sul tuo hosting, imposta via FTP/SFTP:
- `sondaggio.json` → **chmod 666** (PHP deve poterlo scrivere per i voti)
- `contenuti.json` → **chmod 666**
- `fantacalcio.json` → **chmod 644** (solo lettura)
- `index.php` → **chmod 644**
