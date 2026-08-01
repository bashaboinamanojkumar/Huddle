"use client"

import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps"
import { useEffect } from "react"

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
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
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