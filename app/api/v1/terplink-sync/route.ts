import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchTerpLinkEvents, mapLocation } from '@/lib/terplink/adapter'

export const dynamic = 'force-dynamic'

const HOST_EMAIL = 'rsingh06@umd.edu'
const UNIVERSITY_ID = 'umd'
const DEFAULT_CAPACITY = 30

export async function GET(req: Request) {
  // Move createClient INSIDE the handler so it only runs at request time
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // const authHeader = req.headers.get('authorization')
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  try {
    const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers()
    if (userErr) throw userErr
    const host = users.find(u => u.email === HOST_EMAIL)
    if (!host) throw new Error(`Host user ${HOST_EMAIL} not found`)

    const events = await fetchTerpLinkEvents({ take: 100 })

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
      metadata:           { terplink_id: e.terplink_id, organization: e.organization },
    }))

    const { error } = await supabase
      .from('activities')
      .upsert(rows, {
        onConflict: 'host_id,start_time,title',
        ignoreDuplicates: false,
      })

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