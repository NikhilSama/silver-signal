PRODUCT REQUIREMENTS DOCUMENT

**COMEX Silver**

**Early Signal Monitoring System**

Version 1.1 | February 2026

Turgon, Inc.

Next.js • Vercel • Vercel Postgres • Anthropic SDK

_This document contains NO CODE. It provides specifications, data source details, signal logic, UI descriptions, and historical storage requirements sufficient for autonomous implementation by a coding agent (e.g., Claude Code)._

_The implementing agent should read this document end-to-end before writing any code._

**SECTION 1 - PRODUCT OVERVIEW**

# **1.1 Purpose**

Build a real-time monitoring dashboard that tracks 12 key indicators in the COMEX silver futures market. The system detects early signals of paper slams (engineered price drops via leveraged short selling and margin hikes) and physical squeezes (delivery demand exceeding registered vault stocks). It presents a traffic-light dashboard (red/yellow/green per indicator) with an overall market posture recommendation (Buy / Sell / Caution / Neutral).

# **1.2 Background**

Silver trades in two parallel worlds: paper (futures contracts on COMEX) and physical (metal in vaults). When too many contract holders demand delivery but registered vault stocks are insufficient, a squeeze occurs. When banks with large short positions coordinate margin hikes during thin liquidity, a paper slam drives prices down. The recent market has seen historic volatility - silver surged past \$120/oz before crashing 33% after CME raised margins from 11% to 15%. Registered inventory dropped to 28% of total. This system automates the monitoring framework experienced traders use to anticipate these moves 1-3 days in advance.

# **1.3 Target User**

Single user (founder/CEO of Turgon) who holds silver positions and wants to monitor signals daily without checking 6+ websites. Private deployment, not multi-tenant. No authentication required.

# **1.4 Tech Stack**

- **Framework:** Next.js 14+ with App Router, deployed on Vercel.
- **Database:** Vercel Postgres (PostgreSQL). This is critical - every data pull must be stored with timestamps so the system builds its own historical dataset for trend analysis, even though most sources only provide current-day snapshots. See Section 3 for schema details.
- **Scheduling:** Vercel Cron Jobs to trigger data ingestion API routes on schedule.
- **LLM:** @anthropic-ai/sdk (Claude Sonnet) for daily natural-language briefings. The LLM receives the full historical dataset (not just current values) so it can narrate trends.
- **Parsing:** cheerio for HTML scraping, csv-parse for CSV, xlsx/SheetJS for Excel files, pdf-parse for PDFs. All native Node.js - no Python.
- **Frontend:** React with Tailwind CSS. Minimal dependencies.
- **Secrets:** All API keys and DB connection strings in Vercel environment variables.

# **1.5 Guiding Principles**

- **No fake data, ever.** If a source is unreachable, the dashboard shows an explicit error state for that indicator - never stale data presented as current, never placeholders, never interpolated values. See Section 5 for mandatory error state specifications.
- **Store everything, always.** Every successful data pull is stored in Postgres with a timestamp. Even for sources that only provide current-day values, the system archives every pull so that within weeks of launch it has its own trend history. This enables week-over-week comparisons, trend arrows, and the LLM's ability to narrate changes over time.
- **Phase-by-phase delivery.** Built in 4 phases, each delivering a testable increment. Do NOT proceed to the next phase until the current one works end-to-end. Run the app and verify data flows from source to database to UI.
- **No code in this PRD.** This document provides natural-language specifications only. The implementing agent writes all code autonomously from these descriptions.
- **LLM gets full context.** When generating daily briefings, the LLM receives not just current values but the historical time series for each indicator (last 30-90 days), so it can identify trends, inflection points, and rate-of-change signals that single-day snapshots miss.

**SECTION 2 - THE 12 INDICATORS**

Each indicator below is defined with: what it measures, why it predicts price moves, traffic-light scoring logic, data source details, update frequency, and historical data availability. These definitions serve double duty - they are also the content displayed in the dashboard's mouseover tooltips (see Section 5).

# **Indicator 1: Open Interest (OI)**

**What It Measures**

Total active (unsettled) futures contracts for silver on COMEX, reported daily after market close. Key symbol SI (5,000 oz per contract). The front-month contract approaching delivery is the focus.

**Why It Predicts Price Moves**

OI reveals conviction. Sharp OI drop during a price crash = long liquidation (slam worked). OI stabilizing/rebuilding = fresh buying returning. OI rising into delivery month while registered stocks are low = squeeze fuel - more contracts than metal.

**Traffic-Light Scoring**

| **GREEN** | OI stable or rising week-over-week with price stable/rising. |
| --- | --- |
| **YELLOW** | OI dropping 5-10% week-over-week, or diverging from price. |
| **RED** | OI drops >10% in a week with no news catalyst, especially near FND. Forced liquidation. |

**Data Source**

CME daily volume/OI report at cmegroup.com, downloadable file overwritten daily. Current day only - must archive daily to build history.

**Update Frequency**

Daily, after 6 PM ET.

**Historical Data Availability**

Free: current day only. Must self-accumulate. Paid: CME DataMine (40+ yrs), Barchart OnDemand.

# **Indicator 2: Registered vs Eligible Vault Inventory**

**What It Measures**

COMEX warehouses hold silver in two categories: Registered (has delivery warrant, can settle futures) and Eligible (in vault, meets standards, but owner has not consented to delivery). Key metrics: registered-to-total ratio and daily change in registered ounces.

**Why It Predicts Price Moves**

Single best squeeze indicator. The registered-eligible gap IS the paper-physical disconnect. Registered draining means less metal available to settle contracts. When registered falls below notional value of outstanding contracts, delivery default becomes theoretically possible.

**Traffic-Light Scoring**

| **GREEN** | Registered >40% of total, or stable/increasing week-over-week. |
| --- | --- |
| **YELLOW** | Registered 25-40%, or declining 1-5M oz per week. |
| **RED** | Registered &lt;25%, or drawdowns &gt;5M oz/week, or registered ounces below delivery-month OI in ounces. |

**Data Source**

CME Silver Stocks report (Silver_stocks.xls) - daily after market close. Single-sheet Excel: each depository row with Registered/Eligible columns, grand total at bottom. Overwritten daily.

