# ADR-0001: App statica con sincronizzazione del progresso

**Status:** Accepted
**Date:** 2026-11-03
**Deciders:** Giuseppe

## Context

L'app serve a una sola persona per preparare il concorso di Itri. Deve funzionare su iPhone, anche offline, e reggere fino alla data delle prove.

I contenuti sono testi di legge da aggiornare con le verifiche. Il progresso è la parte da non perdere. L'avviso del Comune del 29/10/2026 fissa lo scritto al 24/11/2026 e l'orale all'1/12/2026, quindi restano circa tre settimane.

Stato attuale: app statica su GitHub Pages, progresso in `localStorage`, backup manuale. La pubblicazione è riuscita su GitHub, ma l'app non è ancora stata provata su un iPhone vero.

## Decision

L'utente studierà su iPhone e iPad e ha scelto la sincronizzazione automatica (opzione B):
- l'app resta statica e funziona offline;
- solo il progresso viene salvato su Supabase, con accesso tramite email e password;
- ogni dispositivo unisce i dati tenendo la modifica più recente per ogni elemento;
- il backup manuale resta disponibile.

## Options Considered

### Opzione A: statica con dati sul dispositivo

| Dimensione | Valutazione |
|-----------|------------|
| Complessità | Bassa |
| Costo | Nessuno con repository pubblico |
| Scalabilità | Ampia per i contenuti; un dispositivo per il progresso |
| Familiarità | Non usa lo stack abituale dei progetti Lovable |

**Pro:** offline semplice, nessun account, nessun dato personale su server, niente da mantenere.
**Contro:** niente sincronizzazione; il progresso può perdersi se il browser cancella i dati e non c'è un backup.

### Opzione B: statica con sincronizzazione su Supabase (scelta)

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

Il rischio principale del progetto è la correttezza delle domande, non la tecnologia. Con due dispositivi, però, il backup manuale aggiungerebbe un passaggio a ogni cambio e potrebbe sovrascrivere il lavoro. La sincronizzazione toglie questo rischio e protegge anche dalla cancellazione dei dati da parte di Safari.

L'accesso con codice via email richiederebbe un server SMTP proprio per modificare il modello dell'email, quindi si usa la password, salvabile nel portachiavi. L'app non usa la libreria Supabase: chiama direttamente le sue API, così resta senza dipendenze esterne. Se l'app diventasse un prodotto, servirebbe rivedere account, pagamenti e diritti sui contenuti.

## Scostamenti dagli standard dei progetti Lovable

Questo non è un progetto Lovable, quindi non usa TanStack Start. Le scritture passano da funzioni Postgres con `auth.uid()`. Non ci sono limiti di rate propri perché il progetto ha un solo utente e le nuove registrazioni sono disattivate.

Sentry è stato escluso per non inviare dati oltre al progresso: gli errori restano in un registro locale, incluso nel backup. La conseguenza è che i guasti si scoprono solo se li segnala l'utente.

Restano validi: CI su ogni modifica, test della logica e nessuna credenziale nel codice. La ricerca automatica di segreti non è ancora nel CI.

## Consequences

- Più facile: lavorare sui contenuti e tenere l'app offline.
- Più facile: passare da iPhone a iPad.
- Più difficile: c'è un servizio esterno da configurare, e il progetto Supabase gratuito può andare in pausa dopo un periodo di inattività.
- Da rivedere: il limite di `localStorage` non è un problema con i volumi attuali, ma va ricontrollato con storico e contenuti più ampi.

## Quando rivedere

- La sincronizzazione crea problemi nell'uso reale.
- L'app deve essere offerta ad altri candidati.

## Action Items

1. [x] Scrivere la migrazione e il modulo di sincronizzazione.
2. [ ] Creare il progetto Supabase, eseguire la migrazione e collegarlo all'app.
3. [ ] Provare installazione, offline e sincronizzazione su iPhone e iPad veri.
4. [ ] Aggiungere la ricerca di segreti al CI.
5. [ ] Completare la verifica delle domande sulle fonti ufficiali.
