# /// script
# dependencies = ["numpy", "scipy", "soundfile"]
# ///
# Where does each other wav sit against the reference? Prints JSON, one entry per file:
# {"offset": s, "corr": c}, where other_time = reference_time + offset.
import json, sys
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve


def load(path):
    x, rate = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    x = x - x.mean()
    return x / (np.abs(x).max() + 1e-9), rate


ref, rate = load(sys.argv[1])
out = []
for path in sys.argv[2:]:
    y, _ = load(path)
    n = min(len(ref), len(y))
    a, b = ref[:n], y[:n]
    c = fftconvolve(a, b[::-1], mode="full")
    i = int(c.argmax())
    lag = (i - (n - 1)) / rate
    corr = float(c[i] / np.sqrt((a * a).sum() * (b * b).sum()))
    out.append({"offset": round(-lag, 4), "corr": round(corr, 3)})
print(json.dumps(out))
