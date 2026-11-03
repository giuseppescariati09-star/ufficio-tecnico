# PWA "Ufficio tecnico": progetto

Stato: bozza da approvare. Data: 3 novembre 2026.

## Obiettivo

Preparare una sola persona al concorso da Istruttore Tecnico/Geometra del Comune di Itri, in modo immersivo e simile a un gioco.

Il progetto funziona se l'utente:
- studia ogni giorno in sessioni di circa 15 minuti, anche da telefono e senza connessione;
- arriva stabilmente ad almeno 21/30 nelle simulazioni scritte;
- sa spiegare a voce le risposte alle domande dell'orale.

## Fatti dal bando e ipotesi

- Dal bando: scritto a quiz con soglia 21/30, orale con soglia 21/30, inglese e informatica a giudizio di idoneità.
- Ipotesi: il bando non indica numero di domande e durata dello scritto. La simulazione usa 30 domande in 30 minuti, modificabili nelle impostazioni.

## Esperienza

L'utente è il tecnico di un ufficio comunale. Ogni giorno trova sulla scrivania alcune pratiche, tra ripassi e casi nuovi.

1. Legge il caso e decide prima di studiare.
2. Riceve subito la correzione, con l'articolo di legge e il link al testo ufficiale.
3. Gli errori tornano dopo 1, 3, 7, 14 e 30 giorni. Una risposta sbagliata riporta il caso a 1 giorno.
4. Il progresso è la padronanza per ufficio. Non ci sono classifiche, punti fini a se stessi o serie da non interrompere.

Quattro uffici, ricavati dalle materie del bando:
- Procedimento e Comune: enti locali, contabilità, diritto amministrativo e costituzionale, procedimento, anticorruzione, trasparenza, accesso.
- Territorio: edilizia, urbanistica, ambiente, norme nazionali e del Lazio.
- Beni del Comune: patrimonio, espropri, demanio marittimo.
- Opere pubbliche: lavori pubblici, contratti, MePA, sicurezza sul lavoro e nei cantieri.

Modalità:
- Scrivania: la sessione del giorno.
- Scritto: simulazione a tempo, risultato su 30 ed elenco degli errori.
- Orale: domanda sorteggiata, risposta a voce con timer, autovalutazione sui punti chiave.

## Contenuti

Prima versione: 120 casi a risposta multipla e 20 domande orali, distribuiti tra i quattro uffici.

Regole:
- Le domande sono originali. I quiz di siti terzi non vengono copiati.
- Ogni caso ha norma, articolo, link alla fonte ufficiale e data di verifica. Il controllo automatico rifiuta i casi senza questi dati.
- Le prove pubblicate servono solo a capire quali argomenti tornano più spesso.

## Progetto tecnico, nell'ordine richiesto

1. System design: app statica per un solo utente. Tutta la logica gira sul dispositivo.
2. System architecture: moduli separati per ripasso, simulazione, archiviazione, contenuti e interfaccia.
3. Frontend: HTML, CSS e JavaScript senza framework, pensati prima per il telefono e accessibili da tastiera e lettori di schermo.
4. API e backend: nessuno nella prima versione. La logica di ripasso è una funzione pura e testabile.
5. Database e storage: progresso in `localStorage`, con esportazione e importazione di un file di backup. I contenuti sono file JSON.
6. Auth e permessi: nessun account. L'unico permesso del browser è il microfono, se in futuro verrà aggiunta la dettatura.
7. Hosting e cloud: hosting statico HTTPS gratuito, da scegliere prima della pubblicazione. L'anteprima può stare in un artifact privato.
8. CI/CD e version control: repository Git. A ogni modifica girano i test e la validazione dei contenuti.
9. Sicurezza: Content Security Policy restrittiva, nessuno script di terze parti, nessun dato personale inviato fuori dal dispositivo, testi mostrati senza interpretare HTML.
10. Rate limiting: non serve, perché non c'è un server.
11. Caching e CDN: service worker con precache per l'uso offline e versione dei contenuti per gli aggiornamenti.
12. Error tracking e log: registro locale degli errori, incluso nel backup. Nessun tracciamento esterno.
13. Monitoring e alert: avviso nell'app per i contenuti con verifica più vecchia di 90 giorni.
14. Testing: `node:test` per ripasso, punteggio e validazione; Playwright per il percorso completo, il telefono e l'offline.
15. Scaling: contenuti divisi per ufficio e dati del concorso in un file di configurazione, così l'app può essere riusata per altri concorsi.

## Gestione degli errori

- Storage non disponibile: l'app funziona per la sessione e avvisa che il progresso non verrà salvato.
- Backup non valido: viene rifiutato senza toccare i dati esistenti.
- Contenuti non caricati: messaggio chiaro con il tasto per riprovare.

## Fuori dalla prima versione

Sincronizzazione tra dispositivi, account, classifiche, valutazione automatica dell'orale.

## Punti che la ricerca può cambiare

- Distribuzione dei casi tra gli uffici, in base alle prove reali trovate.
- Algoritmo di ripasso, se le prove giustificano qualcosa di più complesso degli intervalli fissi.
- Dettatura vocale per l'orale, se il supporto in italiano su telefono è affidabile.

## Design

Stile iOS, pensato prima per iPhone: titoli grandi, liste raggruppate, barra di navigazione in basso, colori di sistema, tema chiaro e scuro. Il profilo completo è in `.ux-profile.md`: WCAG 2.1 AA, tono caldo e umano, icone Lucide incluse nell'app.

## Domanda di partecipazione

L'utente ha dichiarato di aver già inviato la domanda, quindi l'app resta legata al concorso di Itri.
