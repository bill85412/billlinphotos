#!/usr/bin/env python3
"""Put a product photo on the walls of real room photos (photo-realistic room views for product pages).

    python3 tools/roomviews.py images/NAME.jpg HANDLE

Room photos live in tools/rooms/roomN.jpg (owner-supplied, free-licence). Each room has: the existing
artwork to erase (quads, image px), the wall plane (a known rectangle on the wall -> its quad in the photo),
where to hang the new print (centre + max size in wall units), a frame style and the light direction.
Writes images/mockups/HANDLE-N.jpg (long edge 2000) and images/mockups/sm/HANDLE-N.jpg (long edge 1000).

    python3 tools/roomviews.py images/NAME.jpg HANDLE --canvas

draws a gallery-wrapped stretched canvas instead (no frame; the wrapped side edge shows on the side the camera
sees, deeper shadow, canvas weave) and writes images/mockups/HANDLE-canvas-N.jpg.
"""
import sys, pathlib, numpy as np, cv2

ROOT = pathlib.Path(__file__).resolve().parent.parent
ROOMS = [
    dict(  # warm living room, sectional sofa, walnut floater frame on a canvas
        file="room0.jpg",
        erase=[[(30, 745), (1045, 695), (1045, 1310), (30, 1310)]], donor=(1060, 760, 1420, 1320),
        plane_rect=(2.0, 1.0), plane_quad=[(71, 790), (928, 741), (928, 1240), (73, 1248)],
        hang=dict(cx=1.0, cy=0.52, maxw=2.15, maxh=1.2), frame="walnut", light=(1, 0.4)),
    dict(  # white living room, yellow armchair, black frame + mat
        file="room1.jpg",
        erase=[[(1160, 372), (1684, 372), (1684, 1078), (1160, 1078)]], donor=(700, 700, 1140, 1120),
        plane_rect=(480, 662), plane_quad=[(1181, 393), (1661, 393), (1661, 1055), (1181, 1055)],
        hang=dict(cx=240, cy=330, maxw=640, maxh=700), frame="black-mat", light=(1, 0.3)),
    dict(  # bright apartment, grey sofa, two oak frames -> one oak frame + mat
        file="room2.jpg",
        erase=[[(612, 568), (1440, 500), (1440, 1045), (612, 1045)]], donor=(650, 1060, 1350, 1235),
        plane_rect=(0.714, 1.0), plane_quad=[(1013, 559), (1379, 524), (1374, 1017), (1011, 1021)],
        hang=dict(cx=-0.33, cy=0.5, maxw=1.6, maxh=1.2), frame="oak-mat", light=(1, 0.35)),
    dict(  # empty white wall, bentwood chair, thin black frame
        file="room3.jpg",
        erase=[],
        plane_rect=(1717, 2576), plane_quad=[(0, 0), (1717, 0), (1717, 2576), (0, 2576)],
        hang=dict(cx=900, cy=800, maxw=1150, maxh=900), frame="black", light=(1, 0.5)),
]

