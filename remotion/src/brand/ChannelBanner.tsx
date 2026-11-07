import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { AbsoluteFill, Img, random, staticFile } from "remotion";

// YouTube channel banner, 2048×1152. Logo + name stay inside the 1235×338 "safe for all
// devices" box in the middle; the rest is decoration that only shows on desktop / TV.
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const montserrat = loadMontserrat("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily;

// Colors sampled from logo #10
const C = { bg: "#150838", violet: "#7D2BE6", lilac: "#A35DF5", green: "#66F154", deepGreen: "#169A5A", text: "#F3EEFF" };

export const SAFE = { x: 406, y: 407, w: 1235, h: 338 };

const Sparkle: React.FC<{ x: number; y: number; s: number; color: string; o: number }> = ({ x, y, s, color, o }) => (
  <svg style={{ position: "absolute", left: x - s / 2, top: y - s / 2, opacity: o }} width={s} height={s} viewBox="0 0 10 10">
    <path d="M5 0 C5.6 3.6 6.4 4.4 10 5 C6.4 5.6 5.6 6.4 5 10 C4.4 6.4 3.6 5.6 0 5 C3.6 4.4 4.4 3.6 5 0Z" fill={color} />
  </svg>
);

export const ChannelBanner: React.FC<{ showSafeArea?: boolean }> = ({ showSafeArea }) => {
  // keep decoration out of the logo + name box (with a margin)
  const clear = (x: number, y: number) => !(x > SAFE.x - 60 && x < SAFE.x + SAFE.w + 40 && y > SAFE.y - 50 && y < SAFE.y + SAFE.h + 50);
  // deterministic scatter, denser away from the center text band
  const sparkles = Array.from({ length: 46 }, (_, i) => {
    const x = random(`sx${i}`) * 2048;
    const y = random(`sy${i}`) * 1152;
    return { x, y, s: 10 + random(`ss${i}`) * 34, color: random(`sc${i}`) > 0.5 ? C.green : C.lilac, o: clear(x, y) ? 0.35 + random(`so${i}`) * 0.6 : 0 };
  });
  const bubbles = Array.from({ length: 34 }, (_, i) => ({
    x: random(`bx${i}`) * 2048,
    y: random(`by${i}`) * 1152,
    r: 4 + random(`br${i}`) * 16,
    c: random(`bc${i}`) > 0.55 ? C.green : C.lilac,
  })).filter((b) => clear(b.x, b.y));

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {/* soft potion-smoke glows */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 760px 260px at 1230px 590px, ${C.violet}38, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 520px 260px at 1700px 420px, ${C.deepGreen}40, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 700px 340px at 220px 900px, ${C.green}22, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 800px 260px at 1850px 1040px, ${C.violet}40, transparent 70%)` }} />
      {/* swirling smoke ribbons */}
      <svg style={{ position: "absolute", inset: 0 }} width={2048} height={1152} viewBox="0 0 2048 1152">
        <defs>
          <filter id="soft" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2448" height="1552"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <path d="M-50 980 C 300 820, 520 1100, 860 930 S 1500 760, 2100 960" stroke={C.violet} strokeWidth="70" fill="none" opacity="0.35" filter="url(#soft)" />
        <path d="M-50 180 C 340 300, 640 60, 980 190 S 1640 330, 2100 120" stroke={C.deepGreen} strokeWidth="60" fill="none" opacity="0.30" filter="url(#soft)" />
        <path d="M1500 1180 C 1650 950, 1950 1000, 2100 800" stroke={C.green} strokeWidth="40" fill="none" opacity="0.22" filter="url(#soft)" />
      </svg>
      {bubbles.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: b.x, top: b.y, width: b.r * 2, height: b.r * 2, borderRadius: "50%", border: `3px solid ${b.c}`, opacity: 0.35 }} />
      ))}
      {sparkles.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}

      {/* logo + name, inside the all-devices safe area */}
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: SAFE.y,
          width: SAFE.w,
          height: SAFE.h,
          display: "flex",
          alignItems: "center",
          gap: 34,
        }}
      >
        <Img
          src={staticFile("brand/logo/polyjuice-logo-1024.png")}
          style={{
            width: 360,
            height: 360,
            flexShrink: 0,
            marginLeft: -10,
            WebkitMaskImage: "radial-gradient(circle, #000 62%, transparent 71%)",
            maskImage: "radial-gradient(circle, #000 62%, transparent 71%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 40, letterSpacing: 22, color: C.green, marginLeft: 6 }}>THE</div>
          <div
            style={{
              fontFamily: anton,
              fontSize: 200,
              lineHeight: 0.92,
              color: C.text,
              letterSpacing: 4,
              textShadow: `0 0 40px ${C.violet}, 0 6px 0 ${C.violet}`,
            }}
          >
            POLYJUICE
          </div>
          <div style={{ fontFamily: montserrat, fontWeight: 900, fontSize: 52, letterSpacing: 30, color: C.lilac, marginLeft: 8, marginTop: 8 }}>
            PROJECT
          </div>
        </div>
      </div>

      {showSafeArea && (
        <>
          {/* desktop: full width, 423 px tall · all devices: 1235×338 */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 364, height: 423, border: "4px dashed #FFB020" }} />
          <div style={{ position: "absolute", left: SAFE.x, top: SAFE.y, width: SAFE.w, height: SAFE.h, border: "4px dashed #FF5D6C" }} />
        </>
      )}
    </AbsoluteFill>
  );
};
