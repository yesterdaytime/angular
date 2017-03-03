/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {animate, state, style, transition, trigger} from '@angular/animations';
import {AnimationTransitionInstruction} from '@angular/animations/browser/src/dsl/animation_transition_instruction';
import {AnimationTrigger} from '@angular/animations/browser/src/dsl/animation_trigger';

import {makeTrigger} from '../shared';

export function main() {
  describe('AnimationTrigger', () => {
    // these tests are only mean't to be run within the DOM (for now)
    if (typeof Element == 'undefined') return;

    let element: any;
    beforeEach(() => {
      element = document.createElement('div');
      document.body.appendChild(element);
    });

    afterEach(() => { document.body.removeChild(element); });

    describe('trigger validation', () => {
      it('should group errors together for an animation trigger', () => {
        expect(() => {
          makeTrigger('myTrigger', [transition('12345', animate(3333))]);
        }).toThrowError(/Animation parsing for the myTrigger trigger have failed/);
      });

      it('should throw an error when a transition within a trigger contains an invalid expression',
         () => {
           expect(
               () => { makeTrigger('name', [transition('somethingThatIsWrong', animate(3333))]); })
               .toThrowError(
                   /- The provided transition expression "somethingThatIsWrong" is not supported/);
         });

      it('should throw an error if an animation alias is used that is not yet supported', () => {
        expect(() => {
          makeTrigger('name', [transition(':angular', animate(3333))]);
        }).toThrowError(/- The transition alias value ":angular" is not supported/);
      });
    });

    describe('trigger usage', () => {
      it('should construct a trigger based on the states and transition data', () => {
        const result = makeTrigger('name', [
          state('on', style({width: 0})), state('off', style({width: 100})),
          transition('on => off', animate(1000)), transition('off => on', animate(1000))
        ]);

        expect(result.states).toEqual({'on': {width: 0}, 'off': {width: 100}});

        expect(result.transitionFactories.length).toEqual(2);
      });

      it('should allow multiple state values to use the same styles', () => {
        const result = makeTrigger('name', [
          state('on, off', style({width: 50})), transition('on => off', animate(1000)),
          transition('off => on', animate(1000))
        ]);

        expect(result.states).toEqual({'on': {width: 50}, 'off': {width: 50}});
      });

      it('should find the first transition that matches', () => {
        const result = makeTrigger(
            'name', [transition('a => b', animate(1234)), transition('b => c', animate(5678))]);

        const trans = buildTransition(result, element, 'b', 'c') !;
        expect(trans.timelines.length).toEqual(1);
        const timeline = trans.timelines[0];
        expect(timeline.duration).toEqual(5678);
      });

      it('should find a transition with a `*` value', () => {
        const result = makeTrigger('name', [
          transition('* => b', animate(1234)), transition('b => *', animate(5678)),
          transition('* => *', animate(9999))
        ]);

        let trans = buildTransition(result, element, 'b', 'c') !;
        expect(trans.timelines[0].duration).toEqual(5678);

        trans = buildTransition(result, element, 'a', 'b') !;
        expect(trans.timelines[0].duration).toEqual(1234);

        trans = buildTransition(result, element, 'c', 'c') !;
        expect(trans.timelines[0].duration).toEqual(9999);
      });

      it('should null when no results are found', () => {
        const result = makeTrigger('name', [transition('a => b', animate(1111))]);

        const trigger = result.matchTransition('b', 'a');
        expect(trigger).toBeFalsy();
      });

      it('should allow a function to be used as a predicate for the transition', () => {
        let returnValue = false;

        const result = makeTrigger('name', [transition((from, to) => returnValue, animate(1111))]);

        expect(result.matchTransition('a', 'b')).toBeFalsy();
        expect(result.matchTransition('1', 2)).toBeFalsy();
        expect(result.matchTransition(false, true)).toBeFalsy();

        returnValue = true;

        expect(result.matchTransition('a', 'b')).toBeTruthy();
      });

      it('should call each transition predicate function until the first one that returns true',
         () => {
           let count = 0;

           function countAndReturn(value: boolean) {
             return (fromState: any, toState: any) => {
               count++;
               return value;
             };
           }

           const result = makeTrigger('name', [
             transition(countAndReturn(false), animate(1111)),
             transition(countAndReturn(false), animate(2222)),
             transition(countAndReturn(true), animate(3333)),
             transition(countAndReturn(true), animate(3333))
           ]);

           const trans = buildTransition(result, element, 'a', 'b') !;
           expect(trans.timelines[0].duration).toEqual(3333);

           expect(count).toEqual(3);
         });

      it('should support bi-directional transition expressions', () => {
        const result = makeTrigger('name', [transition('a <=> b', animate(2222))]);

        const t1 = buildTransition(result, element, 'a', 'b') !;
        expect(t1.timelines[0].duration).toEqual(2222);

        const t2 = buildTransition(result, element, 'b', 'a') !;
        expect(t2.timelines[0].duration).toEqual(2222);
      });

      it('should support multiple transition statements in one string', () => {
        const result = makeTrigger('name', [transition('a => b, b => a, c => *', animate(1234))]);

        const t1 = buildTransition(result, element, 'a', 'b') !;
        expect(t1.timelines[0].duration).toEqual(1234);

        const t2 = buildTransition(result, element, 'b', 'a') !;
        expect(t2.timelines[0].duration).toEqual(1234);

        const t3 = buildTransition(result, element, 'c', 'a') !;
        expect(t3.timelines[0].duration).toEqual(1234);
      });

      describe('locals', () => {
        it('should support transition-level animation variable locals', () => {
          const result = makeTrigger(
              'name', [transition(
                          'a => b', [style({height: '$a'}), animate(1000, style({height: '$b'}))],
                          {$a: '100px', $b: '200px'})]);

          const trans = buildTransition(result, element, 'a', 'b') !;
          const keyframes = trans.timelines[0].keyframes;
          expect(keyframes).toEqual([{height: '100px', offset: 0}, {height: '200px', offset: 1}]);
        });

        it('should subtitute variable locals provided directly within the transition match', () => {
          const result = makeTrigger(
              'name', [transition(
                          'a => b', [style({height: '$a'}), animate(1000, style({height: '$b'}))],
                          {$a: '100px', $b: '200px'})]);

          const trans = buildTransition(result, element, 'a', 'b', {$a: '300px'}) !;

          const keyframes = trans.timelines[0].keyframes;
          expect(keyframes).toEqual([{height: '300px', offset: 0}, {height: '200px', offset: 1}]);
        });
      });

      describe('aliases', () => {
        it('should alias the :enter transition as void => *', () => {
          const result = makeTrigger('name', [transition(':enter', animate(3333))]);

          const trans = buildTransition(result, element, 'void', 'something') !;
          expect(trans.timelines[0].duration).toEqual(3333);
        });

        it('should alias the :leave transition as * => void', () => {
          const result = makeTrigger('name', [transition(':leave', animate(3333))]);

          const trans = buildTransition(result, element, 'something', 'void') !;
          expect(trans.timelines[0].duration).toEqual(3333);
        });
      });
    });
  });
}

function buildTransition(
    trigger: AnimationTrigger, element: any, fromState: string, toState: string,
    locals?: {[name: string]: any}): AnimationTransitionInstruction|null {
  const trans = trigger.matchTransition(fromState, toState) !;
  if (trans) {
    return trans.build(element, fromState, toState, locals) !;
  }
  return null;
}
