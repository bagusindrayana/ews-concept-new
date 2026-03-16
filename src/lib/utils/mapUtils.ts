/**
 * Generates HTML for an earthquake popup.
 * @param data Earthquake information
 * @returns HTML string
 */
export function createGempaPopupHTML(data: {
  id: string;
  mag: number;
  depth: string;
  time: string;
  lat: number;
  lng: number;
}): string {
  return `
    <div class="ews-card bordered-red min-h-48 min-w-48 whitespace-pre-wrap" data-id="${data.id}">
      <div class="ews-card-header bordered-red-bottom overflow-hidden">
        <div class="stripe-wrapper"><div class="stripe-bar-red loop-stripe-reverse anim-duration-20"></div><div class="stripe-bar-red loop-stripe-reverse anim-duration-20"></div></div>
        <div class="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center">
          <p class="p-1 bg-black font-bold text-xs ews-title">EARTHQUAKE</p>
        </div>
      </div>
      <div class="ews-card-content p-1 lg:p-2   text-sm w-full" style="font-size:10px">
        <table class="w-full">
          <tbody>
            <tr><td class="flex">Magnitudo</td><td class="text-right break-words pl-2">${Number(data.mag).toFixed(1)}</td></tr>
            <tr><td class="flex">Kedalaman</td><td class="text-right break-words pl-2">${data.depth}</td></tr>
            <tr><td class="flex">Waktu</td><td class="text-right break-words pl-2">${data.time}</td></tr>
            <tr><td class="flex">Lokasi (Lat,Lng)</td><td class="text-right break-words pl-2">${data.lat} , ${data.lng}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`
    .trim()
    .replace(/>\s+</g, "><");
}
