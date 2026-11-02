# Makes the auto accept sound (row 71, spec 0020, AC-12): two rising notes,
# played twice, loud and short (about 1.2 s). The offer ring falls (high note,
# then lower); this one climbs, so a rider can tell "an offer is waiting" from
# "the phone took an order for you" without looking. Pure sine tones built
# here, so the file has no licence attached. Run from the repo root:
#   python3 scripts/make-auto-accept-sound.py android/app/src/main/res/raw/auto_accept.wav
# Android fixes a channel's sound when the channel is made, so a new sound for
# riders who already have the app also needs a new channel id (autoAccepted.ts).
import math, struct, sys, wave
RATE = 22050
def tone(freq, secs, amp=0.95):
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        # 6 ms fade in, gentle fade out: no clicks, but it stays loud to the end
        env = min(1.0, t / 0.006) * math.exp(-1.5 * t / secs)
        # a little of the octave and the fifth above makes it cut through traffic
        s = (math.sin(2 * math.pi * freq * t)
             + 0.35 * math.sin(2 * math.pi * 2 * freq * t)
             + 0.15 * math.sin(2 * math.pi * 3 * freq * t))
        out.append(amp * env * s / 1.5)
    return out
def rest(secs):
    return [0.0] * int(RATE * secs)
samples = []
for _ in range(2):
    # G5 up to D6 (a fifth): rising, unlike the offer ring's falling pair
    samples += tone(784.0, 0.14) + rest(0.03) + tone(1174.7, 0.26) + rest(0.12)
samples += rest(0.05)
# Loud: scale so the highest peak sits just under full volume.
peak = max(abs(s) for s in samples)
samples = [s * 0.95 / peak for s in samples]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32767)) for s in samples))
