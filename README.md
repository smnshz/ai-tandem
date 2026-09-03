# AI Sprachtandem

Eine kleine Web-App zum Sprachenlernen im Gespräch: Du hinterlegst einen
Initial-Prompt (Rolle, Situation, Niveau), führst darin Gespräche mit Claude –
und **tippst im Chat auf einzelne Zeichen**, um Aussprache und Bedeutung
eingeblendet zu bekommen. Mehrere Zeichen markieren übersetzt den ganzen
Ausschnitt.

Voreingestellt ist traditionelles Chinesisch mit deutschen Erklärungen; die
Sprachen lassen sich pro Bereich umstellen.

Reines Frontend, kein Backend, keine Datenbank. Alles liegt im `localStorage`
des Browsers.

## Bedienung

- **Bereich**: bündelt Sprache + Initial-Prompt, z.B. „Chinesisch". Der Prompt
  legt fest, in welche Rolle Claude schlüpft.
- **Gespräch**: ein Chat innerhalb eines Bereichs. Beliebig viele pro Bereich.
- **Antippen**: ein Zeichen antippen → Pinyin + Bedeutung. Über mehrere Zeichen
  ziehen → Umschrift, Wortzerlegung und Übersetzung des Ausschnitts.
- **übersetzen** unter einer Nachricht übersetzt die ganze Nachricht.
- **🔊** liest Text über die Sprachausgabe des Browsers vor (Qualität und
  verfügbare Stimmen hängen vom Betriebssystem ab).
- Nachgeschlagene Ausdrücke landen in einem lokalen Cache; **↻** im Popup
  erzwingt einen frischen Lookup.

## API-Key

Die App spricht die Claude API **direkt aus dem Browser** an. Der Key steht
deshalb nicht im Repository, sondern wird zur Laufzeit eingetragen:

1. Key erstellen: <https://console.anthropic.com/settings/keys> (beginnt mit `sk-ant-`).
2. In der App **⚙ Einstellungen** öffnen, Key einfügen, speichern.
3. Der Key liegt danach im `localStorage` dieses Browsers (Schlüssel
   `ai-tandem.v1.settings`) und wird bei jedem Request als `x-api-key`
   mitgeschickt.

**Was das bedeutet:** Wer Zugriff auf denselben Browser hat (oder JavaScript in
die Seite einschleusen kann), kann den Key lesen. Für den persönlichen Gebrauch
auf eigenen Geräten ist das okay – wenn die App öffentlich für andere Nutzer
laufen soll, gehört ein Proxy davor (siehe unten). Im privaten/Inkognito-Modus
ist der Key – wie alle anderen Daten auch – nach dem Schließen des Tabs weg.

Trag den Key **nicht** als `VITE_...`-Variable in den Build ein: alles, was Vite
zur Buildzeit einsetzt, steht anschließend im öffentlich abrufbaren JS-Bundle.

## Lokal starten

```bash
npm install
npm run dev      # http://localhost:5173/ai-tandem/
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
```

## Deployment auf GitHub Pages

`.github/workflows/deploy.yml` baut und veröffentlicht die App bei jedem Push
auf `main`. Einmalig einzustellen:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push auf `main` (oder den Workflow manuell über *Actions → Deploy to GitHub
   Pages → Run workflow* starten).

Die App liegt danach unter `https://<user>.github.io/ai-tandem/`.

Für anderes Hosting (Netlify, Vercel, eigene Domain im Root) mit
`BASE_PATH=/ npm run build` bauen.

## Modelle und Kosten

In den Einstellungen lassen sich Modelle getrennt wählen für das Gespräch und
für das Nachschlagen. Voreinstellung ist jeweils Claude Opus 5. Wer die App viel
benutzt, kann fürs Nachschlagen auf Sonnet 5 oder Haiku 4.5 gehen – das sind
kurze, gut abgesteckte Anfragen. Beide Aufrufe laufen mit `effort: "low"`, weil
Plauderei und Wörterbuch-Lookups keine tiefe Analyse brauchen; Antworten sind
dadurch schneller und günstiger. Nachgeschlagene Ausdrücke werden lokal
gecacht, kosten also nur beim ersten Mal.

## Aufbau

```
src/
  lib/
    anthropic.ts    Claude-Aufrufe: Streaming-Chat + strukturierter Lookup
    prompt.ts       System-Prompt aus Bereich + Tandem-Regeln
    state.ts        App-State inkl. Persistenz (React-Hook)
    storage.ts      localStorage-Wrapper, fällt im Privatmodus auf RAM zurück
    tokenize.ts     zerlegt Text in antippbare Zeichen/Wörter
    lookupCache.ts  lokaler Cache für Nachschlage-Ergebnisse
    languages.ts    Sprachliste (Umschrift-Name, Tokenisierung, TTS-Locale)
  components/
    AnnotatedText   antippbarer Text (Tap = ein Zeichen, Ziehen = mehrere)
    LookupPopup     Karte bzw. Bottom-Sheet mit Umschrift/Bedeutung
    MessageList, Composer, Sidebar, AreaDialog, SettingsDialog
```

## Später: Datenbank statt localStorage

Die Persistenz hängt an genau einer Stelle: `src/lib/storage.ts` (`load` /
`save`). Wer auf ein Backend wechselt, tauscht diese beiden Funktionen gegen
API-Aufrufe – der Rest der App weiß nicht, wo die Daten liegen.

Für Mehrbenutzer-Betrieb kommt zusätzlich ein Proxy dazu: ein kleiner Endpunkt
(z.B. Cloudflare Worker oder eine Serverless Function), der den API-Key
serverseitig hält und die Requests an die Claude API weiterreicht. In
`src/lib/anthropic.ts` ist dafür nur die Client-Erzeugung anzupassen
(`baseURL` auf den eigenen Endpunkt, `apiKey` entfällt).

## Grenzen des POC

- Kein Login, keine Synchronisation zwischen Geräten.
- Der Lookup-Cache ist kontextfrei: gleiche Zeichenfolge = gleicher
  Cache-Eintrag, auch wenn ein anderer Satz eine andere Lesart nahelegt. Bei
  Bedarf **↻** drücken.
- Die Wortzerlegung beim Nachschlagen kommt vom Modell, nicht aus einem
  Wörterbuch – gut, aber nicht unfehlbar.
