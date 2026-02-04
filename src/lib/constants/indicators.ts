import type { IndicatorMetadata } from '@/types/database';

/** All 12 indicator definitions from PRD Section 2 */
export const INDICATOR_METADATA: Omit<IndicatorMetadata, 'indicator_id'>[] = [
  {
    name: 'Open Interest (OI)',
    short_description: 'Active futures contracts',
    full_description:
      'Total active (unsettled) futures contracts for silver on COMEX. Key symbol SI (5,000 oz per contract). The front-month contract approaching delivery is the focus.',
    why_it_works:
      'OI reveals conviction. Sharp OI drop during a price crash = long liquidation. OI stabilizing/rebuilding = fresh buying. OI rising into delivery month while registered stocks are low = squeeze fuel.',
    green_criteria: 'OI stable or rising week-over-week with price stable/rising.',
    yellow_criteria: 'OI dropping 5-10% week-over-week, or diverging from price.',
    red_criteria: 'OI drops >10% in a week with no news catalyst, especially near FND.',
    update_frequency: 'Daily, after 6 PM ET',
    source_name: 'CME Daily Volume/OI Report',
  },
  {
    name: 'Registered vs Eligible Vault Inventory',
    short_description: 'COMEX vault stocks',
    full_description:
      'COMEX warehouses hold silver in two categories: Registered (has delivery warrant) and Eligible (in vault but not available for delivery). Key metrics: registered-to-total ratio and daily change.',
    why_it_works:
      'Single best squeeze indicator. Registered draining means less metal to settle contracts. When registered falls below outstanding contracts, delivery default becomes possible.',
    green_criteria: 'Registered >40% of total, or stable/increasing week-over-week.',
    yellow_criteria: 'Registered 25-40%, or declining 1-5M oz per week.',
    red_criteria: 'Registered <25%, or drawdowns >5M oz/week, or below delivery-month OI.',
    update_frequency: 'Daily, after 5:30 PM ET',
    source_name: 'CME Silver Stocks Report',
  },
  {
    name: 'Issues & Stops (Delivery Activity)',
    short_description: 'Delivery notices',
    full_description:
      'During delivery months, CME publishes daily delivery notices. Issues = warrants issued by shorts. Stops = warrants received by longs taking delivery. Also tracks clearing member concentration.',
    why_it_works:
      'High stops relative to registered stocks = genuine physical demand. Single clearing member issuing 90%+ reveals which institutions supply or drain metal.',
    green_criteria: 'Stops below 5% of registered stocks per week.',
    yellow_criteria: 'Stops at 5-15% of registered per week.',
    red_criteria: 'Stops >15% of registered per week, or single member >80% concentration.',
    update_frequency: 'Daily during delivery months (Mar, May, Jul, Sep, Dec)',
    source_name: 'CME Delivery Reports',
  },
  {
    name: 'COT - Speculator Net Position',
    short_description: 'Hedge fund positioning',
    full_description:
      'CFTC Commitments of Traders report, non-commercial category (hedge funds, CTAs). Net position = longs minus shorts. Silver CFTC code: 084691.',
    why_it_works:
      'Shows sentiment and vulnerability. Net longs at historic highs = crowded trade, slam-vulnerable. If net longs collapse before FND, slam succeeded.',
    green_criteria: 'Net long between 20th-60th percentile of 3-year range.',
    yellow_criteria: 'Net long above 60th percentile (crowded) or below 20th (washed out).',
    red_criteria: 'Net long above 80th percentile, or drops >20% week-over-week.',
    update_frequency: 'Weekly, Fridays at 3:30 PM ET (3-day lag)',
    source_name: 'CFTC COT Report',
  },
  {
    name: 'COT - Commercial Short Position',
    short_description: 'Bank short positions',
    full_description:
      'Same COT report, commercial category (banks, producers). Key metric: total commercial short contracts. Massive short book is ammunition for a paper slam.',
    why_it_works:
      'Banks profit from price drops. When commercial shorts are at historic highs, motivation to engineer a drop peaks. When covering, slam thesis weakens.',
    green_criteria: 'Commercial net short below 60th percentile of 3-year range.',
    yellow_criteria: 'Between 60th-80th percentile.',
    red_criteria: 'Above 80th percentile, or shorts increase >10,000 contracts week-over-week.',
    update_frequency: 'Weekly, Fridays at 3:30 PM ET',
    source_name: 'CFTC COT Report',
  },
  {
    name: 'Margin Requirements',
    short_description: 'CME margin levels',
    full_description:
      'CME-set initial and maintenance margin for silver futures, expressed as percentage of contract value. Hikes announced via CME Clearing Advisory notices.',
    why_it_works:
      'Margin hikes force leveraged longs to deposit more cash or liquidate. The recent 11% to 15% hike triggered the largest single-day drop on record.',
    green_criteria: 'Margins stable for 30+ days.',
    yellow_criteria: 'One margin change in past 14 days, or above historical median.',
    red_criteria: 'Two or more hikes within 14 days, or single hike exceeding 25%.',
    update_frequency: 'Event-driven, checked daily',
    source_name: 'CME Margins Page',
  },
  {
    name: 'Backwardation / Contango Spread',
    short_description: 'Spot vs futures price',
    full_description:
      'Price difference between silver spot and front-month futures. Contango (normal) = futures > spot. Backwardation = spot > futures. Measured in dollars.',
    why_it_works:
      'Sustained backwardation is the clearest physical shortage signal. Market pays more for silver NOW than a future promise. Current $2.88 backwardation is largest since 1980.',
    green_criteria: 'Contango of $0.10-$0.50 (normal cost of carry).',
    yellow_criteria: 'Near zero (flat) or mild backwardation up to -$0.50.',
    red_criteria: 'Backwardation exceeding -$0.50. Beyond -$2.00 is historically extreme.',
    update_frequency: 'Daily after settlement',
    source_name: 'Spot + Futures APIs',
  },
  {
    name: 'Contract Roll Patterns',
    short_description: 'How OI migrates between months',
    full_description:
      'How OI migrates between contract months as delivery approaches. Normal = forward roll. Unusual = backward roll (longs move INTO nearer months).',
    why_it_works:
      'Forward rolls are standard. Backward rolls are bullish - traders want delivery sooner. Pattern seen Jan 7-11 when longs rolled backward into Feb from Mar.',
    green_criteria: 'Normal forward roll. Expiring month OI declining, next month increasing.',
    yellow_criteria: 'Roll pace slower than typical. Longs holding into delivery month.',
    red_criteria: 'Backward rolls detected, or >20% of expiring-month OI held within 5 days of FND.',
    update_frequency: 'Daily, most informative 30 days before FND',
    source_name: 'CME Volume Report',
  },
  {
    name: 'Silver Lease Rates',
    short_description: 'Cost of borrowing silver',
    full_description:
      'Annualized cost of borrowing physical silver. Normal: near zero (0.1-0.5%). During scarcity: can spike to double/triple digits. Recently spiked to ~200%.',
    why_it_works:
      'Most direct scarcity measure. Spike means nobody lends metal - holders hoarding for delivery or value appreciation.',
    green_criteria: 'Below 2% annualized.',
    yellow_criteria: 'Between 2-10%.',
    red_criteria: 'Above 10%. Above 50% = crisis-level.',
    update_frequency: 'Daily via proxy from backwardation',
    source_name: 'Computed from Backwardation',
  },
  {
    name: 'Shanghai / Dubai Spot Premium',
    short_description: 'Asian price premium',
    full_description:
      'Price difference between silver on Shanghai Gold Exchange (SGE, CNY/gram) and COMEX spot (USD/oz). Requires CNY-to-USD conversion.',
    why_it_works:
      'Persistent Asian premium means physical flowing East because Western paper prices are below Asian willingness to pay. 10%+ premium confirms squeeze is real.',
    green_criteria: 'Premium below 2%.',
    yellow_criteria: 'Premium 2-5%.',
    red_criteria: 'Premium above 5%. Above 10% = structural disconnect.',
    update_frequency: 'Daily, during Asian hours',
    source_name: 'SGE Silver Benchmark',
  },
  {
    name: 'FND Proximity & Delivery Pressure Ratio',
    short_description: 'Delivery stress indicator',
    full_description:
      'Derived indicator: (delivery_month_OI × 5,000) / registered_ounces. Shows theoretical delivery claims vs available metal. Combined with days to FND.',
    why_it_works:
      'The convergence indicator. Ratio above 1.0 = more claims than metal. Higher ratio closer to FND = greater stress.',
    green_criteria: 'Ratio below 0.3, or >30 days to FND.',
    yellow_criteria: 'Ratio 0.3-0.7, or 10-30 days to FND with ratio above 0.3.',
    red_criteria: 'Ratio above 0.7 with <10 days to FND, or ratio above 1.0 any time.',
    update_frequency: 'Daily, derived from OI and vault stocks',
    source_name: 'Derived Calculation',
  },
  {
    name: 'CME CVOL (Volatility Index)',
    short_description: 'Implied volatility',
    full_description:
      'CME 30-day implied volatility index for silver options. Using price range proxy: daily (high - low) as % of close.',
    why_it_works:
      'Elevated CVOL = market pricing big moves. Spike BEFORE a price drop signals institutional slam positioning.',
    green_criteria: 'Below 30-day moving average AND below 1-year median.',
    yellow_criteria: 'Above 30-day average but below 1-year 80th percentile.',
    red_criteria: 'Above 1-year 80th percentile, or spikes 30%+ in a single day.',
    update_frequency: 'Daily, using price range proxy',
    source_name: 'Computed from OHLC',
  },
];
