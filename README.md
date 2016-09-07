# PadSynth

This is a synth written in REAPER's JSFX language.

To use, copy `pad-synth.jsfx` to REAPER's JSFX directory.  This synth uses a [JSFX UI library](https://github.com/geraintluff/jsfx-ui-lib) for its interface - you'll need to have `ui-lib.jsfx-inc` in the same directory as this synth for it to work.

Demos are available in the `demos/` directory, and some presets are in `padsynth-presets.rpl`.

## Features

### Generates its own samples

A "model waveform" is generated, and this is used to generate a set of patches used by a sampling engine.

This is based on the "padsynth" algorithm from ZynAddSubFX, where the samples are designed in the frequency domain and then IFFT'd.  Although REAPER's built-in FFT has a maximum size of 32768, we can generate larger samples by implementing an extension to this (using Cooley-Tukey factorisation).

### Intermodulated effects

This synth has its own effects chain applied separately for each note, including modulators that can alter other effects' parameters (or the note pitch/amplitude).

Currently, available effects are:

*	Filter - 2nd-order lowpass with basic envelope and note/velocity response.  Various parameters (e.g. frequency and Q) are automatable.
*	LFO - can modulate other effects.  Frequency and amplitude of LFO are themselves modulatable.
*	Controller/Note/Velocity modulator - modulates other effects using controller values, note number or velocity
*	Harmonic Modulator (FM) - a frequency modulator for FM synthesis. FM depth and Hz-offset are modulatable.
*	Distortion - a nonlinear filter (currently tanh() only) with optional asymmetry

Want to make your vibrato dependent on the note velocity?  Want to make your filter frequency dependent on the Expression controller (11)?  Just hook it up.

## Development

The code is in `pad-synth.txt`.  This project makes use of a [JSFX preprocessor](https://www.npmjs.com/package/jsfx-preprocessor) that I wrote, and this is what generates `pad-synth.jsfx`.

This means that to assemble the final code, you'll need Node.js installed.

```
node build.js /path/to/pad-synth.jsfx
```

If you omit the argument, it builds `pad-synth.jsfx` in the current directory.

## Goals

### Speed

It's a little slow at the moment - I don't know how much of this is just because it's written in JSFX, but maybe there are some things that could speed it up.

### More effects

Different filter types, multi-stage filters, make more parameters modulatable.

Only per-note effects need to be part of this synth - any "global" effect (e.g. reverb) is better implemented as a separate plugin, placed after this one in the chain.

### Waveform width parameters

Currently, the spread of each harmonic is a Gaussian proportional to frequency ("natural" detuning).  However, other detunings would be good.

It also currently adds harmonics by sampling the density function - this requires a bit of a hack to make sure our width isn't small enough that we completely miss the harmonic.  Instead, we could generate a table of the cumulative density function, and sample the diff (linearly interpolated), which would guarantee coverage (as well as allowing better customisation of the spread).

This probably means the cumulative table should be power, not amp.

### Pitch bend, other controllers

Currently ignores pitch bend.

### More compact UI

The UI is currently spread across more screens than it needs to be - this is largely because the UI library didn't initially have dials or vertical sliders.  However, several of the screens could now be combined using more compact controls

*	Envelope could be part of the main screen
*	New "harmonic spread" parameters could be part of waveform design screen
*	Compact controls on other screens (such as effects) could make room for displays (e.g. small oscillator phase indicator)