**Update Frequency**

Daily, after 5:30 PM ET.

**Historical Data Availability**

Free: current day only. Must archive each pull. Third-party trackers have charts but no API.

# **Indicator 3: Issues & Stops (Delivery Activity)**

**What It Measures**

During active delivery months, CME publishes daily delivery notices. Issues = warrants issued by shorts offering metal. Stops = warrants received by longs taking delivery. Also tracks clearing member concentration (who is issuing/stopping and what percentage).

**Why It Predicts Price Moves**

High stops relative to registered stocks = genuine physical demand. If one clearing member issues 90%+ of deliveries, that concentration reveals which institutions supply or drain metal. Accelerating delivery pace confirms the squeeze is real.

**Traffic-Light Scoring**

| **GREEN** | Stops below 5% of registered stocks per week. Normal delivery. |
| --- | --- |
| **YELLOW** | Stops at 5-15% of registered per week. Above-average demand. |
| **RED** | Stops >15% of registered per week, or cumulative monthly deliveries approaching 50%+ of registered, or single clearing member concentration >80%. |

**Data Source**

CME delivery reports page. Published daily during delivery months only.

**Update Frequency**

Daily during delivery months (Mar, May, Jul, Sep, Dec). Show 'Not in delivery month' during off-months - this is expected, not an error.

**Historical Data Availability**

Free: current delivery month. Historical: CME DataMine (paid).

# **Indicator 4: COT - Speculator (Non-Commercial) Net Position**

**What It Measures**

CFTC Commitments of Traders report, non-commercial category (hedge funds, CTAs, managed money). Key metric: net position = longs minus shorts. Silver CFTC commodity code: 084691.

**Why It Predicts Price Moves**

Shows sentiment and vulnerability. Net longs at historic highs = crowded trade, slam-vulnerable (margin hike triggers stop-loss cascade). If net longs collapse before FND, slam succeeded. If they hold or rebuild, slam failed.

**Traffic-Light Scoring**

| **GREEN** | Net long between 20th-60th percentile of its 3-year range. |
| --- | --- |
| **YELLOW** | Net long above 60th percentile (crowded) or below 20th (washed out). |
| **RED** | Net long above 80th percentile (extremely crowded), or drops >20% week-over-week (forced liquidation). |

**Data Source**

CFTC public API at publicreporting.cftc.gov (SODA API, JSON format). No API key required. Filter: commodity_name='SILVER', market contains 'COMMODITY EXCHANGE'. Key fields: report_date, noncommercial_positions_long_all, noncommercial_positions_short_all. Full history to 1986.

**Update Frequency**

Weekly, Fridays at 3:30 PM ET (data from prior Tuesday, 3-day lag).

**Historical Data Availability**

FREE: complete history to January 1986. Best-sourced indicator on the list.

# **Indicator 5: COT - Commercial (Bank) Short Position**

**What It Measures**

Same COT report, commercial category (banks, producers, merchants). Key metric: total commercial short contracts. Supplementary: CFTC Bank Participation Report (monthly) isolates U.S. and non-U.S. bank positions specifically.

**Why It Predicts Price Moves**

Massive commercial short book is ammunition for a paper slam - banks profit from price drops. When shorts are at historic highs, motivation to engineer a drop peaks. When they start covering (reducing), slam thesis weakens.

**Traffic-Light Scoring**

| **GREEN** | Commercial net short below 60th percentile of 3-year range. |
| --- | --- |
| **YELLOW** | Between 60th-80th percentile. Elevated but not extreme. |
| **RED** | Above 80th percentile (historically precedes coordinated drops), or shorts increase >10,000 contracts week-over-week. |

**Data Source**

Same CFTC API as indicator #4. Bank Participation Report: monthly at cftc.gov, fixed-format text file requiring custom parsing.

**Update Frequency**

COT: Weekly (Fridays). Bank Participation: Monthly (1st business day).

**Historical Data Availability**

COT: free, full history to 1986. Bank Participation: current + recent months, no API.

# **Indicator 6: Margin Requirements**

**What It Measures**

CME-set initial and maintenance margin for silver futures. Now expressed as percentage of contract value (changed from dollar amounts January 2026). Key: current initial margin % and any recent changes. Hikes announced via CME Clearing Advisory PDF notices.

**Why It Predicts Price Moves**

Margin hikes are a weapon. Higher margins force leveraged longs to deposit more cash or liquidate - mechanical selling unrelated to fundamentals. The recent 11% to 15% hike (36% increase) triggered the largest single-day silver drop on record. Monitoring provides 24-48 hours of lead time.

**Traffic-Light Scoring**

| **GREEN** | Margins stable for 30+ days. No recent changes. |
| --- | --- |
| **YELLOW** | One margin change in past 14 days, or level above historical median. |
| **RED** | Two or more hikes within 14 days (escalating pressure), or single hike exceeding 25% relative increase. |

**Data Source**

Current margin: CME silver margins webpage (scrape). Historical (5 years): CME historical margins page (CSV download). Change advisories: CME Notices page (searchable archive of PDF notices).

**Update Frequency**

Event-driven. Check margins page and Notices page daily.

**Historical Data Availability**

Free: current (scrape) + 5 years CSV. Advisories archived on CME.

# **Indicator 7: Backwardation / Contango Spread**

**What It Measures**

Price difference between silver spot and front-month futures. Contango (normal) = futures > spot (includes storage/insurance costs). Backwardation (unusual) = spot > futures. Key metric: dollar spread = spot minus front-month futures.

**Why It Predicts Price Moves**

Sustained backwardation is the clearest physical shortage signal. Market pays more for silver NOW than for a future promise. Normal contango is \$0.10-0.50. Current \$2.88 backwardation is the largest since 1980 (Hunt Brothers era).

**Traffic-Light Scoring**

| **GREEN** | Contango of \$0.10-\$0.50. Normal cost of carry. |
| --- | --- |
| **YELLOW** | Near zero (flat) or mild backwardation up to -\$0.50. |
| **RED** | Backwardation exceeding -\$0.50. Beyond -\$2.00 is historically extreme. |

**Data Source**

