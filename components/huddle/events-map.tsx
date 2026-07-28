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
    "loc-mckeldin": { lat: 38.9858, lng: -76.9448 },
    "loc-stamp": { lat: 38.9888, lng: -76.9444 },
    "loc-board-brew": { lat: 38.9826, lng: -76.9388 },
    "loc-eppley": { lat: 38.9923, lng: -76.9448 },
    "loc-hornbake": { lat: 38.9872, lng: -76.9418 },
    "loc-tawes": { lat: 38.9864, lng: -76.9432 },
    "loc-eppley-gym": { lat: 38.9923, lng: -76.9448 },
    "loc-eppley-pickleball": { lat: 38.9925, lng: -76.9442 },
    "loc-eppley-tennis": { lat: 38.9927, lng: -76.9440 },
    "loc-eppley-pool": { lat: 38.9921, lng: -76.9450 },
    "loc-golf-course": { lat: 38.9800, lng: -76.9350 },
    "loc-paint-branch": { lat: 38.9950, lng: -76.9380 },
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="h-[420px] w-full overflow-hidden rounded-[2rem]" style={{ minHeight: "420px", height: "420px" }}>
        <Map
          defaultCenter={UMD_CENTER}
          defaultZoom={15}
          mapId="huddle-events-map"
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