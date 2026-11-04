# Core multi-router

## Scope and integration

`models/Router.js` is lazy: requiring it does not connect or migrate. Every public
async operation awaits `initialize()`. `/api/routers` is mounted in `app.js`.
This change owns only the management/storage foundation. Customer, billing, sync,
cron, MikroTik services and frontend integration are outside its write scope;
parallel work in those files must be validated separately.

Service integration must await `Router.getClientConfig(customer.id_router)` and
pass the returned config explicitly to the appropriate MikroTik operation. Never
retry against another router on missing/disabled/unconfigured IDs. Customer
creation/update and username lookups must be router-aware before using duplicate
PPPoE usernames on different routers. New customers are deliberately not
auto-assigned by this migration after its first successful run.

## Model contract (Promises)

- `initialize()` ensures schema/migration readiness. Resolves with
  `{id_router_seed, jumlah_pelanggan_migrasi}` (historical migration values).
- `list({activeOnly = false} = {})` returns public DTOs ordered by ID.
- `getById(id, {includePassword = false} = {})` returns a public DTO. Explicit
  `includePassword: true` adds decrypted `password`, **internal server use only**.
- `getDefaultId()` returns the first remaining ID (including inactive/unconfigured
  records), or `null`. It never skips an inactive record for a different active one.
- `getClientConfig(id)` returns
  `{host, user, pass, port, id_router, nama_router}` for that exact active,
  configured record. Rejects invalid/missing IDs, disabled or incomplete records.
- `create(data)` / `update(id, data)` return public DTOs; `remove(id)` returns
  `{id_router}`. Deactivation is an ordinary `is_active: false` update and is
  allowed with customers. Deletion with any customers is forbidden.
- Expected failures have `statusCode`: 400 validation, 404 missing, 409 conflict,
  503 migration/key/database unavailability. Unexpected driver errors are not safe
  to log verbatim; they can contain SQL. Write/migration failures are sanitized by
  the model, and HTTP responses suppress unexpected exceptions.

Public DTO (no password, ciphertext, or key):

```text
{id_router, nama_router, lokasi, host, port, username, is_active,
 has_password, jumlah_pelanggan, configured}
```

`configured` means complete saved connection fields, not active or reachable.
`jumlah_pelanggan` counts all assigned customers, regardless of status.

Create fields: `nama_router`, `host`, `username`, `password` required and nonblank;
`lokasi` defaults to empty, `port` to 8728, `is_active` to true. Update is partial;
omitted or blank/whitespace-only passwords preserve the saved secret. A nonblank
password is kept exactly, including significant surrounding whitespace.
Limits: name/user 100, location 255, host 253, password 1024 characters. Host must
be an ASCII DNS hostname or IPv4/IPv6 literal, not URL/path/host:port. Port is an
integer (or decimal integer string) 1–65535; `is_active` must be a JSON boolean.
Unknown fields are rejected. Blank host/user cannot be explicitly saved via CRUD;
an incomplete legacy seed can be completed through a partial update.

## API

All routes require a verified token with an explicit `admin`/`superadmin` role
and admin ID; customer, unknown and missing-role claims are rejected even though
the shared middleware otherwise defaults missing roles to admin.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/routers?active_only=true` | admin / superadmin |
| POST | `/api/routers` | superadmin |
| PUT | `/api/routers/:id` | superadmin |
| DELETE | `/api/routers/:id` | superadmin |
| POST | `/api/routers/:id/test` | superadmin |

Responses use `{success: true, data: ...}`; create returns HTTP 201. Errors use
`{success: false, message}`. `active_only` accepts `true` or `false`. Test uses
only saved config (including an inactive router), lazily loads the service and
calls `ping(config, true)`. It returns `{id_router, online}` plus a generic offline
error, never raw service diagnostics or submitted credentials. Offline connectivity
is an HTTP 200 test result, not a migration/configuration error. The MikroTik
service must keep custom connectivity probes isolated from operational ping caches;
that service integration is outside this change's write scope.

## Migration and safety

Do not run until the parent/deployment owner approves. Back up the database and
coordinate the schema change with customer/service rollout. MySQL DDL takes
metadata locks and implicitly commits; an error may leave completed schema steps,
but initialization is retryable and does not mark an unsuccessful data migration.

```sh
node backend/scripts/migrateRouters.js
```

The CLI loads `backend/.env` quietly, creates its own one-connection MySQL pool,
initializes, prints only sanitized router names/IDs/counts and closes the pool.
It never imports `app`, `config/db`, services, cron or RouterOS. Connection settings
match the existing DB module (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`).

A dedicated connection holds MySQL `GET_LOCK` through all DDL/DML, preventing
concurrent processes from racing; concurrent calls in-process share readiness.
Failure rejects readiness and permits retry; sessions with uncertain lock release
are destroyed rather than returned to the pool.

Schema adds `router_mikrotik`, `router_migrations`, nullable unsigned
`pelanggan.id_router`, an InnoDB `ON DELETE/UPDATE RESTRICT` FK and unique index
`(id_router, pppoe_username)`. Every standalone unique index on `pppoe_username`
is removed by metadata discovery; unrelated indexes are retained. NULL router IDs
follow MySQL's unique-index NULL semantics, so unassigned customers are **not**
globally unique. Existing incompatible columns/FKs, orphan IDs, schema permission
failures or duplicate assigned usernames fail visibly rather than being discarded.

On first application, exactly one seed `Router Utama` is inserted (or a preexisting
record of that name reused). Values come directly from actual `pengaturan`
`MIKROTIK_HOST/PORT/USER/PASS` rows, then environment for absent/null values.
Saved empty settings are authoritative. Both `id_pengaturan` and legacy `kunci`
schemas are supported. No ConfigService/getAll fallback credentials are used.
Absent credentials produce an unconfigured seed; only the standard port defaults.
Existing customers with nonblank, non-`REG-` usernames and NULL router ID are
mapped, including currently offline customers. Existing assignments are retained.
Seed, mapping and durable marker commit together. The marker has no FK to the
seed: deleting it and restarting cannot reseed or map later customers.

## Encryption and deployment

Passwords use AES-256-GCM with random 96-bit nonces and authenticated versioned
ciphertext. Set optional `ROUTER_ENCRYPTION_KEY` to 32 random bytes encoded as
64 hex characters or padded base64. An explicitly empty/invalid key is an error.
Otherwise the first encryption atomically creates a random persistent
`backend/config/.router-encryption.key` (gitignored, outside `public`, mode 0600
where supported). Parallel processes publish a complete key and share the winner.
Decryption never generates a replacement key. Initialization checks an existing
encrypted record before allowing new encryption, catching missing/wrong keys.

Back up this key separately and securely with the database. All processes sharing
a database must share the same key (mount the file or provide the same environment
key). Persist the file across deployments; restrict its Windows ACL as appropriate.
Do not change encryption keys without explicitly re-encrypting stored passwords;
there is no automatic key rotation or plaintext fallback. Keys are cached for the
process lifetime, so key configuration changes require restarting processes.
Legacy `pengaturan` secrets are read but not deleted/rewritten by this change;
those preexisting values remain outside this model's encrypted storage. Retire them
only after confirming no legacy consumers remain in the integrated application.

## Tests (no live DB/router)

```sh
node --test backend/tests/routerManagement.test.js
```

Mocks cover migration/CRUD/auth and real built-in AES-GCM/key-file operations.
MySQL DDL, foreign-key concurrency and deployed privileges still require a
separately approved staging integration test; no live migration is run here.
