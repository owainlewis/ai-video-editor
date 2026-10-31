# /// script
# dependencies = ["numpy", "soundfile"]
# ///
# Loudness of a wav in 10 ms frames, in dBFS. Prints JSON: {"step": 0.01, "db": [...]}.
import json, sys
import numpy as np, soundfile as sf

x, rate = sf.read(sys.argv[1], always_2d=True)
x = x.mean(axis=1)
hop = rate // 100
n = len(x) // hop
frames = x[: n * hop].reshape(n, hop)
rms = np.sqrt((frames ** 2).mean(axis=1))
db = 20 * np.log10(rms + 1e-9)
print(json.dumps({"step": 0.01, "db": [round(float(v), 1) for v in db]}))
