# AI Sprachtandem

Eine kleine Web-App zum Sprachenlernen im Gespräch: Du hinterlegst einen
Initial-Prompt (Rolle, Situation, Niveau), führst darin Gespräche mit einer KI –
und **tippst im Chat auf einzelne Zeichen**, um Aussprache und Bedeutung
eingeblendet zu bekommen. Mehrere Zeichen markieren erklärt den ganzen
Ausschnitt.

Voreingestellt ist traditionelles Chinesisch mit deutschen Erklärungen; die
Sprachen lassen sich pro Bereich umstellen.

Reines Frontend, kein Backend, keine Datenbank. Alles liegt im `localStorage`
des Browsers.

## Nachschlagen läuft offline

Für Chinesisch → Deutsch bringt die App das Wörterbuch **HanDeDict** mit
(~122.000 Einträge). Antippen kostet damit weder API-Aufrufe noch Wartezeit:
die Auswahl wird lokal in Wörter zerlegt und mit Pinyin und Bedeutung
angezeigt.

Die KI wird nur gefragt, wenn du sie brauchst:

- **„Im Satzkontext erklären"** – wenn ein Wort mehrdeutig ist,
- **„Fehlende Wörter klären"** – wenn das Wörterbuch etwas nicht kennt,
- **„Übersetzen"** unter einer Nachricht – für eine flüssige Übersetzung,
- und natürlich für das Gespräch selbst.

KI-Ergebnisse werden lokal zwischengespeichert. Für andere Sprachpaare als
Chinesisch → Deutsch gibt es kein Wörterbuch; dort läuft jedes Nachschlagen
über die KI.

## Bedienung

- **Bereich**: bündelt Sprache + Initial-Prompt, z.B. „Chinesisch". Der Prompt
  legt fest, in welche Rolle die KI schlüpft.
- **Gespräch**: ein Chat innerhalb eines Bereichs. Beliebig viele pro Bereich.
- **Antippen**: ein Zeichen antippen → Pinyin + Bedeutung. Über mehrere Zeichen
  ziehen → Wortzerlegung des Ausschnitts.
- **Vorlesen** gibt Text über die Sprachausgabe des Browsers aus (Qualität
  und verfügbare Stimmen hängen vom Betriebssystem ab).
- **Audio-Modus**: Mikrofon-Symbol im Eingabefeld antippen, sprechen,
  nochmal antippen zum Senden. Die Aufnahme geht als Audiodatei direkt an die
  KI – **ohne** lokale Spracherkennung dazwischen. Gerade bei noch unsicherer
  Aussprache ist das zuverlässiger als der Umweg über eine Transkription, die
  eigene Fehler mitbringt. Die Antwort kommt als Text und wird automatisch
  vorgelesen. Aktuell nur mit Google Gemini (Claude versteht über die API kein
  Audio); Aufnahmen bleiben nur für die laufende Sitzung im Speicher, nicht im
  `localStorage`.

## API-Key

Die App spricht die KI **direkt aus dem Browser** an. Der Key steht deshalb
nicht im Repository, sondern wird zur Laufzeit eingetragen: **Einstellungen**
→ Anbieter wählen → Key einfügen → speichern.

| Anbieter | Key holen | Kosten |
| --- | --- | --- |
| Google Gemini (Standard) | <https://aistudio.google.com/apikey> | Flash-Modelle haben ein kostenloses Kontingent mit Tages-/Minutenlimits |
| Anthropic Claude | <https://console.anthropic.com/settings/keys> | nur mit API-Guthaben, siehe unten |

Über **„Modelle laden"** in den Einstellungen holt die App die Liste der
Modelle, die dein Key tatsächlich freischaltet – praktisch, wenn ein
voreingestellter Modellname bei dir nicht verfügbar ist.

### Warum das Claude-Abo hier nicht gilt

Ein Claude-Abo (Pro/Max) gilt für claude.ai und Claude Code, nicht für eigene
Anwendungen. Die API rechnet getrennt über API-Guthaben ab; es gibt keinen
unterstützten Weg, das Abo-Kontingent aus einer eigenen App heraus zu nutzen.
Deshalb ist Gemini voreingestellt: dessen Flash-Modelle haben ein kostenloses
Kontingent, und durch das Offline-Wörterbuch bleiben ohnehin nur die
Gesprächsantworten als API-Aufrufe übrig.

### Wo der Key landet

Der Key liegt im `localStorage` dieses Browsers (Schlüssel
`ai-tandem.v1.settings`) und wird bei jedem Request direkt an den Anbieter
geschickt. Wer Zugriff auf denselben Browser hat (oder JavaScript in die Seite
einschleusen kann), kann ihn auslesen. Für den persönlichen Gebrauch auf
eigenen Geräten ist das okay – soll die App öffentlich für andere Nutzer
laufen, gehört ein Proxy davor (siehe unten). Im privaten/Inkognito-Modus ist
der Key – wie alle anderen Daten auch – nach dem Schließen des Tabs weg.

Trag den Key **nicht** als `VITE_...`-Variable in den Build ein: alles, was Vite
zur Buildzeit einsetzt, steht anschließend im öffentlich abrufbaren JS-Bundle.

## Lokal starten

```bash
npm install
npm run dict     # lädt HanDeDict und baut public/dict/ (einmalig, ~60 MB Download)
npm run dev      # http://localhost:5173/ai-tandem/
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
```

