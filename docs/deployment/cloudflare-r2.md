# Storing uploaded files in Cloudflare R2

Every upload in JNLOps - correction attachments, production-reconciliation
evidence, employee profile photos - is saved through Django's file storage.

| Setting | Where files go |
|---|---|
| No `R2_*` variables (default, local development) | The `backend/media` folder on that machine |
| `R2_*` variables set | A **private** Cloudflare R2 bucket |

**Why this matters on Render:** the server's disk is wiped on every deploy and
restart, and Render does not serve `/media/` to browsers. Without R2 an upload
looks like it worked and is gone (or cannot be opened) shortly after.

Nothing in the bucket is ever public. The browser never talks to R2: it asks
the JNLOps API to download a file, the API checks the person's role, then
streams it from R2. So **no bucket CORS rule and no public URL is needed.**

---

## 1. Create the bucket (Cloudflare dashboard)

1. **R2 Object Storage -> Create bucket.** Name it e.g. `jnlops-files`, leave the
   location on Automatic.
2. Leave it **private**: do not enable *Public access* or the `r2.dev` URL.
3. Note your **Account ID** (R2 overview page, right-hand side).

## 2. Create an API token

1. **R2 Object Storage -> Manage API tokens -> Create API token.**
2. Permission: **Object Read & Write**.
3. Scope it to **this bucket only** (not "all buckets").
4. Create, then copy the **Access Key ID** and **Secret Access Key**.
   The secret is shown **once**. If you lose it, delete the token and make a new one.

> Ignore the "Token value" and the "jurisdiction-specific endpoint" shown on that
> screen; JNLOps needs only the two S3 keys and the Account ID.

## 3. Set the variables on Render

Render -> the backend service -> **Environment**:

| Variable | Value |
|---|---|
| `R2_ACCOUNT_ID` | your Cloudflare account id |
| `R2_ACCESS_KEY_ID` | the Access Key ID |
| `R2_SECRET_ACCESS_KEY` | the Secret Access Key |
| `R2_BUCKET_NAME` | `jnlops-files` (whatever you named it) |
| `R2_KEY_PREFIX` | `prod` (already in `render.yaml`; add it by hand if the service was not created from the blueprint) |

Save. Render redeploys and installs the new packages (`django-storages`, `boto3`).

Set **all four** or none. If only some are set the app refuses to start and the
deploy log says which one is missing - deliberately, so it can never quietly go
back to the disposable disk.

Optional: `R2_ENDPOINT_URL` (only for a bucket created with an EU jurisdiction,
`https://<account-id>.eu.r2.cloudflarestorage.com`) and `R2_SIGNED_URL_SECONDS`
(default 3600; only used for the employee photo link).

## 4. Prove it works

In the Render **Shell** for the backend service:

```
cd backend
python manage.py check_storage
```

Expected:

```
Storage : Cloudflare R2 (S3 API)
Bucket  : jnlops-files
...
OK - saved, read back and deleted a test file.
```

Then upload an attachment in the app and download it again. In the Cloudflare
dashboard the file appears under `prod/corrections/...` or `prod/reconciliation/...`.

If `check_storage` fails it names the cause:

| Message | Meaning / fix |
|---|---|
| `InvalidAccessKeyId` | Access Key ID is wrong - copy it again |
| `SignatureDoesNotMatch` | Secret is wrong, or has a stray space/newline |
| `AccessDenied` | Token lacks *Object Read & Write* or does not include this bucket |
| `NoSuchBucket` | Bucket name typo, or it is in a different account |
| `EndpointConnectionError` | Account ID wrong (or R2_ENDPOINT_URL), or no internet |

## 5. Local development (optional)

By default local development keeps using `backend/media`; nothing to do.

To test against R2 locally, put the same variables in `backend/.env`
(use a **separate bucket or `R2_KEY_PREFIX=dev`** so test files never mix with
real ones), rebuild once for the new packages, and check:

```
docker compose build backend
docker compose up -d
docker compose exec backend python manage.py check_storage
```

Automated tests never touch a real bucket, whatever is in `.env`.

## 6. Files uploaded before R2

Files that were saved on Render's disk before this change are **already gone**;
those attachments will show "not found" and need to be uploaded again.

Files that exist in a local `backend/media` folder (for example your own machine)
can be copied up, keeping the names the database already uses:

```
python manage.py migrate_media_to_storage --dry-run   # what would be copied
python manage.py migrate_media_to_storage             # copy
```

It is safe to re-run (files already in the bucket are skipped) and never deletes
anything locally.

## Security notes

- The **Secret Access Key is a password.** Never paste it in chat or an email,
  and never commit it: keep it only in Render's Environment tab and your local,
  git-ignored `backend/.env`.
- If a key is ever exposed, delete that token in Cloudflare and create a new one,
  then update Render. Nothing else needs to change; files stay in the bucket.
- Use a different token for production and for local testing.
- R2 has no recycle bin. Attachments removed in the app are only soft-deleted in
  the database, and their files are kept in the bucket.
