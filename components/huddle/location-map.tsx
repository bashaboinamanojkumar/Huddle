"use client"

import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps"
import { useEffect } from "react"

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

function MapPanner({ coords }: { coords: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    if (map && coords) {
      map.panTo(coords)
    }
  }, [map, coords])
  return null
}

export function LocationMap({ locationId }: { locationId: string }) {
  const coords = locationCoords[locationId]
  if (!coords) return null

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div
        className="mt-4 overflow-hidden rounded-[1.5rem]"
        style={{ height: "200px", width: "100%" }}
      >
        <Map
          defaultCenter={coords}
          defaultZoom={16}
          gestureHandling="cooperative"
          disableDefaultUI
          style={{ width: "100%", height: "200px" }}
        >
          <MapPanner coords={coords} />
          <Marker position={coords} />
        </Map>
      </div>
    </APIProvider>
  )
}