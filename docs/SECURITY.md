# WidowBlue Security Architecture (NIS2-aligned)

Owner admin: **giorgi.daniele96@gmail.com** (solo questa email ha ruolo `superadmin` / dashboard di controllo app).

Utenti normali: registrazione email + password → accesso app (chat, cronologia, progetti).

---

## 1. Principi NIS2 applicati

| Requisito NIS2 | Implementazione WidowBlue |
|----------------|---------------------------|
| Risk management | Threat model, spider alerts, rate limit, WAF |
| Incident handling | Log security events, alert superadmin, playbook |
| Business continuity | Backup 3-2-1, multi-region opzionale |
| Supply chain | Dipendenze pinned, SBOM, update automatici |
| Access control | RBAC, least privilege, MFA obbligatorio admin |
| Cryptography | TLS 1.3, at-rest encryption, E2E dove applicabile |

---

## 2. Autenticazione utenti

- **Registrazione**: email + password (min 12 caratteri, complessità).
- **Hash password**: Argon2id (preferito) o PBKDF2-SHA256 con:
  - **Salt** unico per utente (random 16–32 byte)
  - **Pepper** lato server (secret in Cloudflare Secrets / AWS Secrets Manager, mai nel client)
- **Sessione**: token opaco httpOnly + Secure + SameSite=Strict, TTL breve + refresh rotante.
- **MFA**: TOTP compatibile **Google Authenticator** e **Microsoft Authenticator** (RFC 6238). Obbligatorio per admin; consigliato per tutti.
- **Login**: email + password + (MFA se abilitato).

> Il frontend attuale mostra il flusso UI; in produzione le password **non** restano nel browser in chiaro e l’hash avviene solo sul backend.

---

## 3. Superadmin dashboard

- Email autorizzata: `giorgi.daniele96@gmail.com`
- Ruolo `superadmin`: modifica configurazione app, sicurezza, chiavi temporanee admin, spider alerts, audit log.
- Accesso dashboard **solo** dopo login + MFA + (opzionale) chiave alfanumerica temporizzata.

---

## 4. Chiavi alfanumeriche temporizzate

- Formato: 16–32 caratteri `[A-Za-z0-9]` generati con CSPRNG.
- Validità: **30–120 secondi** (configurabile; default 60s).
- Uso: elevazione privilegi admin, operazioni critiche (deploy, revoke sessioni, export dati).
- One-time o limited-use; invalidate subito dopo uso o scadenza.
- Distribuzione: canale fuori banda (app authenticator / email sicura / hardware key).
- Stesso meccanismo per **chiavi temporanee ad altri amministratori** (TTL e scope limitati).

---

## 5. Spider Control & Spider Alert

Monitoraggio punti vulnerabili:

- Ricerca web / crawler abusivi
- Tentativi brute-force login
- Rate anomaly su API
- Path traversal / injection pattern
- Scraping massivo
- Accessi da IP/ASN sospetti

**Spider Control**: rate limit, CAPTCHA progressivo, blocklist temporanea, challenge WAF (Cloudflare).

**Spider Alert**: evento → log immutabile + notifica superadmin (email/webhook) + UI badge in dashboard.

---

## 6. End-to-end e cifratura

- Transito: TLS 1.3 ovunque (Cloudflare / AWS ALB).
- A riposo: encryption DB e object storage (R2/S3 KMS).
- Contenuti chat sensibili (fase 2): E2E con chiavi derivate lato client (non leggibili dal server in chiaro).
- Secrets: mai in git; solo Secrets Manager / CF Secrets.

---

## 7. Infrastruttura cloud

- **Cloudflare**: WAF, DDoS, Workers, Access (Zero Trust), R2, D1/KV.
- **AWS** (opzionale/ibrido): S3 backup, KMS, CloudTrail, GuardDuty, IAM least privilege.
- Aggiornamenti: CI che pinna versioni, scan CVE (Dependabot/Snyk), patch window documentata.

---

## 8. Backup regola 3-2-1

1. **3** copie dei dati di sistema critici  
2. **2** supporti/tipi diversi (es. DB snapshot + object storage)  
3. **1** copia off-site / altro account o regione  

Test di restore periodici; retention e encryption delle copie.

---

## 9. Contro rainbow tables

- Salt per-utente (random)
- Pepper server-side
- Algoritmo lento (Argon2id)
- Nessun MD5/SHA1 per password

---

## 10. Misure aggiuntive consigliate (super protetta)

1. **WebAuthn / Passkeys** oltre a TOTP  
2. **Device binding** e anomaly detection login  
3. **CSP + Trusted Types** strict sul frontend  
4. **Subresource Integrity** su asset  
5. **Sandbox** esecuzione codice agenti (no shell host)  
6. **Audit log append-only** (hash chain)  
7. **Break-glass** account con procedura umana  
8. **Red team** periodico e bug bounty interno  
9. **Data classification** (pubblico / interno / riservato)  
10. **Kill switch** superadmin per disabilitare ricerca o API  
11. **IP allowlist** opzionale per dashboard admin  
12. **HSM / KMS** per master keys  

---

## 11. Roadmap implementazione sicurezza

| Fase | Deliverable |
|------|-------------|
| UI (ora) | Login/registrazione, menu ⋮ cronologia, gate dashboard admin email |
| Backend auth | Workers + D1, Argon2id/PBKDF2+pepper, sessioni |
| MFA | TOTP Google/Microsoft Authenticator |
| Timed keys | Generazione e validazione OTP admin |
| Spider | Rate limit + alert log |
| Backup 3-2-1 | Snapshot automatici + off-site |
| NIS2 ops | Policy incidenti, registro, drill |

---

## 12. Nota onesta

Fino a quando auth non è sul backend con pepper e MFA, **non** considerare il sistema “super protetto” in produzione. La UI e questo documento definiscono il target; le password reali vanno solo su API sicura.
