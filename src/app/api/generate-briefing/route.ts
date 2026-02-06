import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import {
  getLatestSnapshots,
  getSnapshotHistory,
  getUpcomingDates,
  getYesterdayBriefing,
  insertBriefing,
  getAllMetadata,
} from '@/lib/db/queries';
import { INDICATOR_METADATA } from '@/lib/constants/indicators';
import { GOLD_INDICATOR_METADATA } from '@/lib/constants/indicators-gold';
import { parseMetal, getMetalConfig } from '@/lib/constants/metals';
import type { Metal } from '@/lib/constants/metals';
import type { IndicatorSnapshot, IndicatorMetadata, KeyDate, DailyBriefing } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface IndicatorContext {
  id: number;
  name: string;
  currentValue: number;
  signal: string;
  signalReason: string;
  dataDate: string;
  history: number[];
  weekOverWeekChange: number | null;
}

interface BriefingResponse {
  overall_posture: 'BUY' | 'SELL' | 'CAUTION' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
  posture_reason: string;
  briefing_text: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  // Parse metal from query params
  const { searchParams } = new URL(request.url);
  const metal = parseMetal(searchParams.get('metal'));
  const config = getMetalConfig(metal);

  try {
    // Gather all data for the briefing
    const [snapshots, metadata, upcomingDates, yesterdayBriefing] = await Promise.all([
      getLatestSnapshots(metal),
      getAllMetadata(metal),
      getUpcomingDates(14, metal),
      getYesterdayBriefing(metal),
    ]);

    // Get 30-day history for each indicator
    const historyPromises = Array.from({ length: 12 }, (_, i) =>
      getSnapshotHistory(i + 1, 30, metal)
    );
    const histories = await Promise.all(historyPromises);

    // Build indicator context for the LLM
    const indicatorContexts = buildIndicatorContexts(snapshots, histories, metadata, metal);

    // Calculate overall posture based on current signals
    const posture = calculatePosture(snapshots);

    // Generate the briefing using Claude
    const briefingResponse = await generateBriefingWithClaude(
      apiKey,
      indicatorContexts,
      posture,
      upcomingDates,
      yesterdayBriefing,
      config.displayName
    );

    // Store the briefing
    const storedBriefing = await insertBriefing({
      briefing_date: new Date(),
      overall_posture: briefingResponse.overall_posture,
      posture_reason: briefingResponse.posture_reason,
      briefing_text: briefingResponse.briefing_text,
      indicator_summary: buildIndicatorSummary(snapshots),
      metal,
    });

    return NextResponse.json({
      success: true,
      metal,
      briefing: {
        date: storedBriefing.briefing_date,
        posture: storedBriefing.overall_posture,
        reason: storedBriefing.posture_reason,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Briefing generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function buildIndicatorContexts(
  snapshots: IndicatorSnapshot[],
  histories: IndicatorSnapshot[][],
  metadata: IndicatorMetadata[],
  metal: Metal
): IndicatorContext[] {
  const fallbackMetadata = metal === 'gold' ? GOLD_INDICATOR_METADATA : INDICATOR_METADATA;
  return Array.from({ length: 12 }, (_, i) => {
    const id = i + 1;
    const snapshot = snapshots.find((s) => s.indicator_id === id);
    const history = histories[i] || [];
    const meta = metadata.find((m) => m.indicator_id === id) || fallbackMetadata[i];

    const historyValues = history.map((h) => Number(h.computed_value));

    // Calculate week-over-week change
    let weekOverWeekChange: number | null = null;
    if (history.length >= 7) {
      const weekAgo = history.find((h) => {
        const daysDiff = Math.abs(
          (new Date().getTime() - new Date(h.data_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysDiff >= 6 && daysDiff <= 8;
      });
      if (weekAgo && snapshot) {
        const current = Number(snapshot.computed_value);
        const prior = Number(weekAgo.computed_value);
        if (prior !== 0) {
          weekOverWeekChange = ((current - prior) / Math.abs(prior)) * 100;
        }
      }
    }

    return {
      id,
      name: meta?.name || `Indicator ${id}`,
      currentValue: snapshot ? Number(snapshot.computed_value) : 0,
      signal: snapshot?.signal || 'error',
      signalReason: snapshot?.signal_reason || 'No data available',
      dataDate: snapshot ? new Date(snapshot.data_date).toISOString().split('T')[0] : 'N/A',
      history: historyValues,
      weekOverWeekChange,
    };
  });
}

function calculatePosture(
  snapshots: IndicatorSnapshot[]
): 'BUY' | 'SELL' | 'CAUTION' | 'NEUTRAL' | 'INSUFFICIENT_DATA' {
  const validSnapshots = snapshots.filter((s) => s.fetch_status === 'success');

  if (validSnapshots.length < 8) {
    return 'INSUFFICIENT_DATA';
  }

  const greenCount = validSnapshots.filter((s) => s.signal === 'green').length;
  const redCount = validSnapshots.filter((s) => s.signal === 'red').length;

  // Check for override conditions
  const fndRatio = snapshots.find((s) => s.indicator_id === 11);
  const margins = snapshots.find((s) => s.indicator_id === 6);

  if (redCount >= 4 || margins?.signal === 'red') {
    return 'SELL';
  }

  if (greenCount >= 7 && redCount === 0 && fndRatio?.signal !== 'red') {
    return 'BUY';
  }

  if (redCount >= 3 || fndRatio?.signal === 'red') {
    return 'CAUTION';
  }

  return 'NEUTRAL';
}

async function generateBriefingWithClaude(
  apiKey: string,
  indicators: IndicatorContext[],
  posture: string,
  upcomingDates: KeyDate[],
  yesterdayBriefing: DailyBriefing | null,
  metalName: string
): Promise<BriefingResponse> {
  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a senior precious metals analyst specializing in COMEX ${metalName.toLowerCase()} futures markets. Your role is to provide clear, actionable daily briefings based on market data.

Be direct and specific. Include actual numbers from the data. State what the data shows, not what it might show. End with a clear actionable takeaway framed as "the data suggests" (not financial advice).

Respond ONLY with valid JSON in this exact format:
{
  "overall_posture": "BUY" | "SELL" | "CAUTION" | "NEUTRAL" | "INSUFFICIENT_DATA",
  "posture_reason": "One sentence explaining the posture",
  "briefing_text": "3-5 paragraphs covering: overall assessment, the 2-3 most important indicator changes, upcoming key dates, and specific actionable takeaway"
}`;

  const userPrompt = buildUserPrompt(indicators, posture, upcomingDates, yesterdayBriefing, metalName);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    temperature: 0.3,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  const responseText = textBlock.text.trim();
  console.log('Claude response:', responseText.substring(0, 500));

  try {
    // Try to extract JSON from the response (Claude might wrap it in markdown)
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as BriefingResponse;
    return parsed;
  } catch (parseError) {
    // If JSON parsing fails, try to extract meaningful content
    console.error('Failed to parse Claude response as JSON:', parseError);
    console.error('Raw response:', responseText);

    // Return the raw text as the briefing
    return {
      overall_posture: posture as BriefingResponse['overall_posture'],
      posture_reason: 'Analysis generated successfully',
      briefing_text: responseText,
    };
  }
}

function buildUserPrompt(
  indicators: IndicatorContext[],
  posture: string,
  upcomingDates: KeyDate[],
  yesterdayBriefing: DailyBriefing | null,
  metalName: string
): string {
  const indicatorData = indicators.map((ind) => {
    const historyStr = ind.history.length > 0
      ? `Last 30 days: [${ind.history.slice(-10).map((v) => v.toFixed(2)).join(', ')}...]`
      : 'No history available';

    const wowStr = ind.weekOverWeekChange !== null
      ? `WoW change: ${ind.weekOverWeekChange > 0 ? '+' : ''}${ind.weekOverWeekChange.toFixed(1)}%`
      : 'WoW: N/A (insufficient history)';

    return `
**#${ind.id} ${ind.name}**
- Current value: ${ind.currentValue.toFixed(2)}
- Signal: ${ind.signal.toUpperCase()}
- Reason: ${ind.signalReason}
- Data date: ${ind.dataDate}
- ${wowStr}
- ${historyStr}`;
  }).join('\n');

  const upcomingDatesStr = upcomingDates.length > 0
    ? upcomingDates.map((d) =>
        `- ${new Date(d.event_date).toLocaleDateString()}: ${d.event_name} (${d.event_type})`
      ).join('\n')
    : 'No upcoming events in the next 14 days.';

  const yesterdayContext = yesterdayBriefing
    ? `\n**Yesterday's Briefing (${new Date(yesterdayBriefing.briefing_date).toLocaleDateString()}):**\nPosture: ${yesterdayBriefing.overall_posture}\n${yesterdayBriefing.briefing_text.substring(0, 500)}...`
    : '\nNo prior briefing available.';

  return `Generate a daily briefing for the COMEX ${metalName} Early Signal Monitoring System.

**Today's Date:** ${new Date().toLocaleDateString()}

**Current Posture Calculation:** ${posture}

**INDICATOR DATA:**
${indicatorData}

**UPCOMING KEY DATES (Next 14 Days):**
${upcomingDatesStr}

**CONTEXT FROM YESTERDAY:**
${yesterdayContext}

Based on this data, generate a comprehensive daily briefing. Focus on:
1. The overall market posture and why
2. The 2-3 most significant indicator changes or readings
3. Any upcoming events that traders should watch
4. A clear, actionable takeaway

Remember to be specific with numbers and reference the trend data where relevant.`;
}

function buildIndicatorSummary(snapshots: IndicatorSnapshot[]): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const snapshot of snapshots) {
    summary[`indicator_${snapshot.indicator_id}`] = {
      signal: snapshot.signal,
      value: Number(snapshot.computed_value),
      reason: snapshot.signal_reason,
      dataDate: new Date(snapshot.data_date).toISOString().split('T')[0],
    };
  }

  return summary;
}
