import cv2
import numpy as np
import json
import argparse
import sys
import math

def distance(p1, p2):
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

def sort_points_nearest_neighbor(points):
    """
    Mengurutkan titik-titik agar menjadi satu garis yang menyambung (TSP approximation).
    Sangat krusial untuk rendering tipe oscilloscope/XY agar garis tidak melompat-lompat berantakan.
    """
    if not points:
        return []
    
    unvisited = points.copy()
    current = unvisited.pop(0)
    sorted_points = [current]
    
    while unvisited:
        nearest_idx = 0
        min_dist = distance(current, unvisited[0])
        for i in range(1, len(unvisited)):
            dist = distance(current, unvisited[i])
            if dist < min_dist:
                min_dist = dist
                nearest_idx = i
                
        current = unvisited.pop(nearest_idx)
        sorted_points.append(current)
        
    return sorted_points

def main():
    parser = argparse.ArgumentParser(description="Convert black & white video to XY JSON for Waveform Chart")
    parser.add_argument("input", help="Path to input video (e.g. bad_apple.mp4)")
    parser.add_argument("output", help="Path to output JSON (e.g. bad_apple_frames.json)")
    parser.add_argument("--fps", type=int, default=15, help="Target FPS to extract (lower is easier on browser memory)")
    parser.add_argument("--max-points", type=int, default=400, help="Max points per frame (lower = faster render, higher = detailed)")
    
    args = parser.parse_args()
    
    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        print(f"Error: Could not open video {args.input}")
        sys.exit(1)
        
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        video_fps = 30
        
    frame_skip = max(1, int(video_fps / args.fps))
    
    frames_data = []
    frame_count = 0
    
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f"Processing video: {width}x{height} @ {video_fps}fps")
    print(f"Targeting: {args.fps}fps, Max {args.max_points} points/frame")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_count % frame_skip == 0:
            # 1. Convert to graysale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 2. Thresholding (Pastikan benar-benar hitam/putih murni)
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            
            # 3. Cari garis tepi (Contours)
            # Menggunakan RETR_LIST agar lubang (seperti apel hitam di background putih) ikut terbaca
            contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            
            frame_points = []
            screen_area = width * height
            for contour in contours:
                # Abaikan batas kotak frame layar penuh saat warnanya terbalik
                if cv2.contourArea(contour) < screen_area * 0.95:
                    for point in contour:
                        x, y = point[0]
                        frame_points.append((x, y))
                    
            # 4. Batasi jumlah titik agar web tidak hang (Downsampling)
            if len(frame_points) > args.max_points:
                step = len(frame_points) / args.max_points
                frame_points = [frame_points[int(i * step)] for i in range(args.max_points)]
                
            # 5. Sortir titik-titik (Algoritma Jalur Terpendek) 
            # supaya "benang" yang digambar di Svelte tidak ruwet/melompat jauh
            if len(frame_points) > 0:
                frame_points = sort_points_nearest_neighbor(frame_points)
            
            # 6. Normalisasi ke rentang nx, ny (-1.0 sampai 1.0)
            normalized_points = []
            for (x, y) in frame_points:
                nx = (x / width) * 2.0 - 1.0
                
                # Koordinat Canvas Y itu dari Atas(0) ke Bawah(Height).
                # Sumbu Math/Grafik Bawah(-1) ke Atas(1). Di versi terbaru chart,
                # Y positif ny sudah menuju ke bawah, jadi tidak perlu di-invert lagi.
                ny = (y / height) * 2.0 - 1.0 
                
                normalized_points.append({"nx": round(nx, 4), "ny": round(ny, 4)})
                
            # Hanya simpan frame jika ada point-nya
            frames_data.append(normalized_points)
            
            if len(frames_data) % 100 == 0:
                print(f"Processed {len(frames_data)} target frames...")
                
        frame_count += 1
        
    cap.release()
    
    print(f"Saving {len(frames_data)} frames to {args.output}...")
    with open(args.output, 'w') as f:
        # Tulis JSON serapat mungkin (tanpa indent) agar file lebih kecil
        json.dump(frames_data, f, separators=(',', ':'))
        
    print(f"Done! The file size is ready for consumption by WaveformChart.svelte.")

if __name__ == "__main__":
    main()