Computed from two inputs: (A) Silver spot price - free APIs like GoldAPI.io (100 req/month free tier), MetalpriceAPI, or Metals-API. (B) Front-month futures - Barchart OnDemand (paid), or scrape Kitco futures page, or CME daily settlement prices.

**Update Frequency**

Daily after settlement. Can be intraday with real-time spot feeds.

**Historical Data Availability**

Spot: free APIs have multi-year history. Futures: self-accumulate or paid Barchart. Spread is computed, history builds automatically.

# **Indicator 8: Contract Roll Patterns**

**What It Measures**

How OI migrates between contract months as delivery approaches. Normal = forward roll (OI moves from near month to next). Unusual = backward roll (longs move INTO nearer months, accelerating delivery intent).

**Why It Predicts Price Moves**

Forward rolls are standard. Backward rolls are bullish and unusual - traders want delivery sooner. Pattern seen Jan 7-11 when longs rolled backward into Feb from Mar. If continuing, March delivery queue stays large despite crash.

**Traffic-Light Scoring**

| **GREEN** | Normal forward roll. Expiring month OI declining, next month increasing. |
| --- | --- |
| **YELLOW** | Roll pace slower than typical. Longs holding into delivery month. |
| **RED** | Backward rolls detected, or >20% of expiring-month OI held within 5 days of FND. |

**Data Source**

