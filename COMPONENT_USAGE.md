# Component Usage Documentation

This document provides a guide on how to use the components available in `src/lib/components`.

## Table of Contents
- [AffectedAreaItem](#affectedareaitem)
- [Card](#card)
- [GempaBumiAlert](#gempabumialert)
- [HexGrid](#hexgrid)
- [HexShape](#hexshape)
- [Jam](#jam)
- [MentalToxicityLevel](#mentaltoxicitylevel)
- [Modal](#modal)
- [RibCageLayout](#ribcagelayout)
- [StripeBar](#stripebar)
- [TsunamiAlert](#tsunamialert)
- [TitikGempa (Mapbox Utility)](#titikgempa-mapbox-utility)
- [TitikTsunami (Mapbox Utility)](#titiktsunami-mapbox-utility)

---

## AffectedAreaItem
Displays a countdown and status for an affected area (e.g., tsunami arrival).

**Props:**
- `kota`: `AffectedArea` object (requires `name`, `timeArrival`, `distance`, `hit`).
- `onClick?`: `(kota: AffectedArea) => void` (optional callback).

### Example:
```svelte
<script>
    import AffectedAreaItem from "$lib/components/AffectedAreaItem.svelte";
    const area = {
        name: "Pangandaran",
        timeArrival: new Date(Date.now() + 600000), // 10 minutes from now
        distance: "120km",
        hit: false
    };
</script>

<AffectedAreaItem kota={area} />
```

---

## Card
A stylized "EWS" card component with header, content, and footer sections.

**Props:**
- `children`: `Snippet` (main content).
- `title?`: `Snippet` (header content).
- `footer?`: `Snippet` (footer content).
- `className?`: `string` (additional CSS classes).
- `onToggle?`: `() => void` (callback when header is clicked).

### Example:
```svelte
<Card>
    {#snippet title()}
        <h3>System Status</h3>
    {/snippet}
    
    <p>All sensors operating within normal parameters.</p>
    
    {#snippet footer()}
        <small>Last updated: 5 minutes ago</small>
    {/snippet}
</Card>
```

---

## GempaBumiAlert
A full-screen overlay alert for earthquake detections.

**Props:**
- `magnitudo?`: `number` (default: 0).
- `kedalaman?`: `string` (default: "").
- `show?`: `boolean` (default: false).
- `closeInSecond?`: `number` (auto-close timer in seconds).

### Example:
```svelte
<GempaBumiAlert 
    show={true} 
    magnitudo={7.5} 
    kedalaman="10 Km" 
    closeInSecond={10} 
/>
```

---

## HexGrid
A responsive honeycomb/hexagonal grid layout.

**Props:**
- `children`: `Snippet` (hex components).
- `className?`: `string`.
- `variant?`: `"pointy" | "flat"` (default: `"pointy"`).
- `hexWidth?`: `number`.
- `hexHeight?`: `number`.
- `gap?`: `number` (default: 4).

### Example:
```svelte
<HexGrid variant="pointy" hexWidth={100} hexHeight={115}>
    {#each Array(10) as _, i}
        <HexShape color="orange">
            <p>{i + 1}</p>
        </HexShape>
    {/each}
</HexGrid>
```

---

## HexShape
A single hexagonal shape container.

**Props:**
- `children?`: `Snippet`.
- `className?`: `string`.
- `color?`: `string` (e.g., `"red"`, `"orange"`).
- `flatTop?`: `boolean` (default: true).
- `clipContent?`: `boolean` (default: false).
- `paddingContent?`: `number` (default: 10).

### Example:
```svelte
<HexShape color="red" clipContent={true}>
    <div class="bg-black text-white p-2">
        CRITICAL ALERT
    </div>
</HexShape>
```

---

## Jam
A real-time clock component.

**Props:**
- `timeZone?`: `string` (default: `"local"`).

### Example:
```svelte
<div class="text-2xl font-bold">
    <Jam timeZone="Asia/Jakarta" />
</div>
```

---

## MentalToxicityLevel
A complex status visualization for network channels (NERV-style).

**Props:**
- `title?`: `string` (default: `"MENTAL TOXICITY LEVEL"`).
- `headerInfo?`: `{ label: string; value: string }[]`.
- `networks?`: `NetworkData[]`.
- `className?`: `string`.

### Example:
```svelte
<MentalToxicityLevel 
    title="SIGNAL PURITY"
    networks={[
        { id: "1", name: "IA-GE", active_channel: 10, inactive_channel: 2, total_channel: 12 },
        { id: "2", name: "GE-II", active_channel: 5, inactive_channel: 5, total_channel: 10 }
    ]} 
/>
```

---

## Modal
A stylized modal overlay for settings or information.

**Props:**
- `show`: `boolean` (bindable).
- `title?`: `string`.
- `variant?`: `"medium" | "large"` (default: `"medium"`).
- `contentClass?`: `string`.
- `children`: `Snippet`.

### Example:
```svelte
<script>
    let showModal = $state(false);
</script>

<button onclick={() => showModal = true}>Open Modal</button>

<Modal bind:show={showModal} title="SYSTEM SETTINGS">
    <p>Configure emergency protocols here.</p>
</Modal>
```

---

## RibCageLayout
A "ribcage" spine layout for displaying lists of items.

**Props:**
- `items`: `any[]`.
- `nodeContent`: `Snippet<[item, context]>`.
- `connectorContent?`: `Snippet<[item, context]>`.
- `getHref?`: `(item: any) => string`.

### Example:
```svelte
<RibCageLayout items={stations}>
    {#snippet nodeContent(item, ctx)}
        <div class="p-2 border border-primary">
            {item.name} ({ctx.side})
        </div>
    {/snippet}
    
    {#snippet connectorContent(item, ctx)}
        <span>{item.distance}km</span>
    {/snippet}
</RibCageLayout>
```

---

## StripeBar
An animated striped background/bar component.

**Props:**
- `children?`: `Snippet`.
- `className?`: `string`.
- `color?`: `string`.
- `orientation?`: `string` (e.g., `"vertical"`).
- `loop?`: `boolean` (default: false).
- `reverse?`: `boolean` (default: false).
- `duration?`: `number` (default: 10).
- `size?`: `string` (default: `"30px"`).

### Example:
```svelte
<StripeBar 
    loop={true} 
    orientation="vertical" 
    size="50px" 
    color="bg-red-500" 
    duration={5}
/>
```

---

## TsunamiAlert
A full-screen overlay alert for tsunami warnings.

**Props:**
- `infoTsunami`: `InfoTsunami` object.
- `closeInSecond?`: `number` (default: 0).

### Example:
```svelte
<TsunamiAlert 
    infoTsunami={{
        level: "AWAS",
        message: "Potensi tsunami besar terdeteksi di Pantai Selatan Jawa.",
        lng: 108.5,
        lat: -8.5
    }} 
    closeInSecond={30} 
/>
```

---

## TitikGempa (Mapbox Utility)
Class to manage earthquake markers and waves on a Mapbox map.

### Example:
```typescript
import { TitikGempa } from "$lib/components/TitikGempa";

const earthquake = new TitikGempa("quake-1", infoGempa, {
    map: mapObject,
    showMarker: true,
    showPopup: true,
    pWaveSpeed: 8.0,
    sWaveSpeed: 4.0,
    showPopUpInSecond: 1,
    closePopUpInSecond: 5
});
```

---

## TitikTsunami (Mapbox Utility)
Class to manage tsunami markers on a Mapbox map.

### Example:
```typescript
import { TitikTsunami } from "$lib/components/TitikTsunami";

const tsunami = new TitikTsunami("tsunami-1", infoTsunami, {
    map: mapObject,
    showMarker: true,
    showPopup: true,
    description: "Coastal Warning Issued"
});
```
