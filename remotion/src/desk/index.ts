// Separate entry for the one-camera desk cut, so the main templates are untouched.
// Render: npx remotion render src/desk/index.ts DeskCut out.mp4
import React from "react";
import { Composition, registerRoot } from "remotion";
import { DeskCut } from "./DeskCut";
import { OUT_DURATION as DURATION } from "./remap-data";

const DeskRoot: React.FC = () =>
  React.createElement(Composition, {
    id: "DeskCut",
    component: DeskCut,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: Math.round(DURATION * 30),
  });

registerRoot(DeskRoot);
