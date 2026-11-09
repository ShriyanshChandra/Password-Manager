#!/usr/bin/env python3
"""
Generate crisp PNG icons for CIPHER//VAULT Chrome Extension.
Creates 16x16, 32x32, 48x48, and 128x128 icons with Anime Beach Sunset & cybernetic palette:
- Background: Void Indigo (#100825)
- Keyhole / Shield / Lock: Sunset Gold (#ffb800), Orange (#e85c00), and Crimson (#cc2200)
"""
import os
import struct
import zlib
import math

def create_png(width, height, rgba_data):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_chunk = struct.pack('>I', len(ihdr)) + b'IHDR' + ihdr + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr))
    png += ihdr_chunk
    
    # Raw scanlines with filter byte 0
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type None
        start = y * width * 4
        raw.extend(rgba_data[start:start + width * 4])
        
    compressed = zlib.compress(bytes(raw), level=9)
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', zlib.crc32(b'IDAT' + compressed))
    png += idat_chunk
    
    # IEND chunk
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND'))
    png += iend_chunk
    
    return png

def render_icon(size):
    rgba = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    r_outer = size * 0.46
    
    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.sqrt(dx*dx + dy*dy)
            
            # Default transparent
            r, g, b, a = 0, 0, 0, 0
            
            if dist <= r_outer:
                # Rounded shield/hexagonal cyber badge
                # Background: Void Indigo gradient (#100825 to #1f0d3d)
                t = (y / size)
                r = int(16 + t * 24)
                g = int(8 + t * 16)
                b = int(37 + t * 45)
                a = 255
                
                # Outer glow ring in Sunset Gold (#ffb800)
                if dist >= r_outer - max(1.2, size * 0.08):
                    glow_t = (r_outer - dist) / max(1.0, size * 0.08)
                    r = int(255 * glow_t + r * (1 - glow_t))
                    g = int(184 * glow_t + g * (1 - glow_t))
                    b = int(0 * glow_t + b * (1 - glow_t))
                    a = 255
                
                # Draw Cyber Padlock / Key
                # Lock body: rectangle lower center
                body_w = size * 0.38
                body_h = size * 0.30
                body_top = size * 0.50
                body_left = cx - body_w / 2
                
                # Shackle: arch on top
                shackle_r = size * 0.17
                shackle_th = max(1.2, size * 0.075)
                shackle_cx = cx
                shackle_cy = body_top
                shackle_dist = math.sqrt((x - shackle_cx)**2 + (y - shackle_cy)**2)
                
                in_shackle = (y <= body_top and 
                              shackle_dist <= shackle_r and 
                              shackle_dist >= shackle_r - shackle_th)
                
                in_body = (x >= body_left and x <= body_left + body_w and
                           y >= body_top and y <= body_top + body_h)
                
                if in_shackle:
                    # Sunset Gold shackle
                    r, g, b = 255, 184, 0
                elif in_body:
                    # Glowing Sunset Orange to Gold gradient body
                    body_t = (y - body_top) / body_h
                    r = int(255)
                    g = int(140 + body_t * 60)
                    b = int(10 + body_t * 20)
                    
                    # Keyhole cutout in center of lock body
                    kh_cx = cx
                    kh_cy = body_top + body_h * 0.42
                    kh_r = max(1.0, size * 0.065)
                    kh_dist = math.sqrt((x - kh_cx)**2 + (y - kh_cy)**2)
                    in_kh_circle = kh_dist <= kh_r
                    in_kh_slot = (abs(x - kh_cx) <= max(0.8, size * 0.035) and 
                                  y >= kh_cy and y <= kh_cy + body_h * 0.38)
                    
                    if in_kh_circle or in_kh_slot:
                        # Void Indigo cutout
                        r, g, b = 16, 8, 37
            
            # Anti-aliasing at the outermost boundary
            if dist > r_outer - 0.75 and dist <= r_outer + 0.75:
                edge_a = max(0.0, min(1.0, (r_outer + 0.75 - dist) / 1.5))
                a = int(a * edge_a)
            elif dist > r_outer + 0.75:
                a = 0
                
            rgba[idx] = r
            rgba[idx + 1] = g
            rgba[idx + 2] = b
            rgba[idx + 3] = a
            
    return create_png(size, size, rgba)

def main():
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    sizes = [16, 32, 48, 128]
    for s in sizes:
        png_data = render_icon(s)
        path = os.path.join(icons_dir, f"icon-{s}.png")
        with open(path, "wb") as f:
            f.write(png_data)
        print(f"Generated {path} ({s}x{s}, {len(png_data)} bytes)")

if __name__ == "__main__":
    main()

