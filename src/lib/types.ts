export interface InfoGempa {
  id: string;
  lng: number;
  lat: number;
  mag: number;
  depth: string;
  place?: string;
  time?: string;
  message?: string;
  listAffectedArea?: AffectedArea[];
  mmi: number;
}

export interface AffectedArea {
  lng: number;
  lat: number;
  distance: number;
  name: string;
  hit: boolean;
  timeArrival?: Date;
}

export interface InfoTsunami {
  id: string;
  lng: number;
  lat: number;
  level?: string;
  message?: string;
  time?: string;
  listAffectedArea?: AffectedArea[];
}
