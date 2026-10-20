# read-api

This group answers the browser. It serves topics, analysis, briefs and forecasts to every visitor, and
account features (saved items, notification settings, country follows, share links) to signed-in members. It also
takes browser error reports and holds a parked, key-gated signal API.

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsSensitiveData-dev | The site's public read proxy; one handler, many `action` values. The `-dev` name is production. | API Gateway REST API `NewsSensitiveProxyRestAPI`, path `/proxy` (GET, POST, OPTIONS) | NewsCache; SummarizeAndPredict; GlobalPerspectivePredictionLog; GlobalPerspectiveMarkets; UserTable `tier`; S3 `predictions/track_record.json`; Mapbox; DeepSeek | Nothing | [README](newsSensitiveData/README.md) |
| newsRecommend | Recommendations, notification preferences, country follows, breaking-alert feed, email unsubscribe. | Function URL (no schedule) | NewsCache `latest`; SavedItems; UserPrefs; BreakingAlerts; UserTable `tier` | UserPrefs | [README](newsRecommend/README.md) |
| newsSavedItems | Saves, unsaves and lists a member's bookmarks. | Function URL, or AppSync resolver | GlobalPerspectiveSavedItems | GlobalPerspectiveSavedItems | [README](newsSavedItems/README.md) |
| newsSharedAnalysis | Creates, serves and deletes unlisted Analysis Studio share links. | Function URL | GlobalPerspectiveShares; the public proxy above | GlobalPerspectiveShares | [README](newsSharedAnalysis/README.md) |
| newsClientErrors | Public sink that counts uncaught browser errors. | Function URL | Nothing | GlobalPerspectiveClientErrors | [README](newsClientErrors/README.md) |
| newsSignals | Parked signal API: builds one S3 document, serves it to API-key holders. | Function URL to serve; EventBridge `TriggerSignalsBuild`, 10:00 UTC, DISABLED | SummarizeAndPredict; PredictionLog; BreakingAlerts; GlobalPerspectiveApiKeys; S3 `signals/latest.json` | S3 `signals/latest.json`, `signals/snapshots/<date>.json`; rate-limit rows in ApiKeys | [README](newsSignals/README.md) |

## Pipeline

1. A page hook in the browser calls `restProxy.js` with an `action` and payload. The address comes from `docs/config.js`: `SENSITIVE_PROXY_ENDPOINT` for the proxy, and one Function URL each for saved items, preferences, share links and error reports.
2. The proxy URL is the API Gateway `/proxy` resource, which invokes newsSensitiveData-dev. It reads the Firebase token if sent; no token or a bad token means the free tier, never a refusal.
3. The handler fetches from DynamoDB (or the S3 track-record file) and returns JSON. Account calls go to their own Lambda, which checks the Firebase token first.
4. The map feature reads the S3 world store through the Cloudflare Worker `/data/*` route instead; that path does not touch this group.

Proxy actions and the feature that calls each (found by grep in `frontend/src`):
- Home and Today (`/today`): `topics`, `today`, `corrections_feed`, `economic_impact_list`.
- Thread pages (`/weekly/thread/:id`): `narrative_thread`, `thread_analysis`, `systems_analysis`, `web_index`, `summary`, `prediction`, `trace_cause`, `archive_range`.
- Country pages (`/weekly/country/:name`): `country_intelligence`, `country_facts`, `country_history`, `markets_country`.
- Briefings (`/briefings`): `daily_brief`, `latest_daily_brief`, `weekly_brief`, `prediction_snapshot`.
- Track record (`/track-record`): `prediction_track_record`.
- Economy (`/economy`, parked): `economic_impact`, `economic_top_movers`, `markets_global`, `markets_history`, `weekly_markets`.
- Map and Analysis Studio (`/analyze`) reuse `topics`, `archive_range`, `narrative_thread`, `summary`; `geocode` is called from shared frontend code.
- No frontend reference found: `country_preview`, `thread_preview`, `dossier_analysis`, `event_dossier`, `pair_analysis`, `pair_analyses_list`, `research_briefing`, `world_overview`, `rss` (GET).

Other Lambdas' actions: newsRecommend `get_prefs`, `set_prefs`, `follow_country`, `unfollow_country`, `list_alerts`, `get_alert`, `unsubscribe`; newsSavedItems `save_item`, `unsave_item`, `get_saved_items`.

## Shared code

- newsSensitiveData-dev: `links`, `llm`, `placeFilter`, `resolveIso3`. newsRecommend: `links`. newsSignals: `links`, `placeFilter`.
- newsSavedItems, newsSharedAnalysis and newsClientErrors use none. See the [shared README](../shared/README.md).

## Known limits

- newsSensitiveData-dev has no write path; the tier only caps depth, never gates access.
- CORS differs by Lambda. newsSharedAnalysis sends its own headers and its live Function-URL CORS is empty. newsClientErrors, newsRecommend and newsSavedItems rely on Function-URL CORS, which is populated live. newsSensitiveData-dev has no Function URL and sends its own headers.
- newsSignals has no page reading it and its build rule is DISABLED.
- `archive_range` returns light entries because of the 6 MB payload limit.

## How to check it

```
aws lambda get-function-url-config --function-name newsRecommend --region ap-northeast-1 --query 'Cors.AllowOrigins'
aws events list-rules --name-prefix TriggerSignalsBuild --region ap-northeast-1 --query 'Rules[].[Name,State]' --output text
aws apigateway get-resources --rest-api-id ba4q3fnwq6 --region ap-northeast-1 --query 'items[].path' --output text
```

Last verified: 2026-10-20 against code @14dd450d and live AWS.
