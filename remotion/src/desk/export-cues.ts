import { SFX, camera, DURATION, HOLDS } from "./world";
const cam: number[][] = [];
for (let f = 0; f <= Math.round(DURATION * 30); f++) { const c = camera(f / 30); cam.push([+(c.x.toFixed(2)), +(c.y.toFixed(2)), +(c.z.toFixed(4))]); }
console.log(JSON.stringify({ SFX, cam, HOLDS }));
