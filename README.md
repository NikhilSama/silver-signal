# COMEX Silver Early Signal Monitoring System

A real-time monitoring dashboard that tracks 12 key indicators in the COMEX silver futures market. The system detects early signals of paper slams (engineered price drops) and physical squeezes (delivery demand exceeding vault stocks).

## Features

- **12 Market Indicators**: Open Interest, Vault Inventory, Deliveries, COT Speculator/Commercial positions, Margins, Backwardation, Roll Patterns, Lease Rates, Shanghai Premium, FND Ratio, CVOL
- **Traffic Light Scoring**: Each indicator scored as Green (bullish), Yellow (watch), or Red (critical)
- **Overall Market Posture**: BUY / SELL / CAUTION / NEUTRAL recommendation
- **Pre-Slam Risk Checklist**: Early warning system for coordinated price drops
- **LLM Daily Briefings**: AI-generated analysis using Claude Sonnet
- **Historical Data Storage**: Append-only snapshots for trend analysis

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Database**: Vercel Postgres
- **Scheduling**: Vercel Cron Jobs
- **LLM**: Anthropic Claude Sonnet
- **Styling**: Tailwind CSS

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Vercel Postgres (auto-configured on Vercel)
POSTGRES_URL=your_postgres_connection_string

# Anthropic API for LLM briefings
ANTHROPIC_API_KEY=your_anthropic_api_key

# Browser Use Cloud (optional, for CME data scraping)
BROWSER_USE_API_KEY=your_browseruse_api_key
```

## Deployment

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 2. Set Environment Variables

In Vercel dashboard, add the environment variables listed above.

### 3. Initialize Database

After deployment, run the database setup:

```bash
curl https://your-domain.vercel.app/api/setup-db
```

### 4. Seed Initial Data

```bash
curl https://your-domain.vercel.app/api/seed-db
```

### 5. Backfill COT History (Optional)

For 3 years of COT historical data:

```bash
curl https://your-domain.vercel.app/api/backfill-cot
```

## Manual Data Triggers

Each indicator can be manually triggered for testing:

```bash
# COT Data (Indicators #4 & #5)
curl https://your-domain/api/fetch-cot

# CME Daily Data (Indicators #1, #2, #3, #8)
curl https://your-domain/api/fetch-cme-daily

# Margins (Indicator #6)
curl https://your-domain/api/fetch-margins

# Spot Prices / Backwardation (Indicator #7)
curl https://your-domain/api/fetch-spot-prices

# Shanghai Premium (Indicator #10)
curl https://your-domain/api/fetch-shanghai

# Derived Indicators (#9, #11, #12)
curl https://your-domain/api/compute-derived

# Generate LLM Briefing
curl https://your-domain/api/generate-briefing

# Health Check
curl https://your-domain/api/health
```

## Cron Schedule (UTC)

| Job | Schedule | Indicators |
|-----|----------|------------|
| fetch-cot | Fridays 8 PM | #4, #5 |
| fetch-cme-daily | Weekdays 11 PM | #1, #2, #3, #8 |
| fetch-margins | Weekdays 6 PM | #6 |
| fetch-spot-prices | Every 4 hours | #7 |
| fetch-shanghai | Weekdays 12 PM | #10 |
| compute-derived | Weekdays 11:30 PM | #9, #11, #12 |
| generate-briefing | Weekdays midnight | LLM Briefing |

## Data Sources

| Indicator | Source |
|-----------|--------|
| #1 Open Interest | CME / CFTC fallback |
| #2 Vault Inventory | CME Silver Stocks |
| #3 Deliveries | CME Delivery Reports |
| #4 COT Speculator | CFTC SODA API |
| #5 COT Commercial | CFTC SODA API |
| #6 Margins | CME + Browser Use |
| #7 Backwardation | goldprice.org + Yahoo Finance |
| #8 Roll Patterns | Derived from OI |
| #9 Lease Rates | Derived from backwardation |
| #10 Shanghai Premium | SGE API |
| #11 FND Ratio | Derived from OI + Vault |
| #12 CVOL | Derived from OHLC |

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes for data fetching
│   └── page.tsx       # Main dashboard
├── components/
│   ├── data-display/  # Indicator cards, briefing panel
│   ├── layout/        # Header, page shell
│   └── ui/            # Base components (Card, Badge)
├── lib/
│   ├── api/           # Data fetching logic by source
│   ├── constants/     # Indicator metadata
│   ├── db/            # Database queries
│   └── utils/         # Formatting, transforms
└── types/             # TypeScript definitions
```

## License

Private - Turgon, Inc.
