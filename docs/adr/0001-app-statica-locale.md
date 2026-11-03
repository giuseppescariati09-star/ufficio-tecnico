# ADR-0001: App statica con dati sul dispositivo

**Status:** Proposed
**Date:** 2026-11-03
**Deciders:** Giuseppe

## Context

L'app serve a una sola persona per preparare il concorso di Itri. Deve funzionare su iPhone, anche offline, e reggere fino alla data delle prove.

I contenuti sono testi di legge da aggiornare con le verifiche. Il progresso è la parte da non perdere. L'avviso del Comune del 29/10/2026 fissa lo scritto al 24/11/2026 e l'orale all'1/12/2026, quindi restano circa tre settimane.

Stato attuale: app statica su GitHub Pages, progresso in `localStorage`, backup manuale. La pubblicazione è riuscita su GitHub, ma l'app non è ancora stata provata su un iPhone vero.

## Decision

Mantenere per ora l'app statica senza backend, con questi rinforzi:
- richiesta di archiviazione persistente al browser;
- promemoria di backup;
- installazione sulla schermata Home come uso raccomandato.

Passare a un backend solo se si verifica una delle condizioni in "Quando rivedere".

## Options Considered

### Opzione A: statica con dati sul dispositivo (scelta)

| Dimensione | Valutazione |
|-----------|------------|
| Complessità | Bassa |
| Costo | Nessuno con repository pubblico |
| Scalabilità | Ampia per i contenuti; un dispositivo per il progresso |
| Familiarità | Non usa lo stack abituale dei progetti Lovable |

**Pro:** offline semplice, nessun account, nessun dato personale su server, niente da mantenere.
**Contro:** niente sincronizzazione; il progresso può perdersi se il browser cancella i dati e non c'è un backup.

### Opzione B: statica con sincronizzazione su Supabase

| Dimensione | Valutazione |
|-----------|------------|
| Complessità | Media: login, regole di accesso, conflitti tra dispositivi |
| Costo | Piano gratuito possibile, con limiti da verificare |
| Scalabilità | Più dispositivi e, in futuro, più utenti |
| Familiarità | Alta |

**Pro:** progresso al sicuro e disponibile su più dispositivi.
**Contro:** login e gestione degli errori di sincronizzazione; un servizio da tenere attivo per un solo utente.

### Opzione C: prodotto completo con TanStack Start e Supabase

| Dimensione | Valutazione |
|-----------|------------|
| Complessità | Alta |
| Costo | Hosting, database e manutenzione |
| Scalabilità | Pronta per più utenti e pagamenti |
| Familiarità | Alta: è lo standard dei progetti Lovable |

**Pro:** base adatta a un prodotto da vendere ad altri candidati.
**Contro:** toglie tempo a contenuti e studio, senza un vantaggio per l'obiettivo attuale.

## Trade-off Analysis

Il rischio principale del progetto è la correttezza delle domande, non la tecnologia. L'opzione A concentra il lavoro lì.

Il suo punto debole è la perdita del progresso. Safari può cancellare i dati dei siti poco usati: l'installazione sulla schermata Home e il backup riducono il rischio, ma non lo eliminano.

Il backend diventa utile solo se il progresso deve seguire l'utente su più dispositivi o se l'app diventa un prodotto. Il riuso di contenuti di terzi resterebbe comunque da chiarire prima di vendere.

## Scostamenti dagli standard dei progetti Lovable

Questo non è un progetto Lovable. TanStack Start, Supabase, funzioni Postgres e limiti di rate non si applicano perché non c'è un server.

Sentry è stato escluso per non inviare dati fuori dal dispositivo: gli errori restano in un registro locale, incluso nel backup. La conseguenza è che i guasti si scoprono solo se li segnala l'utente.

Restano validi: CI su ogni modifica, test della logica e nessuna credenziale nel codice. La ricerca automatica di segreti non è ancora nel CI.

## Consequences

- Più facile: lavorare sui contenuti e tenere l'app offline.
- Più difficile: studiare su più dispositivi, perché il progresso va spostato con un file.
- Da rivedere: il limite di `localStorage` non è un problema con i volumi attuali, ma va ricontrollato con storico e contenuti più ampi.

## Quando rivedere

- L'utente vuole studiare su due dispositivi.
- Il progresso si perde almeno una volta nell'uso reale.
- L'app deve essere offerta ad altri candidati.

## Action Items

1. [ ] Chiamare `navigator.storage.persist()` all'avvio e mostrare l'esito nel profilo.
2. [ ] Mostrare la data dell'ultimo backup e un promemoria dopo 7 giorni.
3. [ ] Provare installazione, offline e riavvio su un iPhone vero.
4. [ ] Aggiungere la ricerca di segreti al CI.
5. [ ] Completare la verifica delle domande sulle fonti ufficiali.
