import os
import subprocess
import math

def create_ppm_p6(width, height, color_func, filename):
    with open(filename, 'wb') as f:
        header = f"P6\n{width} {height}\n255\n".encode('ascii')
        f.write(header)
        
        row_buffer = bytearray(width * 3)
        for y in range(height):
            for x in range(width):
                r, g, b = color_func(x, y, width, height)
                idx = x * 3
                row_buffer[idx] = max(0, min(255, int(r)))
                row_buffer[idx+1] = max(0, min(255, int(g)))
                row_buffer[idx+2] = max(0, min(255, int(b)))
            f.write(row_buffer)

def convert_ppm_to_png(ppm_path, png_path):
    subprocess.run(['sips', '-s', 'format', 'png', ppm_path, '--out', png_path], check=True, stdout=subprocess.DEVNULL)
    if os.path.exists(ppm_path):
        os.remove(ppm_path)

def generate_worker_icon(x, y, w, h):
    # Emerald gradient background #0F766E to #0D5F58
    ny = y / h
    nx = x / w
    cx, cy = w / 2, h / 2
    dx = x - cx
    dy = y - cy
    dist = math.sqrt(dx*dx + dy*dy)
    
    # Base background
    r = 15 + ny * 10
    g = 118 - ny * 20
    b = 110 - ny * 20
    
    # Outer circular glow
    outer_radius = w * 0.42
    inner_radius = w * 0.32
    core_radius = w * 0.22
    
    if dist < outer_radius and dist > inner_radius:
        # Ring
        ring_t = (dist - inner_radius) / (outer_radius - inner_radius)
        blend = math.sin(ring_t * math.pi)
        r = r * (1 - blend) + 20 * blend
        g = g * (1 - blend) + 184 * blend
        b = b * (1 - blend) + 166 * blend
    elif dist <= inner_radius and dist >= core_radius:
        # Inner shield area
        r = 6
        g = 78
        b = 59
    elif dist < core_radius:
        # Central shift star / emblem
        # Stylized lightning / shift arrow
        angle = math.atan2(dy, dx)
        mod_angle = abs(math.fmod(angle, math.pi / 2) - math.pi / 4)
        if mod_angle < 0.25 or (abs(dx) < w * 0.05 and abs(dy) < h * 0.16) or (abs(dy) < h * 0.05 and abs(dx) < w * 0.16):
            r = 255
            g = 255
            b = 255
        else:
            r = 20
            g = 184
            b = 166
            
    return r, g, b

def generate_organizer_icon(x, y, w, h):
    # Obsidian Slate background #0F172A
    ny = y / h
    cx, cy = w / 2, h / 2
    dx = x - cx
    dy = y - cy
    dist = math.sqrt(dx*dx + dy*dy)
    
    r = 15 + ny * 8
    g = 23 + ny * 10
    b = 42 + ny * 16
    
    outer_radius = w * 0.42
    inner_radius = w * 0.32
    core_radius = w * 0.22
    
    if dist < outer_radius and dist > inner_radius:
        # Electric Teal border ring
        ring_t = (dist - inner_radius) / (outer_radius - inner_radius)
        blend = math.sin(ring_t * math.pi)
        r = r * (1 - blend) + 45 * blend
        g = g * (1 - blend) + 212 * blend
        b = b * (1 - blend) + 191 * blend
    elif dist <= inner_radius and dist >= core_radius:
        r = 30
        g = 41
        b = 59
    elif dist < core_radius:
        # Crown / stage grid emblem
        if (abs(dx) < w * 0.15 and abs(dy + h*0.03) < h * 0.08) or (abs(dy - h*0.06) < h * 0.03 and abs(dx) < w * 0.12):
            r = 255
            g = 255
            b = 255
        else:
            r = 13
            g = 148
            b = 136
            
    return r, g, b

def generate_splash_icon(x, y, w, h, is_worker=True):
    cx, cy = w / 2, h / 2
    dx = x - cx
    dy = y - cy
    dist = math.sqrt(dx*dx + dy*dy)
    radius = w * 0.4
    
    if is_worker:
        if dist < radius:
            return generate_worker_icon(x, y, w, h)
        return 248, 250, 252 # Clean Slate 50 background
    else:
        if dist < radius:
            return generate_organizer_icon(x, y, w, h)
        return 9, 13, 20 # Dark background

def main():
    os.makedirs('scripts', exist_ok=True)
    
    worker_dir = 'apps/worker/assets/images'
    organizer_dir = 'apps/organizer/assets/images'
    os.makedirs(worker_dir, exist_ok=True)
    os.makedirs(organizer_dir, exist_ok=True)
    
    # 1. Worker App Icons
    print("Generating Worker branding assets...")
    create_ppm_p6(512, 512, generate_worker_icon, 'temp_w_icon.ppm')
    convert_ppm_to_png('temp_w_icon.ppm', f'{worker_dir}/icon.png')
    convert_ppm_to_png('temp_w_icon.ppm', f'{worker_dir}/android-icon-foreground.png') if os.path.exists('temp_w_icon.ppm') else subprocess.run(['cp', f'{worker_dir}/icon.png', f'{worker_dir}/android-icon-foreground.png'])
    
    # Background for adaptive
    create_ppm_p6(512, 512, lambda x,y,w,h: (15, 118, 110), 'temp_w_bg.ppm')
    convert_ppm_to_png('temp_w_bg.ppm', f'{worker_dir}/android-icon-background.png')
    
    # Splash icon
    create_ppm_p6(512, 512, lambda x,y,w,h: generate_splash_icon(x, y, w, h, True), 'temp_w_splash.ppm')
    convert_ppm_to_png('temp_w_splash.ppm', f'{worker_dir}/splash-icon.png')
    
    # Favicon 48x48
    create_ppm_p6(48, 48, generate_worker_icon, 'temp_w_fav.ppm')
    convert_ppm_to_png('temp_w_fav.ppm', f'{worker_dir}/favicon.png')
    
    # 2. Organizer App Icons
    print("Generating Organizer branding assets...")
    create_ppm_p6(512, 512, generate_organizer_icon, 'temp_o_icon.ppm')
    convert_ppm_to_png('temp_o_icon.ppm', f'{organizer_dir}/icon.png')
    convert_ppm_to_png('temp_o_icon.ppm', f'{organizer_dir}/android-icon-foreground.png') if os.path.exists('temp_o_icon.ppm') else subprocess.run(['cp', f'{organizer_dir}/icon.png', f'{organizer_dir}/android-icon-foreground.png'])
    
    create_ppm_p6(512, 512, lambda x,y,w,h: (15, 23, 42), 'temp_o_bg.ppm')
    convert_ppm_to_png('temp_o_bg.ppm', f'{organizer_dir}/android-icon-background.png')
    
    create_ppm_p6(512, 512, lambda x,y,w,h: generate_splash_icon(x, y, w, h, False), 'temp_o_splash.ppm')
    convert_ppm_to_png('temp_o_splash.ppm', f'{organizer_dir}/splash-icon.png')
    
    create_ppm_p6(48, 48, generate_organizer_icon, 'temp_o_fav.ppm')
    convert_ppm_to_png('temp_o_fav.ppm', f'{organizer_dir}/favicon.png')

    print("All branding assets generated successfully!")

if __name__ == '__main__':
    main()
