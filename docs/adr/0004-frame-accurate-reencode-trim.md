# ADR 0004: Frame-Accurate Re-Encode for Trim in v1

## Status
Accepted

## Context
Trimming videos via stream copy (`-c copy`) can only cut at keyframe (I-frame/GOP) boundaries. When users drag a trim handle to cut at `00:12.4`, a stream-copy cut might actually cut at `00:09.0` or `00:15.0`, creating unexpected extra footage or missing audio. Explaining keyframes, GOP intervals, and smart-rendering artifacts violates the core product principle of zero media jargon.

## Decision
In v1, trimming re-encodes the kept segment between the requested start and end timestamps. Accurate boundary cut positions are strictly prioritized over instantaneous cutting speed.

## Consequences
- **Positive**: Exact frame-accurate cuts matching what the user specified in the UI; no confusing audio desync or missing frames at cut boundaries.
- **Negative**: Trimming takes encoding time rather than being near-instantaneous.
