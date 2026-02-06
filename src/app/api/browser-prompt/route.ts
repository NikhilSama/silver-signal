import { NextResponse } from 'next/server';
import { BrowserUseClient } from 'browser-use-sdk';
import {
  getBrowserPrompt,
  updateBrowserPrompt,
  updateBrowserPromptRunStatus,
  insertSnapshot,
} from '@/lib/db/queries';
import { parseMetal } from '@/lib/constants/metals';
import type { Metal } from '@/lib/constants/metals';
import type { IndicatorSnapshotInsert } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Timeout for Browser Use tasks (60 seconds for manual runs)
const BROWSER_USE_TIMEOUT_MS = 60000;

interface UpdatePromptRequest {
  indicatorId: number;
  prompt: string;
  targetUrl: string;
  runImmediately?: boolean;
  metal?: string;
}

/** GET: Retrieve browser prompt for an indicator */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const indicatorId = searchParams.get('indicatorId');
  const metal = parseMetal(searchParams.get('metal'));

  if (!indicatorId) {
    return NextResponse.json(
      { success: false, error: 'indicatorId is required' },
      { status: 400 }
    );
  }

  try {
    const prompt = await getBrowserPrompt(parseInt(indicatorId), metal);

    if (!prompt) {
      return NextResponse.json({
        success: true,
        prompt: null,
        message: 'No browser prompt configured for this indicator',
      });
    }

    return NextResponse.json({
      success: true,
      prompt: {
        indicatorId: prompt.indicator_id,
        prompt: prompt.prompt,
        targetUrl: prompt.target_url,
        enabled: prompt.enabled,
        lastUpdated: prompt.last_updated,
        lastRunAt: prompt.last_run_at,
        lastRunSuccess: prompt.last_run_success,
        lastRunError: prompt.last_run_error,
      },
    });
  } catch (error) {
    console.error('[BrowserPrompt] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** POST: Update browser prompt and optionally run it immediately */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as UpdatePromptRequest;
    const { indicatorId, prompt, targetUrl, runImmediately = true, metal: metalParam } = body;
    const metal = parseMetal(metalParam);

    if (!indicatorId || !prompt || !targetUrl) {
      return NextResponse.json(
        { success: false, error: 'indicatorId, prompt, and targetUrl are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid targetUrl' },
        { status: 400 }
      );
    }

    // Update the prompt in the database
    const updatedPrompt = await updateBrowserPrompt(indicatorId, prompt, targetUrl, metal);
    console.log('[BrowserPrompt] Updated prompt for indicator', indicatorId, metal);

    let runResult = null;

    // Run immediately if requested
    if (runImmediately) {
      console.log('[BrowserPrompt] Running browser task immediately...');
      runResult = await runBrowserTask(indicatorId, prompt, targetUrl, metal);
    }

    return NextResponse.json({
      success: true,
      message: runImmediately
        ? (runResult?.success ? 'Prompt updated and task completed' : 'Prompt updated but task failed')
        : 'Prompt updated successfully',
      prompt: {
        indicatorId: updatedPrompt.indicator_id,
        prompt: updatedPrompt.prompt,
        targetUrl: updatedPrompt.target_url,
        lastUpdated: updatedPrompt.last_updated,
      },
      runResult,
    });
  } catch (error) {
    console.error('[BrowserPrompt] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** Run a browser task with the given prompt */
async function runBrowserTask(
  indicatorId: number,
  prompt: string,
  targetUrl: string,
  metal: Metal
): Promise<{ success: boolean; value?: number; error?: string }> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    await updateBrowserPromptRunStatus(indicatorId, false, 'BROWSER_USE_API_KEY not configured', metal);
    return { success: false, error: 'Browser Use not configured' };
  }

  const client = new BrowserUseClient({ apiKey });

  try {
    console.log('[BrowserPrompt] Creating browser task for indicator', indicatorId, metal);

    // Combine URL instruction with the prompt
    const fullPrompt = `Go to ${targetUrl}\n${prompt}`;

    const task = await client.tasks.createTask({ task: fullPrompt });

    console.log('[BrowserPrompt] Waiting for task completion...');
    const result = await Promise.race([
      task.complete(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Task timed out')), BROWSER_USE_TIMEOUT_MS)
      ),
    ]);

    const output = String(result.output || '').trim();
    console.log('[BrowserPrompt] Task output:', output);

    // Parse the numeric value from output
    const numericValue = parseFloat(output.replace(/[^0-9.-]/g, ''));

    if (isNaN(numericValue)) {
      await updateBrowserPromptRunStatus(indicatorId, false, `Invalid output: ${output}`, metal);
      return { success: false, error: `Could not parse value from: ${output}` };
    }

    // Insert a new snapshot with the result
    const snapshot: IndicatorSnapshotInsert = {
      indicator_id: indicatorId,
      fetched_at: new Date(),
      data_date: new Date(),
      raw_value: {
        browserUseOutput: output,
        promptUsed: prompt,
        targetUrl,
      },
      computed_value: numericValue,
      signal: 'yellow', // Default to yellow for manual fetches
      signal_reason: `BROWSER FETCH: Value ${numericValue} fetched via Browser Use`,
      source_url: targetUrl,
      fetch_status: 'success',
      error_detail: null,
      metal,
    };

    await insertSnapshot(snapshot);
    await updateBrowserPromptRunStatus(indicatorId, true, null, metal);

    console.log('[BrowserPrompt] Successfully fetched value:', numericValue);
    return { success: true, value: numericValue };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Browser task failed';
    console.error('[BrowserPrompt] Task error:', errorMsg);
    await updateBrowserPromptRunStatus(indicatorId, false, errorMsg, metal);
    return { success: false, error: errorMsg };
  }
}
