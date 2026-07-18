import { PlaceRef } from "./types";

// 장소 전거의 좌표를 OpenStreetMap 링크로 변환 (기술 스택 결정: 지도는 OSM, 9번 참고).
export function osmUrl(place: PlaceRef, zoom = 14): string {
  return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=${zoom}/${place.lat}/${place.lng}`;
}
