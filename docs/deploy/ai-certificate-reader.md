# AI certificate reader

A member picks a certificate image or PDF in "Add record" and presses **Fill from file**; DeepSeek reads it and the form is pre-filled. The member checks and saves. Design: `docs/superpowers/specs/2026-11-22-ai-certificate-reader-design.md` (decision #75).

**Do not turn this on for real people before WBS 1.8 is answered.** A certificate image always shows the holder's name and it cannot be masked, so the file goes to DeepSeek as it is. The Admin must first read DeepSeek's terms (where data is stored, for how long, whether it trains models) and record the answer in `docs/decisions.md`.

## Switch it on (production or preview)

1. `supabase db push` for `20261122000002_ai_usage.sql` (creates `ai_feature_flags` and `ai_usage`; the flag starts **off**, limit 10 calls per member per day) and `20261122000003_ai_feature_admin.sql` (the two admin functions behind the switch).
2. Vercel environment variables (server only, never `NEXT_PUBLIC_`):
   - `AI_TRANSPORT=deepseek`
   - `DEEPSEEK_API_KEY=<key>`
   - optional: `DEEPSEEK_MODEL` (default `deepseek-flash`), `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`), `AI_CONFIDENCE_THRESHOLD` (default `0.6`), `AI_PRICE_INPUT_PER_M` and `AI_PRICE_OUTPUT_PER_M` (USD per million tokens, for the logged cost estimate).
   - `AI_TRANSPORT` unset in production means the button stays hidden (`fake` is refused in production).
3. Sign in as an Admin and open **Settings > AI certificate reader**: turn the switch on, set the reads per member per day, press Save. The section also shows today's reads and whether the provider is configured. Members see the upload card at the top of Add record only while the switch is on and the provider is configured. SQL does the same and stays as a fallback:

```sql
update public.ai_feature_flags set enabled = true where feature = 'certificate-reader';
-- change the daily limit per member:
update public.ai_feature_flags set daily_limit = 20 where feature = 'certificate-reader';
-- switch it off again:
update public.ai_feature_flags set enabled = false where feature = 'certificate-reader';
```

## Check it

- **One real image, one real PDF, on a preview deploy first.** PDFs are turned into images by `unpdf` and `@napi-rs/canvas` (a native binary). It passed locally on Windows and `pnpm build` passes with `serverExternalPackages` in `next.config.ts`, but it was **not** tried on Vercel Hobby. If a PDF fails there with "That PDF could not be read.", images still work; either fix the bundle or make the route accept images only.
- **Token field names:** the gateway reads `usage.prompt_tokens` and `usage.completion_tokens`. The DeepSeek pages read on 2026-11-22 did not show the usage object. After the first real call, look at the row in `ai_usage`: if tokens and cost are `0`, the names are different.
- **JSON output with an image:** DeepSeek's pages do not say it works together with image input. If real calls end as `invalid_output`, that is the first thing to check.
- Usage and cost per day:

```sql
select day, count(*) as calls, sum(cost_micro_usd) / 1e6 as usd,
       count(*) filter (where outcome <> 'ok') as not_ok
from public.ai_usage group by day order by day desc;
```

## What is stored

Only the member code (a pseudonym), the day, the feature, token counts, an estimated cost and the outcome. No name, e-mail, file or prompt text.
