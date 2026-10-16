#!/usr/bin/env bash
# Encode rendered JPEG frames (frames/f_00000.jpg ...) into the final silent H.264 video.
set -euo pipefail
ffmpeg -y -framerate 30 -i frames/f_%05d.jpg -an -c:v libx264 -preset slow -crf "${CRF:-20}" \
  -pix_fmt yuv420p -movflags +faststart -tag:v avc1 \
  -metadata title="Axial Compressor — AI-generated explainer" \
  -metadata artist="Alireza Bayati, Melika Bali (with Claude, Anthropic)" \
  Axial_Compressor_AI_Explainer.mp4