def _pushpull(img, known):
    """Fill unknown pixels with a smooth membrane that matches the known pixels at the boundary."""
    if known.all(): return img
    small = cv2.resize(img * known[..., None], None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    k = cv2.resize(known.astype(np.float32), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    with np.errstate(invalid="ignore", divide="ignore"):
        small = np.where(k[..., None] > 1e-3, small / np.maximum(k, 1e-3)[..., None], 0)
    filled = _pushpull(small, k > 1e-3) if min(small.shape[:2]) > 4 else np.where((k > 1e-3)[..., None], small, small[k > 1e-3].mean(0))
    up = cv2.resize(filled, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    up = cv2.GaussianBlur(up, (0, 0), 1.0)
    return np.where(known[..., None], img, up)

def fill_wall(img, quads, donor=None):
    """Erase artwork: smooth membrane fill from the surrounding wall, plus the wall's own texture
    (high-pass of a clean donor patch, mirror-tiled over the hole)."""
    out = img.astype(np.float32)
    H, W = img.shape[:2]
    if not quads: return out
    mask = np.zeros((H, W), np.uint8)
    for q in quads: cv2.fillPoly(mask, [np.int32(q)], 255)
    grow = cv2.dilate(mask, np.ones((15, 15), np.uint8))
    known = (grow == 0).astype(np.float32)
    # blur only the wall outside the hole, so the old frame's dark edge doesn't bleed into the fill
    lowpass = cv2.GaussianBlur(out * known[..., None], (0, 0), 5) / np.maximum(cv2.GaussianBlur(known, (0, 0), 5), 1e-3)[..., None]
    fill = _pushpull(lowpass, grow == 0)
    for _ in range(4):
        fill = np.where(grow[..., None] > 0, cv2.GaussianBlur(fill, (0, 0), 10), lowpass)
    tex = np.zeros_like(out)
    if donor:
        x0, y0, x1, y1 = donor
        d = out[y0:y1, x0:x1]; hp = d - cv2.GaussianBlur(d, (0, 0), 5)
        tile = np.concatenate([hp, hp[:, ::-1]], 1); tile = np.concatenate([tile, tile[::-1]], 0)
        ys, xs = np.nonzero(grow); by0, bx0 = ys.min(), xs.min(); bh, bw = ys.max() - by0 + 1, xs.max() - bx0 + 1
        reps = (bh // tile.shape[0] + 2, bw // tile.shape[1] + 2, 1)
        big = np.tile(tile, reps)[:bh, :bw]
        tex[by0:by0 + bh, bx0:bx0 + bw] = big
    filled = fill + tex
    soft = cv2.GaussianBlur(grow.astype(np.float32) / 255, (0, 0), 3)[..., None]
    return out * (1 - soft) + filled * soft

def canvas(p, u, side):
    """Gallery-wrapped canvas: the face plus the wrapped edge on one side and the bottom, as seen at an angle."""
    ph, pw = p.shape[:2]
    ds, db = int(round(2.2 * u)), int(round(1.1 * u))   # visible side depth, bottom depth
    H, W = ph + db, pw + ds
    img = np.zeros((H, W, 3), np.float32); alpha = np.zeros((H, W), np.float32)
    fx = ds if side < 0 else 0                           # face x offset (left side visible -> face shifted right)
    # canvas weave on the face
    yy, xx = np.mgrid[0:ph, 0:pw]
    weave = (np.sin(xx * 1.9) * np.sin(yy * 1.9)) * 2.2 + np.random.default_rng(1).normal(0, 1.2, (ph, pw))
    img[0:ph, fx:fx + pw] = p + weave[..., None]
    alpha[0:ph, fx:fx + pw] = 1
    # side: the image wraps round the stretcher bar, so it continues the outer columns, in shade
    edge = p[:, :max(2, ds)][:, ::-1] if side < 0 else p[:, -max(2, ds):][:, ::-1]
    sx = 0 if side < 0 else pw
    for i in range(ds):  # parallelogram: each column slides down a little (perspective)
        off = int(round(db * (i + 1) / ds)) if side > 0 else int(round(db * (ds - i) / ds))
        col = edge[:, min(i, edge.shape[1] - 1)] * 0.62
        img[off:off + ph, sx + i] = col; alpha[off:off + ph, sx + i] = 1
    # bottom edge, darker (lit from above)
    bot = p[-max(2, db):][::-1] * 0.45
    for j in range(db):
        sh = int(round(ds * (j + 1) / db))
        x0 = fx + (sh if side > 0 else -sh)
        x0c, x1c = max(0, x0), min(W, x0 + pw)
        img[ph + j, x0c:x1c] = bot[min(j, bot.shape[0] - 1), x0c - x0:x1c - x0]; alpha[ph + j, x0c:x1c] = 1
    # soft highlight along the face's top and outer edges, slight darkening toward the wrap
    img[0:max(1, int(u * 0.3)), fx:fx + pw] += 14
    return np.clip(img, 0, 255), cv2.GaussianBlur(alpha, (0, 0), 0.6)

def framed(photo, style, long_px, side=1):
    """Return RGBA of the print with its frame, at roughly long_px on the long side."""
    h, w = photo.shape[:2]; s = long_px / max(h, w)
    p = cv2.resize(photo, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA).astype(np.float32)
    ph, pw = p.shape[:2]; u = long_px / 100.0
    if style == "canvas": return canvas(p, u, side)
    if style == "walnut": fw, mat, fc = 2.2 * u, 0, (52, 66, 86)          # BGR dark walnut floater
    elif style == "black-mat": fw, mat, fc = 1.6 * u, 7 * u, (24, 24, 24)
    elif style == "oak-mat": fw, mat, fc = 1.5 * u, 7 * u, (120, 170, 205)
    else: fw, mat, fc = 1.2 * u, 0, (22, 22, 22)
    fw, mat = int(round(fw)), int(round(mat))
    H, W = ph + 2 * (fw + mat), pw + 2 * (fw + mat)
    img = np.zeros((H, W, 3), np.float32)
    img[:] = fc
    if mat:
        img[fw:H - fw, fw:W - fw] = (236, 240, 241)
        # mat bevel shadow
        sh = np.zeros((H, W), np.float32); sh[fw:fw + max(2, mat // 6), fw:W - fw] = 1; sh[fw:H - fw, fw:fw + max(2, mat // 6)] = 1
        img *= (1 - 0.12 * cv2.GaussianBlur(sh, (0, 0), 2)[..., None])
    o = fw + mat
    img[o:o + ph, o:o + pw] = p
    # inner shadow from the frame onto the print/mat, subtle highlight on the frame's top-left edge
    m = np.ones((H, W), np.float32); m[fw:H - fw, fw:W - fw] = 0
    inner = cv2.GaussianBlur(m, (0, 0), max(1.5, fw * 0.6)) * (1 - m)
    img *= (1 - 0.35 * inner[..., None])
    hl = np.zeros((H, W), np.float32); hl[:max(1, fw // 3), :] = 1; hl[:, :max(1, fw // 3)] = 1
    img += 28 * cv2.GaussianBlur(hl, (0, 0), 1)[..., None] * m[..., None]
    # faint glass/varnish sheen
    yy, xx = np.mgrid[0:H, 0:W]; sheen = np.clip(1 - np.abs((xx / W + yy / H) - 0.7) * 3, 0, 1) * 10
    img[fw:H - fw, fw:W - fw] += sheen[fw:H - fw, fw:W - fw, None]
    return np.clip(img, 0, 255), np.ones((H, W), np.float32)

def render(photo_path, handle, as_canvas=False):
    photo = cv2.imread(str(photo_path)); ar = photo.shape[1] / photo.shape[0]
    outdir = ROOT / "images/mockups"; (outdir / "sm").mkdir(parents=True, exist_ok=True)
    for i, R in enumerate(ROOMS, 1):
        room = cv2.imread(str(ROOT / "tools/rooms" / R["file"]))
        base = fill_wall(room, R["erase"], R.get("donor"))
        rw, rh = R["plane_rect"]
        Hm = cv2.getPerspectiveTransform(np.float32([(0, 0), (rw, 0), (rw, rh), (0, rh)]), np.float32(R["plane_quad"]))
        g = R["hang"]
        w = g["maxw"]; h = w / ar
        if h > g["maxh"]: h = g["maxh"]; w = h * ar
        q = np.float32(R["plane_quad"])  # which side of a protruding canvas the camera sees
        side = -1 if np.linalg.norm(q[3] - q[0]) > np.linalg.norm(q[2] - q[1]) * 1.01 else 1
        art, alpha = framed(photo, "canvas" if as_canvas else R["frame"], 1400, side)
        AH, AW = art.shape[:2]
        # frame adds a border: keep the *framed* piece inside the box
        k = min(g["maxw"] / AW, g["maxh"] / AH) if (AW / AH) else 1
        if as_canvas and "mat" in R["frame"]: k *= 0.8  # a canvas has no mat: keep it about the same size as the print inside the mat
        w, h = AW * k, AH * k
        x0, y0 = g["cx"] - w / 2, g["cy"] - h / 2
        src = np.float32([(0, 0), (AW, 0), (AW, AH), (0, AH)])
        dst_wall = np.float32([(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)])
        dst = cv2.perspectiveTransform(dst_wall[None], Hm)[0]
        P = cv2.getPerspectiveTransform(src, dst)
        HH, WW = base.shape[:2]
        warped = cv2.warpPerspective(art, P, (WW, HH), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)
        a = cv2.warpPerspective(alpha, P, (WW, HH), flags=cv2.INTER_LINEAR)
        # shadow cast on the wall
        diag = np.linalg.norm(dst[2] - dst[0]); lx, ly = R["light"]
        depth = 1.8 if as_canvas else 1.0  # a stretched canvas stands further off the wall
        sh = cv2.warpAffine(a, np.float32([[1, 0, lx * diag * 0.012 * depth], [0, 1, ly * diag * 0.012 * depth]]), (WW, HH))
        sh = np.maximum(cv2.GaussianBlur(sh, (0, 0), diag * 0.018 * depth) * 0.42, cv2.GaussianBlur(a, (0, 0), diag * 0.004) * 0.3)
        out = base * (1 - sh[..., None] * (1 - a[..., None]))
        # match the room's light: scale the print by the wall's local brightness (relative to its brightest part)
        lum = cv2.cvtColor(np.clip(base, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
        lum = cv2.GaussianBlur(lum, (0, 0), 60)
        ref = np.percentile(lum[a > 0.5], 90) if (a > 0.5).any() else 1
        light = np.clip((lum / ref) ** 0.6, 0.6, 1.05)[..., None]
        # warm/cool cast of the room
        wall_mean = base[(a < 0.01) & (cv2.dilate((a > 0).astype(np.uint8), np.ones((81, 81))) > 0)].mean(0)
        cast = wall_mean / wall_mean.mean(); cast = 1 + (cast - 1) * 0.35
        piece = warped * light * cast * 0.97
        out = out * (1 - a[..., None]) + piece * a[..., None]
        out = cv2.GaussianBlur(out, (0, 0), 0.6) * 0.5 + out * 0.5  # match camera softness
        out = np.clip(out, 0, 255).astype(np.uint8)
        s = 2000 / max(out.shape[:2]); big = cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        name = f"{handle}-canvas-{i}" if as_canvas else f"{handle}-{i}"
        cv2.imwrite(str(outdir / f"{name}.jpg"), big, [cv2.IMWRITE_JPEG_QUALITY, 88, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        sm = cv2.resize(out, None, fx=1000 / max(out.shape[:2]), fy=1000 / max(out.shape[:2]), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(outdir / "sm" / f"{name}.jpg"), sm, [cv2.IMWRITE_JPEG_QUALITY, 85, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        print("wrote", outdir / f"{name}.jpg", big.shape[1], "x", big.shape[0])

if __name__ == "__main__":
    render(ROOT / sys.argv[1], sys.argv[2], "--canvas" in sys.argv[3:])
