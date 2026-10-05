import assert from 'node:assert/strict';
import {test} from 'node:test';

import {BASE_DISTANCE, CLAIM_THRESHOLD, SwipeClaimer} from '../src/swipeClaimer.js';

function make(accept = true) {
    const log = [];
    const claimer = new SwipeClaimer({
        onBegin: () => (log.push('begin'), accept),
        onUpdate: p => log.push(['update', +p.toFixed(3)]),
        onEnd: (p, v, c) => log.push(['end', +p.toFixed(3), Math.sign(v), c]),
    });
    return {claimer, log};
}

// Fingers moving down on a natural-scrolling touchpad: dy > 0, GNOME flips it to a negative delta.
const down = (dy, time = 0) => ({phase: 'update', fingers: 3, dx: 0, dy, natural: true, time});

test('events pass through until the direction is known, then a downward swipe is claimed', () => {
    const {claimer, log} = make();
    assert.equal(claimer.feed({phase: 'begin', fingers: 3, dx: 0, dy: 0, natural: true, time: 0}), false);
    assert.equal(claimer.feed(down(4, 10)), false, 'still under the claim threshold');
    assert.equal(claimer.feed(down(8, 20)), true, 'claimed once past the threshold');
    assert.deepEqual(log[0], 'begin');
    assert.deepEqual(log[1], ['update', +(12 / BASE_DISTANCE).toFixed(3)]);
    assert.equal(claimer.feed(down(150, 100)), true);
    assert.equal(claimer.feed({phase: 'end', fingers: 3, dx: 0, dy: 0, natural: true, time: 120}), true);
    const end = log.at(-1);
    assert.equal(end[0], 'end');
    assert.ok(end[1] > 0.5);
    assert.equal(end[2], 1, 'positive velocity while fingers keep moving down');
    assert.equal(end[3], false);
    assert.ok(CLAIM_THRESHOLD < 16, 'must decide before GNOME does');
});

test('an upward swipe is left to GNOME', () => {
    const {claimer, log} = make();
    claimer.feed({phase: 'begin', fingers: 3, dx: 0, dy: 0, natural: true, time: 0});
    assert.equal(claimer.feed(down(-20, 10)), false);
    assert.equal(claimer.feed(down(-20, 20)), false);
    assert.equal(claimer.feed({phase: 'end', fingers: 3, dx: 0, dy: 0, natural: true, time: 30}), false);
    assert.deepEqual(log, []);
});

test('without natural scrolling the finger direction flips, matching GNOME', () => {
    const {claimer, log} = make();
    claimer.feed({phase: 'begin', fingers: 3, dx: 0, dy: 0, natural: false, time: 0});
    assert.equal(claimer.feed({phase: 'update', fingers: 3, dx: 0, dy: -20, natural: false, time: 10}), true);
    assert.equal(log[0], 'begin');
});

test('horizontal swipes and two-finger swipes are never claimed', () => {
    const {claimer, log} = make();
    claimer.feed({phase: 'begin', fingers: 3, dx: 0, dy: 0, natural: true, time: 0});
    assert.equal(claimer.feed({phase: 'update', fingers: 3, dx: 30, dy: 5, natural: true, time: 10}), false);
    assert.equal(claimer.feed(down(100, 20)), false, 'once ignored, stays ignored for this swipe');
    claimer.feed({phase: 'begin', fingers: 2, dx: 0, dy: 0, natural: true, time: 100});
    assert.equal(claimer.feed({phase: 'update', fingers: 2, dx: 0, dy: 50, natural: true, time: 110}), false);
    assert.deepEqual(log, []);
});

test('a refused begin leaves the swipe to GNOME', () => {
    const {claimer, log} = make(false);
    claimer.feed({phase: 'begin', fingers: 3, dx: 0, dy: 0, natural: true, time: 0});
    assert.equal(claimer.feed(down(20, 10)), false);
    assert.equal(claimer.feed(down(20, 20)), false);
    assert.deepEqual(log, ['begin']);
});

test('progress is clamped to 1 and a cancel reports zero velocity', () => {
    const {claimer, log} = make();
    claimer.feed({phase: 'begin', fingers: 4, dx: 0, dy: 0, natural: true, time: 0});
    claimer.feed(down(20, 10));
    claimer.feed(down(1000, 50));
    assert.equal(claimer.progress, 1);
    claimer.feed({phase: 'cancel', fingers: 4, dx: 0, dy: 0, natural: true, time: 60});
    assert.deepEqual(log.at(-1), ['end', 1, 0, true]);
});