CME per-month OI from daily volume report (same source as #1, broken down by expiry month).

**Update Frequency**

Daily. Most informative 30 days before FND.

**Historical Data Availability**

Free: current day only. Must self-accumulate for roll pattern history.

# **Indicator 9: Silver Lease Rates**

**What It Measures**

Annualized cost of borrowing physical silver. Normal: near zero (0.1-0.5%). During scarcity: can spike to double/triple digits. Recently spiked to ~200% annualized.

**Why It Predicts Price Moves**

Most direct scarcity measure. Spike means nobody lends metal - holders hoarding for delivery obligations or value appreciation.

**Traffic-Light Scoring**

| **GREEN** | Below 2% annualized. Normal lending conditions. |
| --- | --- |
| **YELLOW** | Between 2-10%. Elevated, worth monitoring. |
| **RED** | Above 10%. Acute scarcity. Above 50% = crisis-level. |

**Data Source**

HARDEST INDICATOR. No free public API. Bloomberg Terminal (~\$24K/yr) or StoneX subscription. SilverSeek.com has visual chart (scrapable but unreliable). RECOMMENDED FREE PROXY: Compute implied lease rate from backwardation spread (#7) using formula: (backwardation / spot) x (365 / days_to_expiry) x 100. This approximation captures the same signal.

**Update Frequency**

Daily via proxy whenever #7 updates.

**Historical Data Availability**

No free historical source. Proxy auto-builds history as backwardation is stored.

# **Indicator 10: Shanghai / Dubai Spot Premium**

**What It Measures**

Price difference between silver on Shanghai Gold Exchange (SGE, Ag(T+D) contract, quoted CNY/gram) and COMEX spot (USD/oz). Requires CNY-to-USD conversion. Key metric: percentage premium = ((SGE_price_in_USD - COMEX_spot) / COMEX_spot) x 100.

**Why It Predicts Price Moves**

Persistent Asian premium means physical metal flowing East because Western paper prices are below Asian willingness to pay. If arbitrage could close the gap it would - persistent premium = genuine supply tightness. 10%+ premium confirms squeeze is real, not paper noise.

**Traffic-Light Scoring**

| **GREEN** | Premium below 2%. Normal transaction/shipping costs. |
| --- | --- |
| **YELLOW** | Premium 2-5%. Elevated Asian demand. |
| **RED** | Premium above 5%. Significant tightness. Above 10% = structural paper-physical disconnect. |

**Data Source**

SGE Silver Benchmark page at en.sge.com.cn. GoldSilverAI.com tracks premium historically (charts only). CNY/USD conversion from any free forex API. COMEX spot from indicator #7 sources.

**Update Frequency**

Daily. SGE publishes during Asian hours (~1:30 AM - 7:00 AM ET).

**Historical Data Availability**

Free: current on SGE website. Must self-accumulate. GoldSilverAI has charts but no API.

# **Indicator 11: FND Proximity & Delivery Pressure Ratio**

**What It Measures**

Derived indicator combining: (A) Days to next First Notice Day. (B) Delivery-month OI. (C) Registered stocks in ounces. Key metric: Delivery Pressure Ratio = (delivery_month_OI x 5,000) / registered_ounces. Shows theoretical delivery claims vs available metal.

**Why It Predicts Price Moves**

The convergence indicator. Ratio above 1.0 = more claims than metal. Higher ratio closer to FND = greater delivery stress. Even 0.5-0.8 causes stress since not all registered holders will deliver.

**Traffic-Light Scoring**

| **GREEN** | Ratio below 0.3, or >30 days to FND. |
| --- | --- |
| **YELLOW** | Ratio 0.3-0.7, or 10-30 days to FND with ratio above 0.3. |
| **RED** | Ratio above 0.7 with <10 days to FND. Or ratio above 1.0 at any time. Highest-priority signal. |

**Data Source**

DERIVED - no separate source. Combines #1 (per-month OI), #2 (registered stocks), and CME expiration calendar. FND dates are static - hardcode for next 12 months from CME calendar, update annually.

**Update Frequency**

Daily, recomputed whenever OI or registered stocks update.

**Historical Data Availability**

Fully derived from stored data. History builds automatically.

# **Indicator 12: CME CVOL (Volatility Index)**

**What It Measures**

CME's 30-day implied volatility index for silver options. Uses simple variance methodology across the full implied vol curve. Includes UpVar/DnVar (directional fear), Skew, and Convexity.

**Why It Predicts Price Moves**

Elevated CVOL = market pricing big moves ahead. A spike BEFORE a price drop signals institutional slam positioning. Skew (DnVar > UpVar) = market fears further drops specifically.

**Traffic-Light Scoring**

| **GREEN** | Below 30-day moving average AND below 1-year median. |
| --- | --- |
| **YELLOW** | Above 30-day average but below 1-year 80th percentile. |
| **RED** | Above 1-year 80th percentile, or spikes 30%+ in a single day. |

**Data Source**

CME CVOL EOD REST API (requires license). FREE PROXY: Track daily price range (high - low) as % of close. Range >5% = elevated; >10% = extreme. Rough but captures the same signal. Use daily OHLC from free spot APIs.

**Update Frequency**

Daily (EOD). Proxy uses daily OHLC from free spot APIs.

**Historical Data Availability**

CME API: requires license. Proxy: self-accumulate from daily OHLC data.

**SECTION 3 - HISTORICAL DATA STORAGE ARCHITECTURE**

This section is critical. Most of the 12 data sources only provide current-day values (CME overwrites its files daily). The system MUST store every successful data pull in a time-series database so that within weeks of launch, it has enough history to compute trends, week-over-week changes, percentile rankings, and trend arrows. The LLM also queries this history to narrate changes over time.

# **3.1 Primary Table: indicator_snapshots**

This is the core data table. One new row is INSERTED (never updated) for each indicator on each successful data pull. Over time, this creates a complete time-series history.

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| id  | bigint auto-increment | Primary key. |
| indicator_id | integer (1-12) | Which indicator this row represents. |
| fetched_at | timestamptz | When the system pulled this data. Always stored in UTC. |
| data_date | date | The business date this data represents. Important: for weekly COT data, this is the Tuesday the data was measured, not the Friday it was released. |
| raw_value | jsonb | Complete raw parsed payload from the source. Stored for auditability and reprocessing if scoring logic changes later. |
| computed_value | numeric | The single key metric used for signal scoring (e.g., OI count, registered ounces, net long contracts, spread in dollars, ratio, percentage). This is what trend arrows and the LLM compare across time. |
| signal | text | Enum: green, yellow, red, error. Traffic-light result from the scoring engine. |
| signal_reason | text | Human-readable explanation of why this signal was assigned. This text populates the NOW section of the dashboard tooltip. Should include specific numbers and comparisons. |
| source_url | text | Exact URL fetched, for debugging. |
| fetch_status | text | Enum: success, error, timeout, parse_error. If not success, signal must be error. |
| error_detail | text nullable | Error message if fetch failed. |

Indexes: Create indexes on (indicator_id, data_date) and (indicator_id, fetched_at DESC) for fast queries. The dashboard queries the latest row per indicator. The LLM queries the last 90 days per indicator.

# **3.2 How History Enables Trend Analysis**

After even 5 days of operation, the system can compute day-over-day changes. After 2-3 weeks, it can identify meaningful trends. After 90 days, it can compute percentile rankings. Here is how stored history is used:

- **Trend arrows on dashboard:** Compare today's computed_value to the most recent prior row for the same indicator. If higher and directionally bullish, show green up-arrow. If higher and directionally bearish (e.g., commercial shorts increasing), show red up-arrow. If lower, reverse. If unchanged, gray flat.
- **Week-over-week change:** Query the row from ~7 days ago for the same indicator. Compute percentage change. Display on the indicator card and include in the LLM prompt.
- **Percentile ranking:** For indicators #4 and #5 (COT), the signal logic uses percentiles of the 3-year range. On initial deployment, backfill 3 years from the CFTC API (which has full history). For other indicators, use absolute thresholds until 90+ days of self-accumulated data exist, then transition to percentile-based thresholds.
- **LLM trend narration:** The daily briefing prompt includes the last 30-90 days of computed_value history for each indicator. The LLM can then say things like 'Registered stocks have declined for 12 consecutive trading days, losing 18M oz - the longest drawdown streak since November 2025' rather than just 'Registered stocks are at 106M oz.'
- **Rate-of-change signals:** Some scoring thresholds reference rate of change (e.g., 'OI drops >10% in a week'). These require at least 5 days of stored history to compute. Before sufficient history exists, the system should use absolute-value thresholds only and note 'Insufficient history for trend-based scoring' in the signal_reason.

# **3.3 Supporting Tables**

## **indicator_metadata**

Static reference table seeded once with all 12 indicators. Columns: indicator_id, name, short_description (for card header), full_description (WHAT tooltip text from Section 2), why_it_works (WHY tooltip text from Section 2), green_criteria, yellow_criteria, red_criteria, update_frequency, source_name. This table is read-only after initial seed.

## **daily_briefings**

One row per day, storing the LLM-generated briefing. Columns: id, briefing_date, overall_posture (BUY/SELL/CAUTION/NEUTRAL), posture_reason (one sentence), briefing_text (3-5 paragraphs), indicator_summary (JSONB snapshot of all 12 signals at generation time), generated_at.

## **key_dates**

Market-critical dates. Columns: id, event_date, event_name, event_type (FND / COT_RELEASE / CONTRACT_EXPIRY / HOLIDAY_WINDOW / OTHER), description, active (boolean, auto-deactivate past events). Seed with silver FND and expiry dates for all delivery months (Mar, May, Jul, Sep, Dec) for the next 12 months from the CME calendar. Include weekly COT release dates (every Friday) and known holiday windows (Chinese New Year, US holidays).

# **3.4 Cron Schedule**

Each data source gets its own Vercel Cron Job to avoid timeouts and ensure one source's failure doesn't block others. All defined in vercel.json.

| **Cron Job** | **Schedule** | **Indicators** | **Max Duration** |
| --- | --- | --- | --- |
| fetch-cme-daily | Weekdays 11 PM UTC (6 PM ET) | #1 OI, #2 Vault Stocks, #3 Deliveries, #8 Rolls | 60s |
| fetch-cme-margins | Daily 6 PM UTC (1 PM ET) | #6 Margins | 30s |
| fetch-cftc-cot | Fridays 8 PM UTC (3:30 PM ET) | #4 Speculators, #5 Commercials | 60s |
| fetch-spot-prices | Every 4 hours | #7 Backwardation (spot + futures) | 30s |
| fetch-shanghai | Weekdays 12 PM UTC (7 AM ET) | #10 Shanghai Premium | 30s |
| compute-derived | Weekdays 11:30 PM UTC (after CME data) | #9 Lease Proxy, #11 FND Ratio, #12 CVOL Proxy | 30s |
| generate-briefing | Weekdays midnight UTC (7 PM ET) | LLM daily briefing | 120s |

# **3.5 Data Fetching Pattern**

Every fetcher API route follows the same pattern: (1) Fetch the source URL with a 15-second timeout and realistic User-Agent header. (2) Parse the response using the appropriate library (SheetJS for XLS, cheerio for HTML, csv-parse for CSV). (3) Validate that parsed data makes sense - numeric ranges plausible, dates current, required fields present. If validation fails, store the row with fetch_status = parse_error and a descriptive error_detail. (4) Run the signal scoring logic from Section 2 against the parsed computed_value, producing a signal enum and signal_reason string. (5) INSERT a new row into indicator_snapshots. Never UPDATE existing rows - this is an immutable append-only audit trail. (6) On any failure at any step, store the row with the appropriate error status. The dashboard renders this error state transparently.

# **3.6 CFTC COT API Details**

The CFTC Public Reporting Environment API is the most important data source - it is the only one with a free, well-documented API and full historical data. Base URL: publicreporting.cftc.gov/resource/6dca-aqww.json (SODA/Socrata API). Filter for silver using query parameters: commodity_name = 'SILVER' and market_and_exchange_names contains 'COMMODITY EXCHANGE'. Key response fields: report_date_as_yyyy_mm_dd, open_interest_all, noncommercial_positions_long_all, noncommercial_positions_short_all, commercial_positions_long_all, commercial_positions_short_all. Computed metrics: speculator net = noncommercial_long minus noncommercial_short; commercial net short = commercial_short minus commercial_long. Pagination: use \$limit and \$offset parameters. Default limit is 1000 rows. No API key required. On first deployment, backfill 3 years of history by paginating through the full dataset.

# **3.7 Error State Philosophy**

- **Never display stale data as current.** Every data point on the dashboard shows its data_date. If older than 2x the expected update frequency, show an orange STALE warning badge.
- **Never fabricate or interpolate.** Failed fetch = DATA UNAVAILABLE with error reason. Show last known value separately with a 'Last successful: \[date\]' label if prior data exists.
- **Distinguish states clearly.** 'Awaiting first data pull' (fresh deployment, no data yet) vs 'Fetch failed: \[specific error\]' (attempted and failed) vs 'Not applicable' (e.g., delivery data outside delivery month).
- **Log everything.** Every fetch attempt (success or failure) gets a row in the database. This is the reliability audit trail.

**SECTION 4 - SIGNAL SCORING & OVERALL POSTURE**

# **4.1 Per-Indicator Scoring**

Each indicator is scored independently using the green/yellow/red thresholds from Section 2. The score is computed every time new data arrives. The scoring function takes the latest computed_value, any necessary context (historical percentiles, days to FND, prior values from stored history), and returns a signal enum plus a human-readable signal_reason that explains the current reading with specific numbers.

For percentile-based indicators (#4 and #5), compute percentiles against stored history. On initial deployment, backfill 3 years of COT history from the CFTC API. For other indicators, use absolute thresholds until 90+ days of self-accumulated data exist, then transition to percentile-based scoring. The signal_reason should note when insufficient history limits the scoring precision.

# **4.2 Overall Market Posture**

The posture is a synthesis of all 12 individual signals into one of four states:

| **Posture** | **Criteria** | **Display** |
| --- | --- | --- |
| BUY | 7+ indicators green, zero red, FND Ratio (#11) not red, backwardation (#7) not extreme. | Green banner: 'MARKET POSTURE: BULLISH - Favorable conditions for long entry.' |
| SELL / EXIT | 4+ indicators red, OR margin hike in last 48h (#6 red), OR CVOL + commercial shorts both red. | Red banner: 'MARKET POSTURE: BEARISH - Elevated slam risk. Consider reducing exposure.' |
| CAUTION | 3+ indicators yellow/red but <4 red. Mixed signals: bullish physical vs bearish paper. | Amber banner: 'MARKET POSTURE: CAUTION - Mixed signals. Key conflict: \[describe\].' |
| NEUTRAL | Default. <7 green and <4 red. No extreme readings. | Gray banner: 'MARKET POSTURE: NEUTRAL - No strong directional signal.' |

# **4.3 Override Rules**

Certain indicators have veto power regardless of aggregate counts:

- **FND Ratio (#11) at RED:** Overrides to at least CAUTION. Delivery stress is dominant.
- **Margin Hike 48h (#6) at RED:** Overrides to at least CAUTION. Mechanical selling pressure incoming.
- **Insufficient Data:** If 4+ indicators are in error/unavailable state, posture = INSUFFICIENT DATA (distinct gray state). Never compute a confident posture from partial data.
- **Stale Data:** Any indicator with a STALE badge is excluded from the posture calculation. The posture should note how many indicators contributed.

# **4.4 Pre-Slam Risk Checklist**

A separate UI panel (not replacing traffic lights) that tracks 5 conditions historically preceding paper slams. Display as a horizontal row of 5 small indicators (filled circle = active, empty circle = inactive):

- **1\. COT short build:** Commercial net short increased week-over-week (from #5). Requires stored history.
- **2\. Margin hike announced:** CME clearing advisory for silver margins detected (from #6).
- **3\. OI drops fast, no news:** OI declined >5% in a single day without fundamental catalyst (from #1). Requires stored history.
- **4\. Spread widens:** Backwardation deepens or contango steepens unusually (from #7). Requires stored history.
- **5\. Thin liquidity window:** Current date in a known holiday/low-liquidity period (from key_dates table).

If 3 or more are active simultaneously, display a prominent SLAM RISK ELEVATED alert with pulsing visual emphasis. Note that checklist items 1, 3, and 4 require at least one prior data point in the database to compute week-over-week or day-over-day changes - they cannot fire on the first day after deployment.

# **4.5 Upcoming Events**

Display a sidebar or bottom panel showing events from key_dates table for the next 30 days. Events within 3 days highlighted. Past events grayed out or removed. Seed data should include FND and expiry dates for all five silver delivery months (March, May, July, September, December) for 2026, plus recurring weekly COT release dates (every Friday), and any known holiday windows.

**SECTION 5 - DASHBOARD UI SPECIFICATION**

# **5.1 Layout**

Single-page application. Dark navy header bar, white content area, responsive layout (desktop primary, mobile secondary). No login - private deployment. Four zones top-to-bottom:

- **Zone A - Header Bar:** Fixed top bar with title 'COMEX Silver Monitor', current silver spot price (from latest #7 data), current date/time, and 'Last Updated' timestamp showing when most recent data pull completed.
- **Zone B - Overall Posture:** Full-width colored banner showing market posture (BUY / SELL / CAUTION / NEUTRAL / INSUFFICIENT DATA) with posture reason text and Pre-Slam Risk Checklist below it.
- **Zone C - Indicator Grid:** 4-column by 3-row grid of indicator cards (12 total). Each card shows signal color, current value, data freshness, and trend direction. This is the core of the dashboard.
- **Zone D - Bottom Panels:** Two panels side-by-side: (left) LLM Daily Briefing text, (right) Upcoming Events timeline.

# **5.2 Indicator Card Design**

Each of the 12 cards contains:

- **Card header:** Indicator number and short name (e.g., '#2 Vault Inventory'). White text on signal-colored background: green (#2E7D32), amber (#F57F17), red (#C62828), gray (#9E9E9E for error/unavailable).
- **Current value:** Large text showing primary metric (e.g., '124M oz registered', 'Net long 25,214', '\$2.88 backwardation'). If unavailable: 'DATA UNAVAILABLE' in red italics.
- **Signal label:** Contextual text like 'BULLISH', 'WATCH', 'CRITICAL', 'MODERATING' - from signal_reason, not just color names.
- **Freshness:** Small text: 'Updated: Feb 4, 2026 6:15 PM ET'. Orange with warning icon if stale. Red with error detail if errored.
- **Trend arrow:** Small arrow comparing current computed_value to prior period. Green up if directionally bullish, red down if bearish, gray flat if unchanged. This requires stored history - show nothing on first day.
- **Week-over-week delta:** Small text showing percentage change from ~7 days ago (e.g., '-8.2% WoW'). Only displayed once 7+ days of history exist. Uses stored indicator_snapshots data.

# **5.3 Mouseover Tooltip**

When the user hovers over any card (or taps on mobile), a tooltip appears with three sections:

- **WHAT THIS MEASURES:** The full_description from indicator_metadata. Plain-language explanation of what data is being tracked and where it comes from. 2-3 sentences.
- **WHY IT MATTERS:** The why_it_works from indicator_metadata. Market mechanics - how this indicator connects to price moves. 2-3 sentences.
- **WHAT IT SAYS NOW:** The signal_reason from the latest indicator_snapshots row. Current interpretation with specific numbers and, if history exists, trend context (e.g., 'down 8M oz this week, fastest drawdown since November').

Tooltip styling: semi-transparent dark background, white text, three sections clearly labeled. Dismissible by clicking elsewhere or pressing Escape. On mobile: slide-up bottom sheet from screen bottom.

# **5.4 Posture Banner Design**

Zone B is a full-width banner (not a card) with background color filling the entire row:

- **BUY:** Deep green (#1B5E20) background. Upward chevron icon. Large white text: 'MARKET POSTURE: BULLISH'. Subtitle: posture reason in lighter text.
- **SELL:** Deep red (#B71C1C) background. Downward chevron. 'MARKET POSTURE: BEARISH'. Subtitle: reason.
- **CAUTION:** Dark amber (#E65100). Warning triangle. 'MARKET POSTURE: CAUTION'. Subtitle: key conflict.
- **NEUTRAL:** Medium gray (#455A64). Horizontal line. 'MARKET POSTURE: NEUTRAL'. Subtitle: reason.
- **INSUFFICIENT DATA:** Dark gray (#212121). Question mark. '\[N\] of 12 indicators unavailable.' Visually distinct from NEUTRAL.

# **5.5 Mandatory Error States**

These are NOT optional. Every error state must be implemented:

- **Fetch failed:** Card header turns gray. Body: 'FETCH FAILED' in red + error detail (e.g., 'HTTP 403 from cmegroup.com - possible rate limiting'). Bottom: 'Last successful: \[date\]' if prior success exists.
- **Parse error:** Gray header. 'PARSE ERROR' in orange + detail (e.g., 'CME XLS column Registered not found'). Helps debug when source formats change.
- **Stale data:** Keeps last signal color but adds orange STALE badge in corner. Orange freshness text. STALE indicators excluded from posture calculation. A value is stale if older than 2x its expected update frequency.
- **No data yet:** Blue/gray 'AWAITING DATA' state with expected next update time. Not an error - fresh deployment.
- **Not applicable:** 'NOT IN DELIVERY MONTH' for indicator #3 outside delivery months. Gray signal. Expected and normal.
- **Insufficient history:** 'INSUFFICIENT HISTORY for trend scoring' when an indicator requires week-over-week comparison but fewer than 7 days of data exist. The indicator still scores on absolute thresholds but notes the limitation.

# **5.6 LLM Briefing Panel**

Zone D left panel shows the latest daily briefing from daily_briefings table:

- **Header:** 'Daily Briefing - \[date\]' with overall_posture badge.
- **Body:** 3-5 paragraphs covering: overall assessment, the 2-3 most important indicator changes since yesterday (using stored history for comparison), upcoming key dates in next 7 days, specific actionable takeaway.
- **Footer:** 'Generated at \[time\] using Claude Sonnet. This is not financial advice.'
- **Empty state:** 'Briefing will be generated at 7:00 PM ET today.' (for fresh deployment).

# **5.7 Mobile**

Screens narrower than 768px: Grid changes from 4x3 to 2x6 or 1x12. Bottom panels stack vertically. Tooltips become bottom-sheet modals. Posture banner full-width with wrapping text.

**SECTION 6 - LLM BRIEFING GENERATION**

# **6.1 How It Works**

A Vercel cron job runs daily at 7 PM ET. It queries the database, constructs a prompt with full historical context, calls the Anthropic API, and stores the result. Steps: (1) Query the latest indicator_snapshots row for each of the 12 indicators. (2) For each indicator, also query the last 30 days of computed_value history from indicator_snapshots to provide trend context. (3) Query key_dates for events in the next 14 days. (4) Query yesterday's briefing (if any) for change-over-change context. (5) Construct the prompt (see 6.2) and send to the Anthropic API. (6) Parse the response and store in daily_briefings.

# **6.2 Why Historical Data Matters for the LLM**

The daily briefing's value comes from trend narration, not just current readings. By passing 30-90 days of stored history to the LLM, it can generate insights like:

- 'Registered stocks have declined for 12 consecutive trading days, losing 18M oz total - the longest drawdown streak since November 2025.'
- 'Commercial short positions have been building steadily for 3 weeks, adding 22,000 contracts. This is the same pattern that preceded the January 2026 slam.'
- 'The Shanghai premium has widened from 3% to 8% over the past 10 days, indicating accelerating physical demand in Asia.'
- 'Backwardation has deepened every day this week, now at \$3.15. This is entering uncharted territory - the prior record was \$2.88.'

Without stored history, the LLM can only say 'registered stocks are at 106M oz' - with it, the LLM can identify streaks, acceleration, deceleration, and historical comparisons.

# **6.3 Prompt Structure**

The prompt should include the following elements. The implementing agent writes the actual prompt text, but it must contain:

- **System message:** Role = senior precious metals analyst. Be direct, specific, include numbers. State what data shows, not what it might show. End with clear actionable takeaway framed as 'the data suggests' (not financial advice). Respond only in JSON format with fields: overall_posture, posture_reason, briefing_text.
- **User message data block:** For each of the 12 indicators: name, current computed_value, signal (green/yellow/red/error), signal_reason, data_date, whether value changed from prior reading. PLUS: the last 30 days of daily computed_value readings as a simple array so the LLM can identify trends. PLUS: upcoming key dates in next 14 days. PLUS: yesterday's briefing text for change-over-change context.

# **6.4 SDK Configuration**

- **Model:** claude-sonnet-4-20250514 (cost-effective for daily generation).
- **Max tokens:** 1500 (sufficient for JSON response with 3-5 paragraphs).
- **Temperature:** 0.3 (low creativity, high factual consistency).
- **API key:** ANTHROPIC_API_KEY environment variable on Vercel.

Error handling: If the Anthropic API is unreachable, log the error and leave today's briefing empty. Dashboard shows 'Briefing generation failed - will retry tomorrow.' Never show yesterday's briefing as if it were today's.

**SECTION 7 - PHASED IMPLEMENTATION PLAN**

**Build in 4 phases. Each phase delivers a testable, working increment. The implementing agent must run the application after each phase and confirm that data flows correctly from source to database to dashboard before proceeding.**

# **Phase 1: Foundation + CFTC COT (Indicators #4 and #5)**

**Why these first**

The CFTC COT API is the only source with a free, well-documented public API and full historical data back to 1986. It will work reliably, provides immediate value, and proves out the entire pipeline: fetch, parse, store, score, display.

**Deliverables**

- Scaffold Next.js project with App Router and Tailwind CSS.
- Provision Vercel Postgres. Create all four tables (indicator_snapshots, indicator_metadata, daily_briefings, key_dates) via database migration.
- Seed indicator_metadata with all 12 indicators using the descriptions from Section 2.
- Seed key_dates with silver FND/expiry dates for all 2026 delivery months and recurring COT release dates.
- Build API route for CFTC COT data: fetch from CFTC SODA API, parse JSON, compute speculator net position (#4) and commercial short position (#5), score both using Section 2 thresholds, INSERT rows into indicator_snapshots.
- Configure Vercel cron job for Fridays at 8 PM UTC.
- Build the dashboard page with full layout: header bar, posture banner (showing INSUFFICIENT DATA since only 2 of 12 exist), 12 indicator cards in a 4x3 grid (2 populated, 10 showing AWAITING DATA), empty briefing panel, and upcoming events panel populated from key_dates.
- Cards #4 and #5 fully functional: signal color, current value, freshness timestamp, and mouseover tooltip with WHAT/WHY/NOW sections.
- On first deployment, backfill 3 years of COT history by paginating through the CFTC API. This establishes the baseline for percentile calculations and enables immediate trend arrows.

**Test criteria**

- Trigger the fetch route manually via browser or curl. Verify a row appears in indicator_snapshots with fetch_status = success. Verify the dashboard renders the data correctly.
- Temporarily change the API URL to something invalid. Verify the dashboard shows FETCH FAILED on cards #4 and #5 with error detail.
- Verify that after backfill, trend arrows and week-over-week deltas display correctly using the stored historical data.

# **Phase 2: CME Daily Data (Indicators #1, #2, #3, #8)**

**Why these next**

These four indicators share the same source (CME daily reports) and represent the physical-market signals most critical for squeeze detection. They also begin the self-accumulation process - since CME overwrites files daily, every successful pull starts building the system's own history.

**Deliverables**

- Build API route for CME daily data: download and parse Silver Stocks XLS (indicator #2), extract OI data from CME volume report (indicators #1 and #8 per-month breakdowns), parse delivery reports during active delivery months (indicator #3).
- The Silver_stocks.xls file has rows for each depository (Brinks, HSBC, JP Morgan, etc.) with columns for Registered and Eligible ounces. The last row is the grand total. Parse with SheetJS.
- Score all four indicators using Section 2 thresholds. For #8 (roll patterns), note that it requires comparing today's per-month OI to yesterday's - on the first day, show 'Insufficient history - need 2+ days' rather than computing a roll signal.
- Configure cron for weekdays at 11 PM UTC (6 PM ET).
- All four dashboard cards fully functional with signal colors, values, freshness, and tooltips.
- Indicator #3 shows 'NOT IN DELIVERY MONTH' outside delivery months (March, May, July, September, December). This is a normal state, not an error.

**Test criteria**

- Trigger the fetch route. Verify vault stocks, OI, and delivery data are correctly parsed and stored with fetch_status = success.
- Test parse resilience: if CME changes their XLS format, the parser should fail with a descriptive parse_error rather than crashing. Verify this by manually editing a saved XLS to remove expected columns.
- After 3 consecutive daily pulls, verify the database has 3 rows per indicator, and that trend arrows are computing correctly by comparing the latest row to the prior one.

# **Phase 3: Market Data + Computed Indicators (#6, #7, #9, #10, #11, #12)**

**Why these together**

These six complete the full 12-indicator set. They include scraped data (#6 margins, #10 Shanghai), API data (#7 spot prices), and derived/computed indicators (#9 lease rate proxy, #11 FND ratio, #12 CVOL proxy). Once all 12 are live, the overall posture calculation can operate.

**Deliverables**

- Build API route for CME margins: scrape the margins webpage for current initial margin percentage, and check the CME Notices page for recent clearing advisories mentioning silver.
- Build API route for spot prices: call a free precious metals API (GoldAPI.io or MetalpriceAPI) for silver spot price and futures price. Compute backwardation/contango spread (indicator #7).
- Build API route for Shanghai premium: scrape SGE silver benchmark price page. Compute premium vs COMEX spot (indicator #10), including CNY/USD conversion from a free forex API.
- Build computation route for derived indicators: (a) implied lease rate from backwardation spread (#9), (b) FND delivery pressure ratio from per-month OI and registered stocks (#11), (c) CVOL proxy from daily price range as percentage of close (#12).
- All six dashboard cards fully functional.
- Overall posture calculation now operational - posture banner shows a real signal instead of INSUFFICIENT DATA.
- Pre-Slam Risk Checklist operational, cross-referencing stored history for indicators #1, #5, #6, #7, and the key_dates table.

**Test criteria**

- Trigger all fetch/compute routes in sequence. Verify all 12 cards show data. Verify posture banner computes a posture.
- For each scraped source (CME margins, SGE), verify graceful failure when page structure changes.
- Manually compute the FND delivery pressure ratio and lease rate proxy from raw data. Compare to the system's computed values - they should match.

# **Phase 4: LLM Briefing + Polish**

**Why last**

The briefing depends on all 12 indicators being live and ideally having at least a few days of stored history for trend narration. Polish items (mobile, edge cases, deployment config) are best done when the core is complete.

**Deliverables**

- Build API route for briefing generation: query all latest indicators plus their 30-day history from indicator_snapshots, construct the prompt per Section 6, call the Anthropic API, parse the JSON response, store in daily_briefings.
- Configure cron for weekdays at midnight UTC (7 PM ET).
- Daily Briefing panel (Zone D) fully functional, displaying the latest briefing with posture badge and clear attribution.
- Mobile-responsive layout per Section 5.7.
- Finalize vercel.json with all cron schedules, maxDuration configurations, and environment variable references.
- Create README.md with deployment instructions, complete list of required environment variables, and manual trigger commands for each fetch route.
- Build a /api/health endpoint that returns the status of each indicator's last fetch (success/failure/stale, last fetch timestamp) as JSON. This enables external monitoring.

**Test criteria**

- Trigger briefing generation manually. Read the output - it should reference specific numbers from indicator data and mention upcoming key dates. It should NOT be generic boilerplate.
- If the system has 7+ days of stored history, verify the briefing references trends and week-over-week changes, not just current values.
- Test the dashboard at 375px width (phone). All content accessible without horizontal scrolling.
- Wait for one complete day of cron jobs to run automatically. Verify all data fetched, signals computed, briefing generated without manual intervention.

**SECTION 8 - DATA SOURCE REFERENCE**

Quick-reference summary for the implementing agent. All sources, URLs, formats, and special considerations.

| **Source** | **URL / Endpoint** | **Format** | **Auth Required** | **Key Notes** |
| --- | --- | --- | --- | --- |
| CFTC COT API | publicreporting.cftc.gov/resource/6dca-aqww.json | JSON | None (free) | Best source. Full history to 1986. Backfill 3 years on first deploy. |
| CME Silver Stocks | cmegroup.com/delivery_reports/Silver_stocks.xls | XLS | None | Overwritten daily. Must archive every pull. Parse with SheetJS. |
| CME Volume/OI | cmegroup.com, metals volume page | HTML / XLS | None | Contains per-month OI breakdowns for roll pattern analysis. |
| CME Deliveries | cmegroup.com, NYMEX delivery notices page | HTML | None | Active during delivery months only. |
| CME Margins | cmegroup.com, silver margins page | HTML | None | Scrape current %. Also check Notices page for advisory PDFs. |
| CME Historical Margins | cmegroup.com, historical margins page | CSV | None | 5 years free. Download once for baseline data. |
| Silver Spot API | GoldAPI.io or MetalpriceAPI | JSON | Free API key | 100 req/month on GoldAPI free tier. Historical data included. |
| SGE Silver | en.sge.com.cn, Silver Benchmark Price page | HTML | None | Ag(T+D) in CNY/gram. Convert to USD/oz for comparison. |
| Forex (CNY/USD) | exchangerate-api.com or similar | JSON | Free API key | Needed for Shanghai premium computation. |
| GoldSilverAI | goldsilver.ai, Shanghai silver price page | HTML | None | Historical premium charts. Backup source. |

# **Implementation Notes**

- **User-Agent headers:** When scraping CME or SGE, set a realistic User-Agent (e.g., 'Mozilla/5.0 (compatible; SilverMonitor/1.0)') to avoid being blocked.
- **Rate limiting:** Cron schedule makes only 1 request per source per day. If blocked, implement exponential backoff with maximum 3 retries before recording an error.
- **Format changes:** CME occasionally changes file structures. Every parser should validate expected column names or HTML selectors on each fetch and fail gracefully with a descriptive parse_error. Do not crash the entire cron job.
- **Timezones:** Store all timestamps in UTC in the database. Display in Eastern Time (ET) on the dashboard, since the silver market operates on ET. Use a timezone library for conversion.
- **CFTC idempotency:** COT data only updates Fridays. The fetcher should check if the report_date in the API response matches the latest stored data_date. If duplicate, skip insertion. This prevents storing 7 identical rows per week.
- **Cold start:** On first deployment, manually trigger each fetch route once to populate initial data. The dashboard should handle the cold-start state gracefully (AWAITING DATA for indicators that have not yet run).
- **Vercel function limits:** Free plan: 10s timeout. Pro plan: 60s default, configurable to 300s with maxDuration in vercel.json. The CFTC historical backfill and LLM briefing generation may need the longer timeouts.
- **Database connection pooling:** Use the Vercel Postgres SDK or a connection pooler to avoid exhausting database connections from concurrent cron jobs.

**- END OF PRD -**

_This document contains all specifications for autonomous implementation._

_No code is included. The implementing agent should read this fully before writing any code._
