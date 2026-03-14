# Where to Put Your API Keys and Secrets

**Never put real secrets in `.env.example`** — it may be committed to git.

## Correct setup

1. **`.env`** — Put your real MongoDB URI, JWT secret, email passwords, Cloudinary keys here.
   - This file is in `.gitignore` and stays local.
   - The server loads it automatically via `require('dotenv').config()`.

2. **`.env.example`** — Template with placeholder values only.
   - Safe to commit to git.
   - Copy to `.env` and fill in your real values.

## If you don't have a .env file

```bash
copy .env.example .env
```

Then edit `.env` and replace the placeholders with your real values.
