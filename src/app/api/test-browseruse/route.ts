import { NextResponse } from 'next/server';
import { fetchMarginsViaBrowser } from '@/lib/api/browseruse';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(): Promise<NextResponse> {
  console.log('[TestBrowserUse] Starting test...');
  console.log('[TestBrowserUse] API Key in env:', !!process.env.BROWSER_USE_API_KEY);

  const result = await fetchMarginsViaBrowser();

  console.log('[TestBrowserUse] Result:', result);

  return NextResponse.json({
    apiKeyPresent: !!process.env.BROWSER_USE_API_KEY,
    result,
  });
}
