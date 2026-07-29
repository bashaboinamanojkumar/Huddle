"use client"

import { APIProvider, Map, Marker, InfoWindow } from "@vis.gl/react-google-maps"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ActivityView } from "@/lib/types/huddle"

const UMD_CENTER = { lat: 38.9869, lng: -76.9426 }

export function EventsMap({ activities }: { activities: ActivityView[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<ActivityView | null>(null)

  const locationCoords: Record<string, { lat: number; lng: number }> = {
  "loc-mckeldin": { lat: 38.9859, lng: -76.9451 },       // McKeldin Library - verified
  "loc-stamp": { lat: 38.9881, lng: -76.9450 },           // Stamp Student Union - verified
  "loc-board-brew": { lat: 38.9820, lng: -76.9370 },      // Board & Brew College Park
  "loc-eppley": { lat: 38.9917, lng: -76.9431 },          // Eppley Recreation Center
  "loc-hornbake": { lat: 38.9869, lng: -76.9433 },        // Hornbake Plaza
  "loc-tawes": { lat: 38.9857, lng: -76.9419 },           // Tawes Plaza
  "loc-eppley-gym": { lat: 38.9917, lng: -76.9431 },      // Eppley Gym (same building)
  "loc-eppley-pickleball": { lat: 38.9920, lng: -76.9425 }, // Eppley outdoor courts
  "loc-eppley-tennis": { lat: 38.9922, lng: -76.9422 },   // Eppley tennis courts
  "loc-eppley-pool": { lat: 38.9915, lng: -76.9435 },     // Eppley pool
  "loc-golf-course": { lat: 38.9785, lng: -76.9340 },     // UMD Golf Course
  "loc-paint-branch": { lat: 38.9955, lng: -76.9372 },    // Paint Branch Trail
}

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="h-[420px] w-full overflow-hidden rounded-[2rem]" style={{ minHeight: "420px", height: "420px" }}>
        <Map
          defaultCenter={UMD_CENTER}
          defaultZoom={15}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "420px" }}
        >
          {activities.map((activity) => {
            const coords = locationCoords[activity.locationId]
            if (!coords) return null
            return (
              <Marker
                key={activity.id}
                position={coords}
                onClick={() => setSelected(activity)}
                title={activity.title}
              />
            )
          })}

          {selected && (
            <InfoWindow
              position={locationCoords[selected.locationId]}
              onCloseClick={() => setSelected(null)}
            >
              <div className="max-w-[200px] p-1">
                <p className="text-xs font-bold text-black">{selected.title}</p>
                <p className="mt-1 text-xs text-gray-600">{selected.location.name}</p>
                <button
                  type="button"
                  onClick={() => router.push(`/app/activity/${selected.id}`)}
                  className="mt-2 rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white"
                >
                  View event
                </button>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  )
}