import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchTerpLinkEvents, mapLocation } from '@/lib/terplink/adapter'

// Use service role key so we can bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HOST_EMAIL = 'rsingh06@umd.edu'
const UNIVERSITY_ID = 'umd'
const DEFAULT_CAPACITY = 30

export async function GET(req: Request) {
  // Simple auth check — only allow requests with the cron secret
  //const authHeader = req.headers.get('authorization')
  //if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  //}

  try {
    // 1. Get host user ID
    const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers()
    if (userErr) throw userErr
    const host = users.find(u => u.email === HOST_EMAIL)
    if (!host) throw new Error(`Host user ${HOST_EMAIL} not found`)

    // 2. Fetch from TerpLink (next 14 days, up to 100 events)
    const twoWeeksOut = new Date()
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

    const events = await fetchTerpLinkEvents({ take: 100 })

    // 3. Map to activities rows
    const rows = events.map(e => ({
      title:              e.title,
      description:        e.description,
      category:           e.category,
      location_id:        mapLocation(e.raw_location),
      capacity:           DEFAULT_CAPACITY,
      start_time:         e.start_time,
      status:             'approved',
      university_id:      UNIVERSITY_ID,
      host_id:            host.id,
      availability_block: e.availability_block,
      // Store terplink_id in metadata so we can upsert by it
      metadata:           { terplink_id: e.terplink_id, organization: e.organization },
    }))

    // 4. Upsert — overwrite on conflict
    // We use (host_id, start_time, title) as a natural unique key
    // since there's no terplink_id column yet
    const { data, error } = await supabase
      .from('activities')
      .upsert(rows, {
        onConflict: 'host_id,start_time,title',
        ignoreDuplicates: false, // overwrite
      })
      .select('id')

    if (error) throw error

    return NextResponse.json({
      success: true,
      synced: rows.length,
      message: `${rows.length} TerpLink events synced`,
    })

  } catch (err: any) {
    console.error('[TerpLink sync error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}