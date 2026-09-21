import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/products`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching public products:', error);
    return NextResponse.json({ error: 'Failed to fetch products', details: error.message }, { status: 500 });
  }
}
