import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
    DEAD_ZONE, FLICK_VELOCITY, MAX_DURATION, MIN_DURATION, PinchTracker, SCALE_RANGE,
    VelocityHistory, animationDuration, decideEnd, progressFromScale,
} from '../src/pinchTracker.js';

test('progress runs from 0 at scale 1 to 1 at the pinch-in limit, negative when spreading', () => {
    assert.equal(progressFromScale(1), 0);
    assert.ok(Math.abs(progressFromScale(1 - SCALE_RANGE) - 1) < 1e-9);
    assert.ok(Math.abs(progressFromScale(1 + SCALE_RANGE) + 1) < 1e-9);
    assert.ok(DEAD_ZONE < 0.1);
});

test('a slow pinch settles on the nearest point', () => {
    assert.equal(decideEnd({progress: 0.4, velocity: 0, points: [0, 1]}), 0);
    assert.equal(decideEnd({progress: 0.6, velocity: 0, points: [0, 1]}), 1);
    assert.equal(decideEnd({progress: 1.4, velocity: 0, points: [0, 1, 2]}), 1);
});

test('a flick moves to the next point in its direction even from close to the start', () => {
    assert.equal(decideEnd({progress: 0.1, velocity: FLICK_VELOCITY * 2, points: [0, 2]}), 2);
    assert.equal(decideEnd({progress: 1.9, velocity: -FLICK_VELOCITY * 2, points: [0, 2]}), 0);
    assert.equal(decideEnd({progress: 1.9, velocity: -FLICK_VELOCITY * 2, points: [0, 1, 2]}), 1);
});

test('a flick past the last point stays on the last point', () => {
    assert.equal(decideEnd({progress: 2, velocity: FLICK_VELOCITY * 2, points: [0, 2]}), 2);
    assert.equal(decideEnd({progress: 0, velocity: -FLICK_VELOCITY * 2, points: [0, 2]}), 0);
});

test('animation duration stays within the shell limits and shortens with speed', () => {
    const slow = animationDuration(0.5, 1, 0.0005);
    const fast = animationDuration(0.5, 1, 0.01);
    assert.ok(slow >= MIN_DURATION && slow <= MAX_DURATION);
    assert.ok(fast >= MIN_DURATION && fast <= MAX_DURATION);
    assert.ok(fast <= slow);
    assert.equal(animationDuration(1, 1, 0.01), MIN_DURATION);
    // moving away from the target falls back to the base velocity instead of a negative duration
    assert.ok(animationDuration(0.5, 1, -0.01) > 0);
});

test('velocity history keeps only the trailing window', () => {
    const h = new VelocityHistory(100);
    h.push(0, 0);
    h.push(50, 0.1);
    h.push(300, 0.2);
    h.push(350, 0.4);
    assert.ok(Math.abs(h.velocity() - 0.2 / 50) < 1e-9);
});

test('tracker reports progress, velocity and the end decision inputs', () => {
    const calls = [];
    const tracker = new PinchTracker({
        onBegin: fingers => fingers === 4,
        onUpdate: (progress, scale) => calls.push(['update', progress, scale]),
        onEnd: (progress, velocity, cancelled) => calls.push(['end', progress, velocity, cancelled]),
    });

    assert.equal(tracker.begin(0, 3), false);
    tracker.update(10, 0.9);
    assert.equal(calls.length, 0, 'ignored gestures produce no updates');

    assert.equal(tracker.begin(100, 4), true);
    tracker.update(120, 0.9);
    tracker.update(140, 0.8);
    tracker.end(150);

    assert.equal(calls[0][0], 'update');
    assert.ok(Math.abs(calls[0][1] - progressFromScale(0.9)) < 1e-9);
    const end = calls.at(-1);
    assert.equal(end[0], 'end');
    assert.ok(Math.abs(end[1] - progressFromScale(0.8)) < 1e-9);
    assert.ok(end[2] > 0, 'pinching in gives a positive velocity');
    assert.equal(end[3], false);
    assert.equal(tracker.active, false);
});

test('a cancelled gesture reports zero velocity', () => {
    let ended;
    const tracker = new PinchTracker({
        onBegin: () => true,
        onUpdate: () => {},
        onEnd: (progress, velocity, cancelled) => (ended = {progress, velocity, cancelled}),
    });
    tracker.begin(0, 4);
    tracker.update(20, 0.7);
    tracker.end(30, true);
    assert.equal(ended.velocity, 0);
    assert.equal(ended.cancelled, true);
});
