<script lang="ts">
    interface Props {
        min: number;
        max: number;
        step: number;
        low: number;
        high: number;
    }

    let { min, max, step, low = $bindable(), high = $bindable() }: Props = $props();

    let sliderElement: HTMLDivElement;

    function handlePointerDown(e: PointerEvent, type: 'low' | 'high') {
        const moveHandler = (moveEvent: PointerEvent) => {
            const rect = sliderElement.getBoundingClientRect();
            let percentage = (moveEvent.clientX - rect.left) / rect.width;
            percentage = Math.max(0, Math.min(1, percentage));
            
            let newValue = min + percentage * (max - min);
            newValue = Math.round(newValue / step) * step;

            if (type === 'low') {
                low = Math.min(newValue, high - step);
            } else {
                high = Math.max(newValue, low + step);
            }
        };

        const upHandler = () => {
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
        };

        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler);
        
        // Immediate move to click position
        moveHandler(e);
    }

    let lowPercent = $derived(((low - min) / (max - min)) * 100);
    let highPercent = $derived(((high - min) / (max - min)) * 100);
</script>

<div class="range-slider-container">
    <div bind:this={sliderElement} class="range-slider-track">
        <div 
            class="range-slider-fill" 
            style="left: {lowPercent}%; right: {100 - highPercent}%"
        ></div>
        
        <div 
            class="range-slider-handle" 
            style="left: {lowPercent}%"
            onpointerdown={(e) => handlePointerDown(e, 'low')}
            role="slider"
            aria-valuenow={low}
            tabindex="0"
        >
            <div class="handle-glow"></div>
        </div>

        <div 
            class="range-slider-handle" 
            style="left: {highPercent}%"
            onpointerdown={(e) => handlePointerDown(e, 'high')}
            role="slider"
            aria-valuenow={high}
            tabindex="0"
        >
            <div class="handle-glow"></div>
        </div>
    </div>
</div>

<style>
    .range-slider-container {
        width: 100%;
        height: 24px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        touch-action: none;
    }

    .range-slider-track {
        position: relative;
        width: 100%;
        height: 4px;
        background: rgba(255, 165, 0, 0.1);
        border: 1px solid rgba(255, 165, 0, 0.2);
        border-radius: 2px;
    }

    .range-slider-fill {
        position: absolute;
        height: 100%;
        background: var(--orange);
        box-shadow: 0 0 10px var(--orange);
    }

    .range-slider-handle {
        position: absolute;
        top: 50%;
        width: 16px;
        height: 16px;
        background: black;
        border: 2px solid var(--orange);
        transform: translate(-50%, -50%) rotate(45deg);
        cursor: pointer;
        z-index: 2;
        transition: transform 0.1s ease;
    }

    .range-slider-handle:hover {
        transform: translate(-50%, -50%) rotate(45deg) scale(1.2);
    }

    .handle-glow {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--orange);
        opacity: 0.3;
        filter: blur(4px);
    }

    .range-slider-handle:active {
        background: var(--orange);
    }
</style>
