# /// script
# dependencies = ["numpy"]
# ///
# How alike are the camera and the screen recording, second by second? OBS shows the camera full
# frame in its talking head scene, so a high score means the screen recording is just the camera.
# Reads two raw gray streams (64x36, 1 fps) from files; prints JSON: [score, ...].
import json, sys
import numpy as np

W, H = 64, 36
a = np.fromfile(sys.argv[1], dtype=np.uint8)
b = np.fromfile(sys.argv[2], dtype=np.uint8)
n = min(len(a), len(b)) // (W * H)
a = a[: n * W * H].reshape(n, -1).astype(float)
b = b[: n * W * H].reshape(n, -1).astype(float)
a -= a.mean(axis=1, keepdims=True)
b -= b.mean(axis=1, keepdims=True)
score = (a * b).sum(axis=1) / (np.sqrt((a * a).sum(axis=1) * (b * b).sum(axis=1)) + 1e-9)
print(json.dumps([round(float(s), 3) for s in score]))
