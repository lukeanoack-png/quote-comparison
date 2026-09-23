import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/**
 * `next dev` and `next build` both write to the dist dir. Sharing one folder
 * means running a build while the dev server is up overwrites the dev
 * server's compiled CSS/JS manifests, and the page is then served without
 * its stylesheet (unstyled HTML). Give the dev server its own folder.
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
