import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/dev/reset-clients`);
    const data = await res.json();
    return NextResponse.json({ success: true, api: API_BASE_URL, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, api: API_BASE_URL });
  }
}