`npm run build` baut das Wörterbuch bei Bedarf selbst (`--if-missing`). Schlägt
der Download fehl, läuft der Build trotzdem durch – die App fragt dann für
jedes Nachschlagen die KI.

## Deployment auf GitHub Pages

`.github/workflows/deploy.yml` baut und veröffentlicht die App bei jedem Push
auf `main`. Einmalig einzustellen:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push auf `main` (oder den Workflow manuell über *Actions → Deploy to GitHub
   Pages → Run workflow* starten).

Die App liegt danach unter `https://<user>.github.io/ai-tandem/`.

Für anderes Hosting (Netlify, Vercel, eigene Domain im Root) mit
`BASE_PATH=/ npm run build` bauen.

## Aufbau

```
scripts/
  build-dict.mjs    baut public/dict/ aus HanDeDict (Download + Kürzung)
src/
  lib/
    ai.ts           Fassade: Wörterbuch → Cache → KI, anbieterunabhängig
    providers/
      gemini.ts     Gemini über REST (SSE-Streaming, responseSchema)
      anthropic.ts  Claude über das offizielle SDK
      types.ts      gemeinsame Schnittstelle beider Anbieter
    dictionary.ts   lädt das Offline-Wörterbuch, zerlegt Auswahl in Wörter
    prompt.ts       System-Prompts aus Bereich + Tandem-Regeln
    state.ts        App-State inkl. Persistenz (React-Hook)
    storage.ts      localStorage-Wrapper, fällt im Privatmodus auf RAM zurück
    tokenize.ts     zerlegt Text in antippbare Zeichen/Wörter
    lookupCache.ts  lokaler Cache für KI-Ergebnisse
    languages.ts    Sprachliste (Umschrift-Name, Tokenisierung, TTS-Locale)
  components/
    AnnotatedText   antippbarer Text (Tap = ein Zeichen, Ziehen = mehrere)
    LookupPopup     Karte bzw. Bottom-Sheet mit Umschrift/Bedeutung
    Dialog          gemeinsame Hülle für Dialoge (Kopf, Inhalt, Fußzeile)
    MessageList, Composer, Sidebar, AreaDialog, SettingsDialog
  styles.css        Design-Tokens (Farben, Radien, Abstände) + Layout
```

## Oberfläche

Die Gestaltung hängt an einem kleinen Satz Tokens in `src/styles.css`:
Flächen, eine Linienfarbe, ein Akzent sowie je eine Radien- und
Abstandsskala. Helles und dunkles Farbschema folgen der Systemeinstellung.

- Icons kommen einheitlich aus [Lucide](https://lucide.dev) – Größe und
  Strichstärke sind zentral im `LucideProvider` in `src/main.tsx` gesetzt.
- Buttons haben genau vier Varianten (`btn`, `btn--ghost`, `btn--quiet`,
  `btn--danger`) und auf Touch-Geräten mindestens 44px Grundfläche.
- Dialoge nutzen dieselbe Hülle: Hauptaktionen rechts, Nebenaktionen links;
  auf dem Handy werden sie zur Vollbildseite mit gestapelten Buttons.
- Der Viewport ist auf feste Skalierung gestellt und Eingabefelder haben 16px
  Schriftgröße, damit iOS beim Antippen nicht hineinzoomt.

Einen weiteren Anbieter einzubauen heißt: ein Modul in `src/lib/providers/`
anlegen, das `Provider` implementiert, und es in `ai.ts` registrieren.

## Später: Datenbank statt localStorage

Die Persistenz hängt an genau einer Stelle: `src/lib/storage.ts` (`load` /
`save`). Wer auf ein Backend wechselt, tauscht diese beiden Funktionen gegen
API-Aufrufe – der Rest der App weiß nicht, wo die Daten liegen.

Für Mehrbenutzer-Betrieb kommt zusätzlich ein Proxy dazu: ein kleiner Endpunkt
(z.B. Cloudflare Worker oder eine Serverless Function), der den API-Key
serverseitig hält und die Requests weiterreicht. Im Provider-Modul ist dafür
nur die Basis-URL anzupassen.

## Grenzen des POC

- Kein Login, keine Synchronisation zwischen Geräten.
- Der KI-Cache ist kontextfrei: gleiche Zeichenfolge = gleicher Cache-Eintrag.
- Die Wortzerlegung nimmt den längsten passenden Wörterbucheintrag. Das ist bei
  Chinesisch fast immer richtig, aber nicht immer – im Zweifel hilft „im
  Satzkontext erklären".
- Das Wörterbuch enthält Einträge bis vier Zeichen Länge; längere Ausdrücke
  werden aus kürzeren zusammengesetzt.
- Sprachnachrichten (Audio-Modus) werden nicht dauerhaft gespeichert – nach
  einem Neuladen der Seite bleibt der Gesprächsverlauf erhalten, die
  Audiodatei selbst ist weg.

## Datenquellen und Lizenzen

Das Offline-Wörterbuch basiert auf [HanDeDict](https://github.com/gugray/HanDeDict)
(Chinesisch-Deutsch, kollaborativ gepflegt), lizenziert unter
[CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.de). Die von
`scripts/build-dict.mjs` erzeugte Datei ist eine gekürzte Fassung dieser Daten
und steht damit unter derselben Lizenz. Quelle und Datenstand zeigt die App in
den Einstellungen an.
