# Makes the offer ring (row 58, spec 0003): two bright notes, three times,
# then a short rest. Pure sine tones built here, so the file has no licence
# attached. Run from the repo root:
#   python3 scripts/make-offer-ring.py android/app/src/main/res/raw/offer_ring.wav
# Android fixes a channel's sound when the channel is made, so a new sound for
# riders who already have the app also needs new channel ids (offerAlert.ts).
import math, struct, sys, wave
RATE = 22050
def tone(freq, secs, amp=0.8):
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        # 8 ms fade in, exponential fade out: no clicks
        env = min(1.0, t / 0.008) * math.exp(-3.0 * t / secs)
        s = math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * 2 * freq * t)
        out.append(amp * env * s / 1.3)
    return out
def rest(secs):
    return [0.0] * int(RATE * secs)
samples = []
for _ in range(3):
    samples += tone(1318.5, 0.16) + rest(0.04) + tone(987.8, 0.22) + rest(0.12)
samples += rest(0.35)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32767)) for s in samples))
